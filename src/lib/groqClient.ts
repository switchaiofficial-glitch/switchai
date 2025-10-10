import { doc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';

interface StreamOptions {
  model: string;
  messages: Array<{ role: string; content: string | any[] }>;
  temperature?: number;
  max_tokens?: number;
  reasoning?: any;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onDone?: (fullText: string) => void;
}

// Cached Groq API key
let cachedKey: string | null = null;

export function resetGroqCache() {
  cachedKey = null;
}

async function fetchGroqApiKey(): Promise<string> {
  // First try from cache
  if (cachedKey) return cachedKey;

  // Try user-specific key first: users/{uid}/api/groq.key
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      const userRef = doc(firestore, 'users', uid, 'api', 'groq');
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const userKey = userData?.key;
      const enabled = !!userData?.enabled;
      if (enabled && userKey && typeof userKey === 'string') {
        cachedKey = userKey;
        return userKey;
      }
    }
  } catch (e) {
    // Non-fatal: fall back to global
    console.warn('User-specific Groq key lookup failed, falling back to global.', e);
  }

  // Fallback: global api/groq.key
  try {
    const ref = doc(firestore, 'api', 'groq');
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    const key = data?.key || null;
    if (!key || typeof key !== 'string') {
      throw new Error('Groq API key not found in Firestore (api/groq.key)');
    }
    cachedKey = key;
    return key;
  } catch (error) {
    console.error('Failed to fetch Groq API key:', error);
    throw new Error('Groq API key not available');
  }
}

export async function streamChatCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  reasoning,
  signal,
  onDelta,
  onDone
}: StreamOptions): Promise<string> {
  const apiKey = await fetchGroqApiKey();
  
  const controller = new AbortController();
  const abortSignal = signal || controller.signal;
  
  // Build request body - only include reasoning if it's explicitly provided and not undefined/null
  const requestBody: any = {
    model,
    messages,
    temperature,
    max_tokens,
    stream: true,
  };
  
  // Only add reasoning parameter if it's actually defined and not undefined/null
  if (reasoning !== undefined && reasoning !== null) {
    requestBody.reasoning = reasoning;
  }
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal,
  });
  
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Streaming request failed: ${res.status} ${res.statusText} ${text}`);
  }
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunkStr = decoder.decode(value, { stream: true });
      buffer += chunkStr;
      
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        
        if (!line || !line.startsWith('data:')) continue;
        
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            if (onDelta) onDelta(delta);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  if (onDone) onDone(fullText);
  return fullText;
}

export async function groqChatCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
}: Omit<StreamOptions, 'onDelta' | 'onDone'>): Promise<{ content: string; usage?: any }> {
  const apiKey = await fetchGroqApiKey();
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    }),
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chat completion failed: ${res.status} ${res.statusText} ${text}`);
  }
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage;
  
  return { content, usage };
}
