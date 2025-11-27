import { doc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';

type Message = { role: string; content: string | any[] };

export interface CerebrasChatParams {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

let cachedKey: string | null = null;
let cachedUid: string | null = null;
let cachedKeySource: 'app' | 'user' | null = null;

async function fetchGlobalKey(): Promise<string> {
  const ref = doc(firestore, 'api', 'cerebras');
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() as any : null;
  const key = data?.key || null;
  if (!key || typeof key !== 'string') throw new Error('Cerebras API key not found (api/cerebras.key)');
  return key;
}

async function fetchUserKey(uid: string | null): Promise<string | null> {
  if (!uid) return null;
  const ref = doc(firestore, 'users', uid, 'api', 'cerebras');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  const enabled = !!data?.enabled;
  const key = typeof data?.key === 'string' ? data.key.trim() : '';
  return enabled && key ? key : null;
}

export async function getCerebrasKey(): Promise<string> {
  const uid = auth?.currentUser?.uid || null;
  if (cachedKey && cachedUid === uid) return cachedKey;
  let key = await fetchUserKey(uid);
  if (key) {
    cachedKeySource = 'user';
  } else {
    key = await fetchGlobalKey();
    cachedKeySource = 'app';
  }
  cachedKey = key; cachedUid = uid; return key;
}

export function resetCerebrasCache() { cachedKey = null; cachedUid = null; cachedKeySource = null; }

function capTokens(requested?: number): number {
  const HARD_MAX = 8192; // Cerebras has a lower limit
  const v = typeof requested === 'number' && isFinite(requested) && requested > 0 ? Math.floor(requested) : 4096;
  return Math.min(HARD_MAX, Math.max(1, v));
}

export async function cerebrasChatCompletion({ model, messages, temperature = 0.7, max_tokens = 8192, top_p = 0.8 }: CerebrasChatParams): Promise<{ content: string; usage?: any }> {
  const key = await getCerebrasKey();

  // Call Cerebras API directly
  const url = 'https://api.cerebras.ai/v1/chat/completions';

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p,
        max_tokens: capTokens(max_tokens),
        stream: false
      })
    });
  } catch (err: any) {
    // Check if it's a network/CORS error
    if (err?.message?.includes('Load failed') || err?.message?.includes('NetworkError')) {
      throw new Error('Unable to connect to Cerebras API. Please check your network connection or try a different model.');
    }
    throw new Error(`Cerebras request failed: ${err?.message || err}`);
  }

  if (!res.ok) {
    let errorMsg = `Cerebras API error ${res.status}`;
    try {
      const data = await res.json();
      const errPayload = (data && data.error) ? data.error : data;
      errorMsg = typeof errPayload === 'string' ? errPayload : (errPayload?.message || JSON.stringify(errPayload || {}));
    } catch {
      const text = await res.text().catch(() => '');
      if (text) errorMsg = text;
    }
    throw new Error(errorMsg);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid response from Cerebras API');
  }

  const content = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage;
  return { content, usage };
}

// Streaming support for Cerebras
export async function cerebrasStreamCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  top_p = 0.8,
  onDelta,
  onDone,
  signal
}: CerebrasChatParams & {
  onDelta?: (text: string) => void;
  onDone?: (fullText: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const key = await getCerebrasKey();
  const url = 'https://api.cerebras.ai/v1/chat/completions';

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p,
        max_tokens: capTokens(max_tokens),
        stream: true
      }),
      signal
    });
  } catch (err: any) {
    if (err?.message?.includes('Load failed') || err?.message?.includes('NetworkError')) {
      throw new Error('Unable to connect to Cerebras API. Please check your network connection or try a different model.');
    }
    throw new Error(`Cerebras streaming failed: ${err?.message || err}`);
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cerebras streaming failed: ${res.status} ${text}`);
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

