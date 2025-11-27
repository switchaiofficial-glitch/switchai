/**
 * AI Memory Service for Website
 * Stores and retrieves user preferences and context
 */

const MEMORY_DOC_KEY = 'aiMemory:v2:document';
const ENABLED_KEY = 'userMemory:v1:enabled';
const PENDING_UPDATES_KEY = 'aiMemory:v2:pendingUpdates';

export type MemoryDocument = {
  content: string;
  lastUpdated: number;
  version: number;
};

export type PendingUpdate = {
  text: string;
  timestamp: number;
};

let memoryDoc: MemoryDocument | null = null;
let loaded = false;

const now = () => Date.now();
const safeText = (s: any) => String(s || '').trim();

/**
 * Check if memory is enabled
 */
export function isMemoryEnabled(): boolean {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    if (v === null) {
      setMemoryEnabled(true);
      return true;
    }
    return v === '1' || v === 'true';
  } catch {
    return true;
  }
}

/**
 * Enable or disable memory
 */
export function setMemoryEnabled(value: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, value ? '1' : '0');
  } catch {}
}

/**
 * Load memory document
 */
async function loadMemoryDoc(): Promise<void> {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(MEMORY_DOC_KEY);
    if (!raw) {
      memoryDoc = {
        content: '',
        lastUpdated: now(),
        version: 1
      };
    } else {
      memoryDoc = JSON.parse(raw) as MemoryDocument;
    }
  } catch {
    memoryDoc = {
      content: '',
      lastUpdated: now(),
      version: 1
    };
  }
  loaded = true;
}

/**
 * Save memory document
 */
async function saveMemoryDoc(): Promise<void> {
  if (!memoryDoc) return;
  try {
    localStorage.setItem(MEMORY_DOC_KEY, JSON.stringify(memoryDoc));
  } catch {}
}

/**
 * Get pending updates
 */
async function getPendingUpdates(): Promise<PendingUpdate[]> {
  try {
    const raw = localStorage.getItem(PENDING_UPDATES_KEY);
    if (!raw) return [];
    const updates = JSON.parse(raw) as PendingUpdate[];
    return Array.isArray(updates) ? updates : [];
  } catch {
    return [];
  }
}

/**
 * Save pending updates
 */
async function savePendingUpdates(updates: PendingUpdate[]): Promise<void> {
  try {
    localStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(updates));
  } catch {}
}

/**
 * Add pending update
 */
async function addPendingUpdate(text: string): Promise<void> {
  const updates = await getPendingUpdates();
  updates.push({ text: safeText(text), timestamp: now() });
  await savePendingUpdates(updates);
}

/**
 * Clear pending updates
 */
async function clearPendingUpdates(): Promise<void> {
  try {
    localStorage.removeItem(PENDING_UPDATES_KEY);
  } catch {}
}

/**
 * Check if text is relevant for memory (matches mobile app logic)
 */
function isRelevant(text: string): boolean {
  const t = safeText(text).toLowerCase();
  if (!t) {
    console.log('[AI Memory] isRelevant: empty text');
    return false;
  }
  if (t.length < 10) {
    console.log('[AI Memory] isRelevant: text too short (<10 chars)');
    return false;
  }
  
  // Greetings and common short phrases (REJECT)
  if (/^(hi|hello|hey|hola|yo|sup|greetings|good morning|good afternoon|good evening|good night)[\s!.?]*$/i.test(t)) return false;
  if (/^(thanks|thank you|thx|ty|ok|okay|sure|yes|no|yep|nope|yeah|nah)[\s!.?]*$/i.test(t)) return false;
  if (/^(got it|i see|understood|alright|cool|nice|great|awesome)[\s!.?]*$/i.test(t)) return false;
  
  // Questions and requests (REJECT)
  if (/\b(what is|what's|who is|who's|how do|how to|can you|could you|would you|will you|please|explain|tell me|show me|why|when|where)\b/i.test(t)) return false;
  if (/\b(help me|assist|generate|create|write|make me|give me|find|search|look up)\b/i.test(t)) return false;
  if (/(forget|ignore)\s+(that|this|what i said)/i.test(t)) return false;
  
  // Conversational/ephemeral statements (REJECT)
  if (/^(i think|i believe|maybe|perhaps|probably|i guess|i wonder|i don't know|not sure)/i.test(t)) return false;
  if (/\b(right now|at the moment|currently|today|this time|just now)\b/i.test(t)) return false;

  // Strong positive cues (ACCEPT)
  if (/^remember\b/.test(t) || /\bremember that\b/.test(t) || /\bplease remember\b/.test(t)) return true;
  if (/\b(make|take) a note\b/.test(t) || /\bsave (this|that)\b/.test(t) || /\bnote (that|this)\b/.test(t) || /\bkeep in mind\b/.test(t)) return true;

  // Profile/preferences/facts (ACCEPT)
  if (/\bmy name is\b/.test(t) || /^call me\b/.test(t)) return true;
  if (/\bi (live in|am from|work at|study at|always use|always prefer|really like|really love)\b/.test(t)) return true;
  if (/\b(i am|i'?m)\s+\d{1,3}(\s*(years?|yrs?|yo)\b)?/.test(t)) return true;
  if (/\bmy age\s*(is|:)\s*\d{1,3}\b/.test(t)) return true;
  if (/\bmy (birthday|age|email|phone|timezone|device|language|pronouns|job|role|team|occupation|profession)\b/.test(t)) return true;
  if (/\b(answer style|tone:)\b/.test(t) || /\bspeak like\b/.test(t)) return true;

  console.log('[AI Memory] isRelevant: rejected (does not match any patterns)');
  return false;
}

/**
 * Initialize memory document
 */
export async function initMemoryDocument(): Promise<void> {
  await loadMemoryDoc();
}

/**
 * Get memory document
 */
export async function getMemoryDocument(): Promise<MemoryDocument | null> {
  await loadMemoryDoc();
  return memoryDoc;
}

/**
 * Clear memory document
 */
export async function clearMemoryDocument(): Promise<void> {
  memoryDoc = {
    content: '',
    lastUpdated: now(),
    version: 1
  };
  await saveMemoryDoc();
  await clearPendingUpdates();
}

/**
 * Store user message in memory if relevant
 */
export async function maybeStoreFromUserMessage(text: string): Promise<void> {
  console.log('[AI Memory] maybeStoreFromUserMessage called with:', text?.substring(0, 100));
  if (!isMemoryEnabled()) {
    console.log('[AI Memory] Memory is disabled');
    return;
  }
  if (!isRelevant(text)) {
    console.log('[AI Memory] Text not relevant for memory');
    return;
  }
  
  console.log('[AI Memory] Adding to pending updates');
  await addPendingUpdate(text);
  console.log('[AI Memory] Successfully added to pending updates');
}

/**
 * Process pending updates (simplified for web)
 * Returns object with success status and count of updates processed
 */
export async function processPendingUpdates(): Promise<{ success: boolean; count: number; message: string }> {
  console.log('[AI Memory] processPendingUpdates called');
  
  if (!isMemoryEnabled()) {
    console.log('[AI Memory] Memory is disabled');
    return { success: false, count: 0, message: 'AI Memory is disabled' };
  }
  
  const updates = await getPendingUpdates();
  console.log('[AI Memory] Found', updates.length, 'pending updates');
  
  if (updates.length === 0) {
    return { success: false, count: 0, message: 'No pending updates found. Start chatting and mention things you want remembered!' };
  }
  
  await loadMemoryDoc();
  if (!memoryDoc) {
    console.log('[AI Memory] Failed to load memory document');
    return { success: false, count: 0, message: 'Failed to load memory document' };
  }
  
  // Simple concatenation for web (no AI processing)
  const newContent = updates.map(u => u.text).join('\n');
  
  if (memoryDoc.content) {
    memoryDoc.content += '\n' + newContent;
  } else {
    memoryDoc.content = newContent;
  }
  
  memoryDoc.lastUpdated = now();
  memoryDoc.version++;
  
  await saveMemoryDoc();
  await clearPendingUpdates();
  
  console.log('[AI Memory] Successfully processed', updates.length, 'updates');
  return { success: true, count: updates.length, message: `Successfully processed ${updates.length} update${updates.length > 1 ? 's' : ''}` };
}

/**
 * Get memory for context injection
 */
export async function getMemoryForContext(): Promise<string> {
  if (!isMemoryEnabled()) return '';
  
  await loadMemoryDoc();
  if (!memoryDoc || !memoryDoc.content) return '';
  
  return memoryDoc.content;
}

/**
 * Get count of pending updates
 */
export async function getPendingUpdatesCount(): Promise<number> {
  const updates = await getPendingUpdates();
  return updates.length;
}

/**
 * Build memory system prompt
 */
export async function buildMemorySystemPrompt(): Promise<string | null> {
  const memory = await getMemoryForContext();
  if (!memory) return null;
  
  return `CONTEXT: Here is what you know about the user from previous conversations:

${memory}

Use this information to provide personalized and contextually relevant responses. Do not explicitly mention that you have this information unless directly relevant to the conversation.`;
}
