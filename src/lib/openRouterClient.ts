import { doc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';

interface StreamOptions {
  model: string;
  messages: Array<{ role: string; content: string | any[] }>;
  temperature?: number;
  max_tokens?: number;
  onDelta?: (text: string) => void;
  onDone?: (fullText: string) => void;
  signal?: AbortSignal;
}

let cachedKey: string | null = null;

export function resetOpenRouterCache() {
  cachedKey = null;
}

async function fetchOpenRouterKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  try {
    // Try user-specific key first
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const userRef = doc(firestore, 'users', uid, 'api', 'openrouter');
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const udata: any = userSnap.data();
          if (udata?.enabled && typeof udata?.key === 'string' && udata.key) {
            cachedKey = udata.key;
            return udata.key;
          }
        }
      }
    } catch (e) {
      // non-fatal: fall back to global
      console.warn('User OpenRouter key lookup failed, falling back to global.', e);
    }

    // Fallback to global key
    const ref = doc(firestore, 'api', 'openrouter');
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    const key = data?.key || null;
    if (!key || typeof key !== 'string') {
      throw new Error('OpenRouter API key not found');
    }
    cachedKey = key;
    return key;
  } catch (error) {
    console.error('Failed to fetch OpenRouter API key:', error);
    throw error;
  }
}

export async function openRouterStreamCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  onDelta,
  onDone,
  signal
}: StreamOptions): Promise<string> {
  const apiKey = await fetchOpenRouterKey();
  
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'SwitchAi Web',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    }),
    signal,
  });
  
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed: ${res.status} ${text}`);
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

export async function openRouterChatCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
}: Omit<StreamOptions, 'onDelta' | 'onDone' | 'signal'>): Promise<{ content: string; usage?: any }> {
  const apiKey = await fetchOpenRouterKey();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'SwitchAi Web',
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
    throw new Error(`OpenRouter request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage;
  return { content, usage };
}
