// Catalog helpers for Firestore-backed models
// Firestore document shape per entry:
// { model: string, modelID: string, type: 'text' | 'vision' | 'reason' }

export const MODEL_CATEGORIES = [
  { key: 'text', label: 'Text' },
  { key: 'vision', label: 'Vision' },
  { key: 'reason', label: 'Reasoning' },
];

export const MODEL_TYPES = ['text', 'vision', 'reason'] as const;

export type ModelType = typeof MODEL_TYPES[number];

export interface CatalogEntry {
  id: string;
  label: string;
  type: ModelType;
  provider?: string;
  capabilities?: string[];
  inference?: 'groq' | 'openrouter' | 'cerebras' | 'mistral' | 'google' | string;
  hasReasoning?: boolean;
  supportsVision?: boolean;
}

interface FirestoreModel {
  model?: string;
  modelID?: string;
  type?: string;
  inference?: string;
  reasoningLevel?: string; // presence indicates reasoning-capable (as in app)
  hasReasoning?: boolean;  // optional explicit flag
}

// Detect if a model supports vision based on its ID
function detectVisionSupport(modelId: string, explicitType?: string): boolean {
  const id = String(modelId || '').toLowerCase();
  // Check explicit type first
  if (explicitType === 'vision') return true;

  // Known vision models
  const visionPatterns = [
    'vision', 'llava', 'pixtral', 'gpt-4-vision', 'gpt-4o', 'gpt-4-turbo',
    'gemini-1.5', 'gemini-2.0', 'gemini-pro-vision', 'claude-3',
    'qwen-vl', 'qwen2-vl'
  ];

  return visionPatterns.some(pattern => id.includes(pattern));
}

// Detect if a model supports reasoning
function detectReasoningSupport(modelId: string, data: FirestoreModel): boolean {
  const id = String(modelId || '').toLowerCase();

  // Check explicit flags first
  if (data.hasReasoning || data.reasoningLevel) return true;
  if (data.type === 'reason' || data.type === 'reasoning') return true;

  // Known reasoning models
  const reasoningPatterns = [
    'deepseek-reasoner', 'o1', 'o3', 'reasoning', 'think', 'qwq'
  ];

  return reasoningPatterns.some(pattern => id.includes(pattern));
}

// Auto-detect inference provider from model ID if not explicitly set
function detectInferenceProvider(modelId: string, explicitInference?: string): 'groq' | 'openrouter' | 'cerebras' | 'mistral' | 'google' | 'groq' {
  // Priority 1: If explicit inference is set, use it
  if (explicitInference) {
    const inf = String(explicitInference).toLowerCase();
    if (inf === 'openrouter' || inf === 'cerebras' || inf === 'groq' || inf === 'mistral' || inf === 'google') {
      return inf as 'groq' | 'openrouter' | 'cerebras' | 'mistral' | 'google';
    }
  }

  // Priority 2: Auto-detect based on model ID patterns (before defaulting to Groq)
  const id = String(modelId || '').toLowerCase();

  // Cerebras models
  if (id.includes('cerebras') || id.includes('llama3.3') || id.includes('llama-3.3')) {
    return 'cerebras';
  }

  // Mistral models (native Mistral API)
  if (id.includes('mistral') && !id.includes('mixtral')) {
    return 'mistral';
  }

  // Google/Gemini models (native Google API via proxy)
  // These use Google's Gemini API directly, not OpenRouter
  if (id.includes('gemini')) {
    return 'google';
  }

  // OpenRouter exclusive models - models that ONLY work on OpenRouter
  if (
    id.includes('gpt-4') ||
    id.includes('gpt-3.5') ||
    id.includes('claude') ||
    id.includes('o1-') ||
    id.includes('gemma-2') ||
    id.includes('deepseek') ||
    id.includes('qwen') ||
    id.includes('moonshot')
  ) {
    return 'openrouter';
  }

  // Priority 3: If no explicit inference field exists and no pattern matched, default to 'groq'
  return 'groq';
}

// Normalize a Firestore model document or plain object to a catalog entry
// Accepts either { model, modelID, type } or a string id (fallback)
export function asCatalogEntry(input: string | FirestoreModel): CatalogEntry | null {
  if (typeof input === 'string') {
    const id = String(input).trim();
    if (!id) return null;
    const provider = getProviderName(id);
    const inference = detectInferenceProvider(id);
    return {
      id,
      label: id,
      type: 'text',
      provider,
      inference,
      hasReasoning: false,
      supportsVision: detectVisionSupport(id)
    };
  }
  const data = input || {};
  const id = String(data.modelID || '').trim();
  const label = String(data.model || id).trim();
  const typeRaw = String(data.type || 'text').toLowerCase();

  // Determine type
  let type: ModelType = 'text';
  if (typeRaw === 'vision') type = 'vision';
  else if (typeRaw === 'reason' || typeRaw === 'reasoning') type = 'reason';
  else if (detectVisionSupport(id, typeRaw)) type = 'vision';
  else if (detectReasoningSupport(id, data)) type = 'reason';

  const provider = getProviderName(id);
  const inference = detectInferenceProvider(id, data.inference);
  const hasReasoning = detectReasoningSupport(id, data);
  const supportsVision = type === 'vision' || detectVisionSupport(id, typeRaw);

  if (!id) return null;
  return { id, label, type, provider, inference, hasReasoning, supportsVision };
}

// Build a catalog from an array of Firestore docs (data objects) or strings
export function buildCatalog(items: (string | FirestoreModel)[] = []): CatalogEntry[] {
  return (Array.isArray(items) ? items : [])
    .map(asCatalogEntry)
    .filter((entry): entry is CatalogEntry => entry !== null);
}

// Filter catalog by category (uses entry.type)
export function modelsByCategory(key: string, items: (string | FirestoreModel)[] = []): CatalogEntry[] {
  const k = String(key || '').toLowerCase();
  const catalog = buildCatalog(items);
  if (!k || k === 'text') return catalog.filter(m => m.type === 'text');
  if (k === 'vision') return catalog.filter(m => m.type === 'vision');
  if (k === 'reason' || k === 'reasoning') return catalog.filter(m => m.type === 'reason');
  return catalog;
}

// Determine if a given model id is a vision model from provided entries
export function isVisionId(id: string, items: (string | FirestoreModel)[] = []): boolean {
  const catalog = buildCatalog(items);
  const entry = catalog.find(m => m.id === id);
  return !!(entry?.supportsVision || entry?.type === 'vision');
}

// Check if a model has reasoning capabilities
export function hasReasoningCapability(id: string, items: (string | FirestoreModel)[] = []): boolean {
  const catalog = buildCatalog(items);
  const entry = catalog.find(m => m.id === id);
  return !!(entry?.hasReasoning || entry?.type === 'reason');
}

// Get full model entry by ID
export function getModelEntry(id: string, items: (string | FirestoreModel)[] = []): CatalogEntry | undefined {
  const catalog = buildCatalog(items);
  return catalog.find(m => m.id === id);
}

// Get provider name from model ID
export function getProviderName(modelId: string): string {
  const id = String(modelId || '').toLowerCase();

  if (id.includes('gpt') || id.includes('openai')) return 'OpenAI';
  if (id.includes('moonshot')) return 'Moonshot';
  if (id.includes('gemini') || id.includes('gemma') || id.includes('google')) return 'Google';
  if (id.includes('deepseek')) return 'DeepSeek';
  if (id.includes('qwen') || id.includes('alibaba')) return 'Qwen';
  if (id.includes('meta') || id.includes('llama')) return 'Meta';
  if (id.includes('groq')) return 'Groq';
  if (id.includes('mistral') || id.includes('pixtral') || id.includes('mixtral')) return 'Mistral';
  if (id.includes('cerebras')) return 'Cerebras';
  if (id.includes('claude') || id.includes('anthropic')) return 'Anthropic';

  return 'Unknown';
}
