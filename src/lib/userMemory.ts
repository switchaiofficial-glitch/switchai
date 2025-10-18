/**
 * User Memory Service for Website
 * Embedding-based search through AI memory and chat history
 * Optimized for minimal token usage - uses local embeddings for retrieval
 */

import { doc, getDoc } from 'firebase/firestore';
import OpenAI from 'openai';
import { auth, firestore } from './firebase';

// Types
export type MemoryType = 'preference' | 'fact' | 'interaction' | 'setting';
export interface MemoryItem {
  id: string;
  text: string;
  type: MemoryType;
  key?: string | null;
  embedding: number[]; // Primary vector (OpenAI or local)
  dim: number;
  qvec: number[]; // Fast 256-dim local vector for retrieval
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  usageCount?: number;
}

// Constants
const STORAGE_KEY = 'userMemory:v1:items';
const ENABLED_KEY = 'userMemory:v1:enabled';
const MAX_RETRIEVE = 5;
const DEFAULT_TOPN = 5;
const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const MAX_ITEMS = 800;

// In-memory cache
let cache: MemoryItem[] = [];
let loaded = false;
let openaiClient: OpenAI | null = null;
let openaiKey: string | null = null;

// Utils
const now = () => Date.now();
const clampTopN = (n?: number) => Math.max(1, Math.min(n ?? DEFAULT_TOPN, MAX_RETRIEVE));
const safeText = (s: any) => String(s || '').trim();
const toKey = (s: string) => safeText(s).toLowerCase();

// Generate simple unique ID
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Vector math
function l2norm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s) || 1;
}

function normalize(v: number[]): number[] {
  const n = l2norm(v);
  return v.map(x => x / n);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) s += a[i] * b[i];
  return s;
}

function cosine(a: number[], b: number[]): number {
  return dot(a, b);
}

// Lightweight local embedding (hashed bag-of-words)
// This is FAST and uses NO tokens!
function localEmbedding(text: string, dim = 256): number[] {
  const v = new Array(dim).fill(0);
  const tokens = safeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h = (h ^ t.charCodeAt(i)) * 16777619;
    }
    const idx = Math.abs(h) % dim;
    v[idx] += 1;
  }
  
  return normalize(v);
}

// Memory enabled flag
async function getEnabledFlag(): Promise<boolean> {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    if (v === null) return false;
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

async function setEnabledFlag(value: boolean): Promise<void> {
  try {
    localStorage.setItem(ENABLED_KEY, value ? '1' : '0');
  } catch {}
}

export async function isMemoryEnabled(): Promise<boolean> {
  return await getEnabledFlag();
}

export async function setMemoryEnabled(v: boolean): Promise<void> {
  await setEnabledFlag(v);
}

// OpenAI client (optional, for better embeddings)
async function fetchOpenAIKey(): Promise<string> {
  const uid = auth?.currentUser?.uid || null;
  if (uid) {
    try {
      const userRef = doc(firestore, 'users', uid, 'api', 'openai');
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data?.enabled && typeof data.key === 'string' && data.key) {
          return data.key;
        }
      }
    } catch {}
  }
  
  const globalRef = doc(firestore, 'api', 'openai');
  const gSnap = await getDoc(globalRef);
  if (!gSnap.exists()) throw new Error('OpenAI key not configured');
  const g = gSnap.data() as any;
  if (!g?.key) throw new Error('OpenAI key missing');
  return String(g.key);
}

async function getOpenAI(): Promise<OpenAI | null> {
  try {
    if (openaiClient && openaiKey) return openaiClient;
    const key = await fetchOpenAIKey();
    openaiKey = key;
    openaiClient = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
    return openaiClient;
  } catch {
    return null;
  }
}

async function embedRemote(text: string): Promise<number[] | null> {
  try {
    const client = await getOpenAI();
    if (!client) return null;
    const res = await client.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input: text,
    });
    const vec = res?.data?.[0]?.embedding as number[] | undefined;
    if (Array.isArray(vec) && vec.length) return normalize(vec.slice());
    return null;
  } catch {
    return null;
  }
}

async function getEmbedding(text: string): Promise<{ vector: number[]; dim: number; origin: 'openai' | 'local' }> {
  const remote = await embedRemote(text);
  if (remote) return { vector: remote, dim: remote.length, origin: 'openai' };
  const local = localEmbedding(text);
  return { vector: local, dim: local.length, origin: 'local' };
}

// Cache load/save
async function loadCache(): Promise<void> {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = [];
      loaded = true;
      return;
    }
    const items = JSON.parse(raw) as MemoryItem[];
    cache = Array.isArray(items) ? items.filter(Boolean) : [];
  } catch {
    cache = [];
  }
  loaded = true;
}

async function saveCache(): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

// Similarity search using qvec (fast local vector)
function topNSimilarQ(qvec: number[], topN: number): Array<{ item: MemoryItem; score: number; idx: number }> {
  const scores: Array<{ item: MemoryItem; score: number; idx: number }> = [];
  
  for (let i = 0; i < cache.length; i++) {
    const it = cache[i];
    const base = Array.isArray(it.qvec) && it.qvec.length ? it.qvec : it.embedding;
    if (!base || !base.length) continue;
    const s = cosine(qvec, base);
    scores.push({ item: it, score: s, idx: i });
  }
  
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}

// Pruning
async function pruneIfNeeded(): Promise<void> {
  if (cache.length <= MAX_ITEMS) return;
  cache.sort((a, b) =>
    (b.usageCount || 0) - (a.usageCount || 0) ||
    (b.lastUsedAt || 0) - (a.lastUsedAt || 0) ||
    b.updatedAt - a.updatedAt
  );
  cache = cache.slice(0, MAX_ITEMS);
  await saveCache();
}

// Relevance check
function isRelevant(text: string): boolean {
  const t = safeText(text).toLowerCase();
  if (!t || t.length < 10) return false;
  
  // Reject greetings
  if (/^(hi|hello|hey|hola|yo|sup|greetings|good morning|good afternoon|good evening|good night)[\s!.?]*$/i.test(t)) return false;
  if (/^(thanks|thank you|thx|ty|ok|okay|sure|yes|no|yep|nope|yeah|nah)[\s!.?]*$/i.test(t)) return false;
  if (/^(got it|i see|understood|alright|cool|nice|great|awesome)[\s!.?]*$/i.test(t)) return false;
  
  // Reject questions
  if (/\b(what is|what's|who is|who's|how do|how to|can you|could you|would you|will you|please|explain|tell me|show me|why|when|where)\b/i.test(t)) return false;
  if (/\b(help me|assist|generate|create|write|make me|give me|find|search|look up)\b/i.test(t)) return false;
  
  // Accept memory directives
  if (/^remember\b/.test(t) || /\bremember that\b/.test(t)) return true;
  if (/\b(make|take) a note\b/.test(t) || /\bsave (this|that)\b/.test(t)) return true;
  
  // Accept profile/preferences
  if (/\bmy name is\b/.test(t) || /^call me\b/.test(t)) return true;
  if (/\bi (live in|am from|work at|study at|always use|always prefer|really like|really love)\b/.test(t)) return true;
  if (/\b(i am|i'?m)\s+\d{1,3}(\s*(years?|yrs?|yo)\b)?/.test(t)) return true;
  
  return false;
}

function inferType(text: string): MemoryType {
  const t = safeText(text).toLowerCase();
  if (t.includes('answer style') || t.includes('tone:') || t.startsWith('call me')) return 'setting';
  if (t.includes('i like') || t.includes('my favorite') || t.includes('i love') || t.includes('i prefer')) return 'preference';
  if (t.includes('remember that') || t.includes('my name is') || t.includes('i live in')) return 'fact';
  return 'interaction';
}

// Public API
export async function initUserMemory(): Promise<void> {
  await loadCache();
}

/**
 * Store memory using LOCAL embeddings only (no tokens used!)
 * This is the recommended method for storing
 */
export async function storeMemoryLocalOnly(text: string, type?: MemoryType): Promise<MemoryItem | null> {
  if (!(await getEnabledFlag())) return null;
  await loadCache();
  
  const clean = safeText(text);
  if (!clean) return null;
  
  const t: MemoryType = type || inferType(clean);
  const q = localEmbedding(clean);
  
  // Check for exact duplicate
  const exactIdx = cache.findIndex((m) => safeText(m.text).toLowerCase() === clean.toLowerCase());
  if (exactIdx !== -1) {
    const embExact = { vector: localEmbedding(clean), dim: 256 };
    cache[exactIdx] = {
      ...cache[exactIdx],
      text: clean,
      type: cache[exactIdx].type === 'interaction' ? t : cache[exactIdx].type,
      embedding: embExact.vector,
      dim: embExact.dim,
      qvec: q,
      updatedAt: now(),
    };
    await saveCache();
    return cache[exactIdx];
  }
  
  // Check for near-duplicate
  const candQ = topNSimilarQ(q, 1)[0];
  if (candQ && candQ.score >= 0.78) {
    const embNear = { vector: localEmbedding(clean), dim: 256 };
    const idx = candQ.idx;
    cache[idx] = {
      ...cache[idx],
      text: clean,
      type: cache[idx].type === 'interaction' ? t : cache[idx].type,
      embedding: embNear.vector,
      dim: embNear.dim,
      qvec: q,
      updatedAt: now(),
    };
    await saveCache();
    return cache[idx];
  }
  
  // New item
  const emb = { vector: localEmbedding(clean), dim: 256 };
  const item: MemoryItem = {
    id: makeId(),
    text: clean,
    type: t,
    key: null,
    embedding: emb.vector,
    dim: emb.dim,
    qvec: q,
    createdAt: now(),
    updatedAt: now(),
    lastUsedAt: 0,
    usageCount: 0,
  };
  
  cache.push(item);
  await pruneIfNeeded();
  await saveCache();
  return item;
}

/**
 * Retrieve relevant memories using LOCAL embeddings (no tokens used!)
 * This is FAST (<50ms) and uses zero API calls
 */
export async function retrieveMemory(query: string, topN?: number): Promise<MemoryItem[]> {
  if (!(await getEnabledFlag())) return [];
  await loadCache();
  
  const clean = safeText(query);
  if (!clean || cache.length === 0) return [];
  
  // Use fast local embedding for query (NO TOKENS!)
  const emb = { vector: localEmbedding(clean), dim: 256 };
  const N = clampTopN(topN);
  
  // Score using qvec for speed
  const scores: Array<{ item: MemoryItem; score: number; idx: number }> = [];
  for (let i = 0; i < cache.length; i++) {
    const it = cache[i];
    const base = Array.isArray(it.qvec) && it.qvec.length ? it.qvec : it.embedding;
    if (!base || !base.length) continue;
    const s = cosine(emb.vector, base);
    scores.push({ item: it, score: s, idx: i });
  }
  
  scores.sort((a, b) => b.score - a.score);
  const results = scores.slice(0, N).filter(r => r.score >= 0.25);
  
  // Update usage stats
  for (const r of results) {
    r.item.usageCount = (r.item.usageCount || 0) + 1;
    r.item.lastUsedAt = now();
  }
  
  if (results.length) {
    try {
      await saveCache();
    } catch {}
  }
  
  return results.map(r => r.item);
}

/**
 * Maybe store from user message (auto-detect relevance)
 */
export async function maybeStoreFromUserMessage(text: string): Promise<boolean> {
  try {
    if (!(await getEnabledFlag())) return false;
    const clean = safeText(text);
    const lower = clean.toLowerCase();
    
    // Ignore questions about memory
    if (/\b(what'?s|what is|who am i|do you remember|can you remember|tell me my)\b/i.test(lower)) {
      return false;
    }
    
    if (!isRelevant(clean)) return false;
    
    // Strip memory verbs
    const stripped = clean
      .replace(/^please\s+remember\s*(that)?\s*/i, '')
      .replace(/^remember\s*(that|,)?\s*/i, '')
      .trim();
    
    const res = await storeMemoryLocalOnly(stripped || clean);
    return !!res;
  } catch {
    return false;
  }
}

/**
 * Build system prompt from memory items
 */
export function buildMemorySystemPrompt(items: MemoryItem[]): string {
  const lines = items.slice(0, MAX_RETRIEVE).map(m => `- ${m.text}`);
  return `User's memory:\n${lines.join('\n')}`;
}

/**
 * Get all memories
 */
export async function getAllMemories(): Promise<MemoryItem[]> {
  await loadCache();
  return cache.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete memory by ID
 */
export async function deleteMemory(id: string): Promise<boolean> {
  await loadCache();
  const idx = cache.findIndex(m => m.id === id);
  if (idx === -1) return false;
  cache.splice(idx, 1);
  try {
    await saveCache();
  } catch {}
  return true;
}

/**
 * Clear all memories
 */
export async function clearAllMemories(): Promise<void> {
  await loadCache();
  cache = [];
  try {
    await saveCache();
  } catch {}
}

/**
 * Search chat history using embeddings (no tokens!)
 */
export async function searchChatHistory(
  query: string,
  chatHistory: Array<{ role: string; content: string }>,
  topN: number = 3
): Promise<Array<{ message: { role: string; content: string }; score: number }>> {
  const clean = safeText(query);
  if (!clean || !chatHistory.length) return [];
  
  // Use local embedding for query (NO TOKENS!)
  const queryVec = localEmbedding(clean);
  
  // Score each message
  const scores: Array<{ message: { role: string; content: string }; score: number }> = [];
  
  for (const msg of chatHistory) {
    if (msg.role !== 'assistant' && msg.role !== 'user') continue;
    const content = safeText(msg.content);
    if (!content || content.length < 10) continue;
    
    const msgVec = localEmbedding(content);
    const score = cosine(queryVec, msgVec);
    
    if (score >= 0.3) {
      scores.push({ message: msg, score });
    }
  }
  
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}
