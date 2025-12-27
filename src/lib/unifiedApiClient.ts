/**
 * Unified API Client for SwitchAI
 * 
 * This client communicates with the AI server's unified endpoints:
 * - POST /api/chat - Non-streaming chat completion
 * - POST /api/chat/stream - Streaming chat completion (SSE)
 * - GET /api/models - Get available models
 * - POST /api/auto-switch - Auto-switch model based on input
 * - GET /api/status - Server status
 * - GET /api/health - Health check
 * 
 * The server handles all provider routing (Groq, Cerebras, Mistral, Gemini)
 * automatically based on the model ID or 'auto' mode.
 */

// Server base URL
const API_BASE = 'https://ai.collegebuzz.in';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

/**
 * Custom error for tier restrictions
 */
export class TierRestrictionError extends Error {
  public readonly code: string;
  public readonly requiredTier: string;
  public readonly userTier: string;

  constructor(message: string, code: string, requiredTier: string, userTier: string) {
    super(message);
    this.name = 'TierRestrictionError';
    this.code = code;
    this.requiredTier = requiredTier;
    this.userTier = userTier;
  }
}


export interface ChatCompletionParams {
  model: string; // Model ID or 'auto' for automatic selection
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  signal?: AbortSignal;
}

export interface StreamCompletionParams extends ChatCompletionParams {
  onDelta?: (text: string) => void;
  onDone?: (fullText: string) => void;
  onStatus?: (status: string) => void;
  uid?: string;
  chatId?: string;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  latency_ms?: number;
  request_id?: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  type: 'text' | 'vision' | 'reason';
  inference?: string;
  provider?: string;
}

export interface ServerStatus {
  status: string;
  timestamp: number;
  uptime?: number;
  requests?: {
    total: number;
    errors: number;
    avgResponseTime: number;
  };
}

export interface AutoSwitchResult {
  modelId: string | null;
  switched: boolean;
  intent: string;
  message?: string;
  inference?: string;
  timestamp: number;
}

/**
 * Stream chat completion via the unified API endpoint
 * The server automatically routes to the correct provider
 */
export async function unifiedStreamCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  top_p = 0.95,
  signal,
  onDelta,
  onDone,
  onStatus,
  uid,
  chatId,
}: StreamCompletionParams): Promise<string> {
  const url = `${API_BASE}/api/chat/stream`;

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
      uid,
      chatId,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');

    // Check for tier restriction error (403)
    if (res.status === 403) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.error?.code === 'model_tier_restricted') {
          throw new TierRestrictionError(
            errorData.error.message || 'This model is available for pro users only',
            errorData.error.code,
            errorData.error.requiredTier || 'pro',
            errorData.error.userTier || 'free'
          );
        }
      } catch (e) {
        if (e instanceof TierRestrictionError) {
          throw e;
        }
        // If parsing fails, fall through to generic error
      }
    }

    throw new Error(`API request failed: ${res.status} ${text}`);
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

          // Check for ready signal (initial connection)
          if (json.ready) {
            continue;
          }

          // Check for error
          if (json.error) {
            throw new Error(json.error);
          }

          // Check for status update
          if (json.status && onStatus) {
            onStatus(json.status);
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

/**
 * Non-streaming chat completion via the unified API endpoint
 */
export async function unifiedChatCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 8192,
  top_p = 0.95,
  signal,
}: ChatCompletionParams): Promise<ChatCompletionResponse> {
  const url = `${API_BASE}/api/chat`;

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
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    // Check for tier restriction error (403)
    if (res.status === 403) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.error?.code === 'model_tier_restricted') {
          throw new TierRestrictionError(
            errorData.error.message || 'This model is available for pro users only',
            errorData.error.code,
            errorData.error.requiredTier || 'pro',
            errorData.error.userTier || 'free'
          );
        }
      } catch (e) {
        if (e instanceof TierRestrictionError) {
          throw e;
        }
        // If parsing fails, fall through to generic error
      }
    }

    throw new Error(`API request failed: ${res.status} ${text}`);
  }


  return res.json();
}

/**
 * Get available models from the server
 */
export async function fetchModels(): Promise<ModelInfo[]> {
  const url = `${API_BASE}/api/models`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status}`);
  }

  const data = await res.json();
  return data.models || [];
}

/**
 * Request server-side auto model switch based on input
 */
export async function requestAutoSwitch(
  input: string,
  hasImages: boolean = false,
  conversationLength: number = 0,
  currentModel: string | null = null
): Promise<AutoSwitchResult> {
  const url = `${API_BASE}/api/auto-switch`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      hasImages,
      conversationLength,
      currentModel,
    }),
  });

  if (!res.ok) {
    throw new Error(`Auto-switch request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Get server status and health metrics
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const url = `${API_BASE}/api/status`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Status request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Check server health
 */
export async function checkServerHealth(): Promise<{ status: string; timestamp: number }> {
  const url = `${API_BASE}/api/health`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  return res.json();
}

/**
 * Get user tier/plan from server
 */
export async function fetchUserTier(uid: string): Promise<{ plan: 'free' | 'lite' | 'pro' }> {
  const url = `${API_BASE}/api/user/tier`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ uid }),
  });

  if (!res.ok) {
    console.warn(`Failed to fetch user tier: ${res.status}`);
    return { plan: 'free' };
  }

  return res.json();
}

/**
 * Helper to determine if we should use auto mode
 */
export function shouldUseAutoMode(): boolean {
  try {
    const autoEnabled = localStorage.getItem('autoModelSwitch');
    return autoEnabled !== 'false'; // Default to true
  } catch {
    return true;
  }
}
