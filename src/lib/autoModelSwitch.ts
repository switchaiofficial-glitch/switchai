/**
 * Auto Model Switch Service for Website
 * Intelligently selects the best AI model based on user input type
 */

const AUTO_SWITCH_STORAGE_KEY = 'autoModelSwitch:enabled';

export interface ModelEntry {
  id: string;
  label: string;
  type: 'text' | 'vision' | 'reason';
  hasReasoning?: boolean;
  inference?: 'groq' | 'openrouter' | 'cerebras' | 'mistral' | 'google';
  supportsVision?: boolean;
}

export enum QueryIntent {
  CODE = 'code',
  MATH_LOGIC = 'math_logic',
  REASONING = 'reasoning',
  CREATIVE = 'creative',
  FAST_CHAT = 'fast_chat',
  SUMMARY = 'summary',
  KNOWLEDGE = 'knowledge',
  VISION = 'vision',
  GENERAL = 'general',
}

// Model preferences for each intent (excluding OpenRouter)
const MODEL_PREFERENCES = {
  [QueryIntent.CODE]: [
    'qwen-3-coder-480b', 'codestral-latest',
    'qwen-3-235b-a22b-instruct-2507', 'qwen/qwen3-32b', 'qwen-3-32b',
    'llama-3.3-70b', 'llama-3.3-70b-versatile',
    'gpt-oss-120b', 'openai/gpt-oss-120b',
  ],
  [QueryIntent.MATH_LOGIC]: [
    'gpt-oss-120b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b',
    'qwen-3-235b-a22b-thinking-2507', 'qwen-3-32b', 'qwen/qwen3-32b',
    'llama-4-scout-17b-16e-instruct',
    'qwen-3-235b-a22b-instruct-2507',
    'mistral-large-latest',
  ],
  [QueryIntent.REASONING]: [
    'gpt-oss-120b', 'openai/gpt-oss-120b',
    'qwen-3-235b-a22b-thinking-2507',
    'qwen-3-32b', 'qwen/qwen3-32b',
    'openai/gpt-oss-20b',
    'qwen-3-235b-a22b-instruct-2507',
    'mistral-large-latest',
    'llama-3.3-70b', 'llama-3.3-70b-versatile',
  ],
  [QueryIntent.CREATIVE]: [
    'moonshotai/kimi-k2-instruct-0905',
    'qwen-3-235b-a22b-instruct-2507',
    'gemini-2.5-pro', 'gemini-flash-latest',
    'mistral-large-latest',
    'llama-3.3-70b',
  ],
  [QueryIntent.FAST_CHAT]: [
    'groq/compound', 'groq/compound-mini',
    'llama-3.1-8b-instant',
    'llama3.1-8b',
    'gemini-flash-lite-latest', 'gemini-flash-latest',
    'llama-3.3-70b',
    'qwen-3-32b',
  ],
  [QueryIntent.SUMMARY]: [
    'gemini-2.5-pro', 'gemini-flash-latest',
    'groq/compound', 'groq/compound-mini',
    'qwen-3-235b-a22b-instruct-2507',
    'mistral-large-latest',
    'llama-3.3-70b-versatile', 'llama-3.3-70b',
    'gpt-oss-120b',
  ],
  [QueryIntent.KNOWLEDGE]: [
    'gemini-2.5-pro', 'gemini-flash-latest',
    'gpt-oss-120b', 'openai/gpt-oss-120b',
    'qwen-3-235b-a22b-instruct-2507',
    'mistral-large-latest',
    'llama-3.3-70b-versatile', 'llama-3.3-70b',
  ],
  [QueryIntent.VISION]: [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'gemini-2.5-pro',
  ],
  [QueryIntent.GENERAL]: [
    'qwen-3-235b-a22b-instruct-2507',
    'gpt-oss-120b', 'openai/gpt-oss-120b',
    'gemini-2.5-pro', 'gemini-flash-latest',
    'mistral-large-latest',
    'llama-3.3-70b-versatile', 'llama-3.3-70b',
    'moonshotai/kimi-k2-instruct-0905',
  ],
};

// Intent detection keywords
const INTENT_KEYWORDS = {
  [QueryIntent.CODE]: {
    high: ['write a function', 'create a class', 'debug this', 'fix the code', 'implement', 'algorithm', 'write code'],
    medium: ['function', 'class', 'method', 'variable', 'api', 'library', 'framework', 'debug', 'error', 'bug'],
    low: ['code', 'programming', 'script', 'python', 'javascript', 'java', 'typescript', 'react'],
  },
  [QueryIntent.MATH_LOGIC]: {
    high: ['solve this equation', 'calculate', 'prove that', 'compute', 'mathematical proof'],
    medium: ['equation', 'formula', 'theorem', 'proof', 'algebra', 'calculus', 'integral'],
    low: ['math', 'mathematics', 'logic', 'statistics', 'geometry'],
  },
  [QueryIntent.REASONING]: {
    high: ['analyze this', 'explain why', 'what caused', 'compare and contrast', 'evaluate'],
    medium: ['analyze', 'explain', 'why', 'reason', 'because', 'therefore', 'consider'],
    low: ['think', 'understand', 'complex', 'detailed', 'thorough'],
  },
  [QueryIntent.CREATIVE]: {
    high: ['write a story', 'create a poem', 'imagine', 'roleplay as', 'creative writing'],
    medium: ['story', 'poem', 'creative', 'fiction', 'character', 'narrative'],
    low: ['write', 'describe', 'article', 'blog', 'content'],
  },
  [QueryIntent.FAST_CHAT]: {
    high: ['yes or no', 'quick answer', 'in short', 'briefly'],
    medium: ['hi', 'hello', 'hey', 'thanks', 'okay', 'cool'],
    low: ['quick', 'fast', 'short', 'brief', 'simple'],
  },
  [QueryIntent.SUMMARY]: {
    high: ['summarize this', 'tldr', 'in summary', 'key points', 'main points'],
    medium: ['summarize', 'summary', 'overview', 'outline', 'recap'],
    low: ['shorten', 'reduce', 'simplify', 'extract'],
  },
  [QueryIntent.KNOWLEDGE]: {
    high: ['what is', 'who is', 'define', 'tell me about', 'explain', 'how does'],
    medium: ['information', 'facts', 'history', 'background', 'details', 'learn'],
    low: ['when', 'where', 'meaning', 'definition', 'technical'],
  },
};

/**
 * Detect the intent of the user's query
 */
export function detectQueryIntent(
  input: string,
  hasImages: boolean = false,
  conversationLength: number = 0
): QueryIntent {
  const text = input.toLowerCase().trim();
  
  if (hasImages) {
    const complexVisionKeywords = [
      'analyze', 'detailed', 'explain', 'complex', 'intricate',
      'compare', 'differences', 'similarities', 'identify all',
      'count', 'measure', 'calculate', 'diagram', 'chart',
    ];
    
    const isComplexVision = complexVisionKeywords.some(keyword => text.includes(keyword));
    (input as any).__isComplexVision = isComplexVision;
    
    return QueryIntent.VISION;
  }
  
  if (text.length < 15 && conversationLength < 3) {
    const greetings = ['hi', 'hello', 'hey', 'thanks', 'okay', 'ok', 'cool', 'nice'];
    if (greetings.some(g => text === g || text.startsWith(g + ' ') || text.endsWith(' ' + g))) {
      return QueryIntent.FAST_CHAT;
    }
  }
  
  const scores: Record<QueryIntent, number> = {
    [QueryIntent.CODE]: 0,
    [QueryIntent.MATH_LOGIC]: 0,
    [QueryIntent.REASONING]: 0,
    [QueryIntent.CREATIVE]: 0,
    [QueryIntent.FAST_CHAT]: 0,
    [QueryIntent.SUMMARY]: 0,
    [QueryIntent.KNOWLEDGE]: 0,
    [QueryIntent.VISION]: 0,
    [QueryIntent.GENERAL]: 0,
  };
  
  Object.entries(INTENT_KEYWORDS).forEach(([intent, weightedKeywords]) => {
    const typed = weightedKeywords as { high: string[], medium: string[], low: string[] };
    
    typed.high?.forEach(phrase => {
      if (text.includes(phrase)) scores[intent as QueryIntent] += 5;
    });
    
    typed.medium?.forEach(keyword => {
      if (text.includes(keyword)) scores[intent as QueryIntent] += 2;
    });
    
    typed.low?.forEach(keyword => {
      if (text.includes(keyword)) scores[intent as QueryIntent] += 1;
    });
  });
  
  // Pattern detection
  if (/```[\w]*\n|^function\s|^class\s|^def\s|^const\s|^let\s|^var\s/.test(text)) {
    scores[QueryIntent.CODE] += 10;
  }
  if (/\d+\s*[\+\-\*\/\^\=]\s*\d+/.test(text)) {
    scores[QueryIntent.MATH_LOGIC] += 8;
  }
  if (/once upon a time|write a (story|poem|song)/.test(text)) {
    scores[QueryIntent.CREATIVE] += 10;
  }
  if (/^(summarize|tldr)/.test(text)) {
    scores[QueryIntent.SUMMARY] += 10;
  }
  if (/^(what is|who is|when (did|was)|where is|how (does|did|do))/.test(text)) {
    scores[QueryIntent.KNOWLEDGE] += 8;
  }
  
  let maxScore = 0;
  let detectedIntent = QueryIntent.GENERAL;
  
  Object.entries(scores).forEach(([intent, score]) => {
    if (score > maxScore) {
      maxScore = score;
      detectedIntent = intent as QueryIntent;
    }
  });
  
  return maxScore >= 2 ? detectedIntent : QueryIntent.GENERAL;
}

/**
 * Select the best model for the given intent
 */
export function selectBestModel(
  intent: QueryIntent,
  availableModels: ModelEntry[],
  currentModel?: string,
  isComplexVision: boolean = false
): ModelEntry | null {
  if (!availableModels || availableModels.length === 0) return null;
  
  const filteredModels = availableModels.filter(m => m.inference !== 'openrouter');
  if (filteredModels.length === 0) return null;
  
  let preferences = MODEL_PREFERENCES[intent] || MODEL_PREFERENCES[QueryIntent.GENERAL];
  
  if (intent === QueryIntent.VISION && isComplexVision) {
    preferences = [
      'gemini-2.5-pro',
      'gemini-flash-latest',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
      'gemini-flash-lite-latest',
    ];
  }
  
  const getSimilarityScore = (modelId: string, preferredId: string): number => {
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
    
    if (matchCount > 0) return 50 + (matchCount * 10);
    return 0;
  };
  
  const matchedModels: Array<{ model: ModelEntry; score: number; priority: number }> = [];
  
  for (let i = 0; i < preferences.length; i++) {
    const preferredId = preferences[i];
    for (const model of filteredModels) {
      const score = getSimilarityScore(model.id, preferredId);
      if (score >= 50) {
        matchedModels.push({ model, score, priority: i });
      }
    }
  }
  
  matchedModels.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.score - a.score;
  });
  
  if (matchedModels.length > 0) {
    return matchedModels[0].model;
  }
  
  // Fallback strategies
  if (intent === QueryIntent.VISION) {
    const visionModel = filteredModels.find(m => m.type === 'vision' || m.supportsVision);
    if (visionModel) return visionModel;
  }
  
  if (intent === QueryIntent.REASONING || intent === QueryIntent.MATH_LOGIC) {
    const reasonModel = filteredModels.find(m => m.hasReasoning || m.type === 'reason');
    if (reasonModel) return reasonModel;
  }
  
  if (currentModel) {
    const current = filteredModels.find(m => m.id === currentModel);
    if (current) return current;
  }
  
  const textModel = filteredModels.find(m => m.type === 'text');
  return textModel || filteredModels[0] || null;
}

/**
 * Check if auto-switch is enabled
 */
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

/**
 * Enable or disable auto-switch
 */
export function setAutoSwitchEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SWITCH_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save auto-switch state:', error);
  }
}

/**
 * Auto-switch model based on input analysis
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
  
  const intent = detectQueryIntent(input, hasImages, conversationLength);
  const isComplexVision = (input as any).__isComplexVision || false;
  
  console.log(`[AUTO-SWITCH] Intent: ${intent}`);
  
  const selectedModel = selectBestModel(intent, availableModels, currentModel, isComplexVision);
  
  if (selectedModel && selectedModel.id !== currentModel) {
    console.log(`🔄 Switching to ${selectedModel.id}`);
    return selectedModel.id;
  }
  
  return null;
}
