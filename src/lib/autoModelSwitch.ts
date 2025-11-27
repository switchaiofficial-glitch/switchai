import { firestore } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

// Keep the interface compatible with the rest of the app
export interface ModelEntry {
  id: string;
  label: string;
  type: 'text' | 'vision' | 'reason';
  hasReasoning?: boolean;
  inference?: 'groq' | 'openrouter' | 'cerebras' | 'mistral' | 'google';
  supportsVision?: boolean;
  provider?: string;
  raw?: any;
}

export const QueryIntent = {
  CODE: 'code',
  MATH_LOGIC: 'math_logic',
  REASONING: 'reasoning',
  CREATIVE: 'creative',
  FAST_CHAT: 'fast_chat',
  SUMMARY: 'summary',
  KNOWLEDGE: 'knowledge',
  VISION: 'vision',
  GENERAL: 'general',
} as const;

export type QueryIntentType = typeof QueryIntent[keyof typeof QueryIntent];

// Provider characteristics for intelligent fallbacks
const PROVIDER_CHARACTERISTICS = {
  cerebras: { speed: 'fastest', reliability: 'medium', trafficErrors: true, avgTokensPerSecond: 2000 },
  groq: { speed: 'fast', reliability: 'high', trafficErrors: false, avgTokensPerSecond: 1500 },
  mistral: { speed: 'medium', reliability: 'high', trafficErrors: false, avgTokensPerSecond: 250 },
  gemini: { speed: 'slow', reliability: 'high', trafficErrors: false, avgTokensPerSecond: 100 },
  openrouter: { speed: 'medium', reliability: 'low', trafficErrors: false, avgTokensPerSecond: 500 },
  local: { speed: 'medium', reliability: 'high', trafficErrors: false, avgTokensPerSecond: 300 },
};

// Keywords for intent detection
const INTENT_KEYWORDS = {
  [QueryIntent.CODE]: {
    high: ['write a function', 'create a class', 'debug this', 'fix the code', 'implement', 'algorithm'],
    medium: ['function', 'class', 'method', 'variable', 'api', 'library', 'debug', 'error', 'bug'],
    low: ['code', 'programming', 'script', 'python', 'javascript', 'java', 'typescript', 'react']
  },
  [QueryIntent.MATH_LOGIC]: {
    high: ['solve this equation', 'calculate', 'prove that', 'compute', 'mathematical proof'],
    medium: ['equation', 'formula', 'theorem', 'proof', 'algebra', 'calculus', 'integral'],
    low: ['math', 'mathematics', 'logic', 'statistics', 'geometry', 'calculate', 'solve']
  },
  [QueryIntent.VISION]: {
    high: ['analyze this image', 'what do you see', 'describe the image'],
    medium: ['image', 'picture', 'photo', 'visual', 'look at'],
    low: ['see', 'shown', 'display']
  },
  [QueryIntent.FAST_CHAT]: {
    high: ['yes or no', 'quick answer', 'in short', 'briefly'],
    medium: ['hi', 'hello', 'hey', 'thanks', 'okay', 'cool', 'nice'],
    low: ['quick', 'fast', 'short', 'brief', 'simple']
  }
};

// Cached models to avoid frequent Firebase queries
let cachedModels: ModelEntry[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch available models from Firebase
 */
export async function fetchAvailableModels(): Promise<ModelEntry[]> {
  const now = Date.now();

  // Return cached models if still fresh
  if (cachedModels && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedModels;
  }

  try {
    const snap = await getDocs(collection(firestore, 'models'));
    const models = snap.docs.map(doc => {
      const data = doc.data();
      // Normalize fields dynamically so changes in Firestore don't break selection
      const rawInference = String(data.inference || '').toLowerCase().trim();
      // Map 'google' -> 'gemini' so server "google genai" support is recognized as gemini family
      const normalizedInference = rawInference === 'google' ? 'gemini' : rawInference;
      const rawType = String(data.type || 'text').toLowerCase().trim();
      const normalizedType = ['text', 'vision', 'reason'].includes(rawType) ? rawType : 'text';

      return {
        id: String(data.modelID || '').trim(),
        label: String(data.model || data.modelID || '').trim(),
        type: normalizedType as 'text' | 'vision' | 'reason',
        provider: data.provider || data.provied || '',
        inference: normalizedInference as any,
        raw: data
      };
    }).filter(m => m.id);

    cachedModels = models;
    lastFetchTime = now;

    console.log(`[MODEL-FETCH] Loaded ${models.length} models from Firebase`);
    return models;
  } catch (error) {
    console.error('[MODEL-FETCH] Error fetching models:', error);
    return cachedModels || []; // Return cached models or empty array on error
  }
}

/**
 * Detect query intent from user input
 */
export function detectQueryIntent(input: string, hasImages = false, conversationLength = 0): { intent: QueryIntentType; isComplexVision?: boolean } {
  const text = input.toLowerCase().trim();

  // Vision intent (only if explicitly requested or analyzing images)
  if (hasImages) {
    const imageGenerationKeywords = [
      'generate', 'create', 'make', 'draw', 'paint', 'sketch', 'design', 'render',
      'image of', 'picture of', 'photo of', 'art of', 'illustration of', 'drawing of'
    ];

    const imageAnalysisKeywords = [
      'analyze', 'detailed', 'explain', 'complex', 'intricate', 'compare',
      'differences', 'similarities', 'identify', 'count', 'measure', 'what is', 'describe'
    ];

    // Check if the message is about generating an image
    const isImageGeneration = imageGenerationKeywords.some(keyword =>
      text.includes(keyword) ||
      text.startsWith(keyword + ' ') ||
      text.endsWith(' ' + keyword) ||
      text.includes(' ' + keyword + ' ')
    );

    // Check if the message is about analyzing an existing image
    const isImageAnalysis = imageAnalysisKeywords.some(keyword =>
      text.includes(keyword) ||
      text.startsWith(keyword + ' ') ||
      text.endsWith(' ' + keyword) ||
      text.includes(' ' + keyword + ' ')
    );

    // Only return VISION intent if it's explicitly about images
    if (isImageGeneration || isImageAnalysis) {
      return {
        intent: QueryIntent.VISION,
        isComplexVision: isImageAnalysis  // Only complex if it's analysis, not generation
      };
    }
    // Otherwise, continue with normal intent detection
  }

  // Fast chat (short simple queries)
  if (text.length < 15 && conversationLength < 3) {
    const greetings = ['hi', 'hello', 'hey', 'thanks', 'okay', 'ok', 'cool', 'nice'];
    if (greetings.some(g => text === g || text.startsWith(g + ' ') || text.endsWith(' ' + g))) {
      return { intent: QueryIntent.FAST_CHAT };
    }
  }

  // Score-based intent detection
  const scores: Record<string, number> = {};
  Object.values(QueryIntent).forEach(intent => scores[intent] = 0);

  // Calculate weighted scores
  Object.entries(INTENT_KEYWORDS).forEach(([intent, keywords]) => {
    keywords.high?.forEach(phrase => {
      if (text.includes(phrase)) scores[intent] += 5;
    });
    keywords.medium?.forEach(keyword => {
      if (text.includes(keyword)) scores[intent] += 2;
    });
    keywords.low?.forEach(keyword => {
      if (text.includes(keyword)) scores[intent] += 1;
    });
  });

  // Pattern-based detection (code)
  if (/```[\w]*\n|\bfunction\b|\bclass\b|\bdef\b|\bconst\b|\blet\b|\bvar\b/.test(text)) {
    scores[QueryIntent.CODE] += 10;
  }
  // Pattern-based detection (math)
  if (/\d+\s*[\+\-\*\/\^=]\s*\d+|\d+\s*\(|integral|derivative|limit\s*\(|sqrt|summation|sigma|pi\b|matrix|vector/.test(text)) {
    scores[QueryIntent.MATH_LOGIC] += 8;
  }
  if (/^(summarize|tldr|give me (a )?summary)/.test(text)) {
    scores[QueryIntent.SUMMARY] += 10;
  }
  if (/^(what is|who is|when (did|was)|where is|how (does|did|do))/.test(text)) {
    scores[QueryIntent.KNOWLEDGE] += 8;
  }

  // Additional keyword boosts (synonyms/short prompts)
  if (/(maths|math|solve|equation|calculation|compute|proof|theorem)\b/.test(text)) {
    scores[QueryIntent.MATH_LOGIC] += 3;
  }
  if (/(code|coding|program|script|python|javascript|typescript|java|golang|go|c\+\+|c#|rust|react|node)\b/.test(text)) {
    scores[QueryIntent.CODE] += 4;
  }

  // Find highest scoring intent
  let maxScore = 0;
  let detectedIntent = QueryIntent.GENERAL;

  Object.entries(scores).forEach(([intent, score]) => {
    if (score > maxScore) {
      maxScore = score;
      detectedIntent = intent as QueryIntentType;
    }
  });

  // Early decisive overrides for common short prompts
  if (scores[QueryIntent.CODE] >= 5) {
    return { intent: QueryIntent.CODE };
  }
  if (scores[QueryIntent.MATH_LOGIC] >= 5) {
    return { intent: QueryIntent.MATH_LOGIC };
  }

  const finalIntent = maxScore >= 2 ? detectedIntent : QueryIntent.GENERAL;
  return { intent: finalIntent };
}

/**
 * Calculate similarity score for fuzzy model matching
 */
function getSimilarityScore(modelId: string, preferredId: string): number {
  const m = modelId.toLowerCase();
  const p = preferredId.toLowerCase();

  if (m === p) return 100;

  const modelName = m.split('/').pop() || m;
  const prefName = p.split('/').pop() || p;

  if (modelName.includes(prefName)) return 80;
  if (prefName.includes(modelName)) return 75;

  const modelTokens = modelName.split(/[-_]/);
  const prefTokens = prefName.split(/[-_]/);

  let matchCount = 0;
  for (const token of modelTokens) {
    if (prefTokens.some(pt => pt.includes(token) || token.includes(pt))) {
      matchCount++;
    }
  }

  return matchCount > 0 ? 50 + (matchCount * 10) : 0;
}

/**
 * Curated, ordered selection restricted to requested models only
 * Provider preference: Groq > Cerebras (Codestral via Mistral)
 */
const PROVIDER_PRIORITY = ['cerebras', 'groq', 'mistral'];

const GROUP_PATTERNS = {
  // Fast instant replies
  llama8b: ['llama-3.1-8b-instant', 'llama3.1-8b'],
  // Dumb quick answers
  oss20b: ['openai/gpt-oss-20b', 'gpt-oss-20b'],
  // Little higher-level
  llama70b: ['llama-3.3-70b-versatile', 'llama-3.3-70b'],
  // Quick reasoning tasks
  qwen32b: ['qwen/qwen3-32b', 'qwen-3-32b'],
  // Complex math / general complex
  oss120b: ['openai/gpt-oss-120b', 'gpt-oss-120b'],
  // Coding
  codestral: ['codestral-latest'],
  qwenInstruct: ['qwen-3-235b-a22b-instruct', 'instruct-2507'],
  // Vision (images)
  llamaScoutVision: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-4-scout']
};

function matchesAny(model: ModelEntry, patterns: string[]) {
  const id = (model.id || '').toLowerCase();
  const label = (model.label || '').toLowerCase();
  return patterns.some(p => id.includes(p) || label.includes(p));
}

function pickFromGroup(patternKey: keyof typeof GROUP_PATTERNS, models: ModelEntry[]): ModelEntry | null {
  const patterns = GROUP_PATTERNS[patternKey] || [];
  const candidates = models.filter(m => matchesAny(m, patterns));
  if (candidates.length === 0) return null;
  // Prefer providers by priority
  for (const pref of PROVIDER_PRIORITY) {
    const byProvider = candidates.find(c => (c.inference || '').toLowerCase() === pref);
    if (byProvider) return byProvider;
  }
  // Fallback to first candidate
  return candidates[0];
}

export function selectBestModel(intent: QueryIntentType, availableModels: ModelEntry[], isComplexVision = false): ModelEntry | null {
  if (!availableModels || availableModels.length === 0) return null;

  // Only consider supported inferences and the curated set
  const supported = availableModels.filter(m => ['groq', 'cerebras', 'mistral'].includes((m.inference || '').toLowerCase()));
  if (supported.length === 0) return null;

  // Vision: use Groq's Llama Scout when input has image
  if (intent === QueryIntent.VISION) {
    const scout = pickFromGroup('llamaScoutVision', supported);
    if (scout) return scout;
    // If not found, no other models are allowed per spec; return null
    return null;
  }

  // Build ordered groups per intent as requested
  let order: (keyof typeof GROUP_PATTERNS)[] = [];
  switch (intent) {
    case QueryIntent.FAST_CHAT:
      order = ['llama8b', 'oss20b', 'llama70b', 'qwen32b', 'oss120b'];
      break;
    case QueryIntent.MATH_LOGIC:
      order = ['oss120b', 'qwen32b', 'llama70b', 'llama8b'];
      break;
    case QueryIntent.REASONING:
      order = ['qwen32b', 'oss120b', 'llama70b'];
      break;
    case QueryIntent.CODE:
      order = ['codestral', 'qwenInstruct'];
      break;
    case QueryIntent.GENERAL:
    case QueryIntent.KNOWLEDGE:
    case QueryIntent.SUMMARY:
    case QueryIntent.CREATIVE:
      // Default/general flows: little higher-level first, then complex
      order = ['llama70b', 'oss120b', 'qwen32b', 'llama8b'];
      break;
    default:
      order = ['llama70b', 'qwen32b', 'llama8b'];
  }

  for (const key of order) {
    const picked = pickFromGroup(key, supported);
    if (picked) return picked;
  }

  return null;
}

const AUTO_SWITCH_STORAGE_KEY = 'autoModelSwitch:enabled';

export function isAutoSwitchEnabled(): boolean {
  try {
    const value = localStorage.getItem(AUTO_SWITCH_STORAGE_KEY);
    if (value === null) {
      setAutoSwitchEnabled(true);
      return true;
    }
    return value === 'true';
  } catch {
    return true;
  }
}

export function setAutoSwitchEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SWITCH_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save auto-switch state:', error);
  }
}

/**
 * Auto-switch model based on input analysis
 * Kept synchronous signature for compatibility with HomeScreen.tsx
 */
export function autoSwitchModel(
  input: string,
  availableModels: ModelEntry[],
  hasImages: boolean = false,
  conversationLength: number = 0,
  currentModel?: string
): string | null {
  const enabled = isAutoSwitchEnabled();
  if (!enabled) return null;

  const { intent, isComplexVision } = detectQueryIntent(input, hasImages, conversationLength);

  console.log(`[AUTO-SWITCH] Intent: ${intent}, Complex Vision: ${!!isComplexVision}`);

  const selectedModel = selectBestModel(intent, availableModels, isComplexVision);

  if (selectedModel && selectedModel.id !== currentModel) {
    console.log(`🔄 Switching to ${selectedModel.id}`);
    return selectedModel.id;
  }

  return null;
}

/**
 * Get available models for client (with server health filtering)
 */
export async function getAvailableModelsForClient(): Promise<ModelEntry[]> {
  try {
    const models = await fetchAvailableModels();

    // Filter models based on what this server can handle
    const serverSupportedInferences = ['cerebras', 'mistral', 'gemini', 'google', 'groq'];
    const serverModels = models.filter(m =>
      serverSupportedInferences.includes((m.inference || '').toLowerCase())
    );

    console.log(`[MODELS-API] Returning ${serverModels.length} server-supported models (incl. Groq/Gemini)`);
    return serverModels;
  } catch (error) {
    console.error('[MODELS-API] Error fetching models:', error);
    return [];
  }
}
