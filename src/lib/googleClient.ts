import { doc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';

interface StreamOptions {
  model: string;
  messages: Array<{ role: string; content: string | any[] }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  onDelta?: (text: string) => void;
  onDone?: (fullText: string) => void;
  signal?: AbortSignal;
}

let cachedKey: string | null = null;
let cachedUid: string | null = null;

export function resetGoogleCache() {
  cachedKey = null;
  cachedUid = null;
}

async function fetchGoogleKey(): Promise<string> {
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid || null;

  // If user changed, invalidate cache
  if (uid !== cachedUid) {
    cachedKey = null;
    cachedUid = uid;
  }

  // Return cached key if available
  if (cachedKey) {
    return cachedKey;
  }

  // Try user-specific key first
  if (uid) {
    try {
      const userRef = doc(firestore, 'users', uid, 'api', 'gemini');
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const udata: any = userSnap.data();
        if (udata?.key && typeof udata.key === 'string') {
          cachedKey = udata.key;
          return udata.key;
        }
      }
    } catch (e) {
      console.warn('User Gemini key lookup failed, falling back to global.', e);
    }
  }

  // Fallback to global key
  const ref = doc(firestore, 'api', 'gemini');
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : null;
  const key = data?.key || null;
  if (!key || typeof key !== 'string') {
    throw new Error('Gemini API key not found');
  }
  cachedKey = key;
  return key;
}

// Proxy server base URL
function getProxyBase(): string {
  // Use production server for web
  return 'https://ai.collegebuzz.in';
}

export async function googleStreamCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  top_p = 0.95,
  onDelta,
  onDone,
  signal
}: StreamOptions): Promise<string> {
  const apiKey = await fetchGoogleKey();
  const base = getProxyBase();
  const url = `${base}/gemini/chat/stream`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p,
      max_tokens,
      apiKey,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini request failed: ${res.status} ${text}`);
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

        const payload = line.slice(5).trim();
        if (!payload) continue;

        try {
          const json = JSON.parse(payload);
          
          // Check for done signal
          if (json.done) {
            if (onDone) onDone(fullText);
            return fullText;
          }

          // Check for error
          if (json.error) {
            throw new Error(json.error);
          }

          // Extract delta
          const delta = json.delta || '';
          if (delta) {
            fullText += delta;
            if (onDelta) onDelta(delta);
          }
        } catch (e) {
          // Skip invalid JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (onDone) onDone(fullText);
  return fullText;
}

export async function googleChatCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  top_p = 0.95,
}: Omit<StreamOptions, 'onDelta' | 'onDone' | 'signal'>): Promise<{ content: string; usage?: any }> {
  const apiKey = await fetchGoogleKey();
  const base = getProxyBase();
  const url = `${base}/gemini/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p,
      max_tokens,
      apiKey,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data?.text || data?.content || '';
  const usage = data?.usage;

  return { content, usage };
}
