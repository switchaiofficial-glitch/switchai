# Quick Reference: Website Model System

## How Models Work Now (Like Mobile App)

### 1. Automatic Model Classification

Models are now automatically classified based on their ID and Firestore data:

```typescript
// Example model in Firestore:
{
  model: "GPT-4 Turbo",
  modelID: "gpt-4-turbo-preview",
  type: "vision",              // Auto-detected if not set
  inference: "openrouter",     // Auto-detected if not set
  hasReasoning: false          // Auto-detected from model name
}
```

### 2. Inference Provider Routing

**Automatic Detection:**
- Models with `gpt`, `claude`, `gemini-2`, `deepseek`, `qwen` → OpenRouter
- Models with `cerebras`, `llama3.3`, `llama-3.3` → Cerebras
- All others → Groq (default)

**Manual Override:**
Set `inference: "groq" | "openrouter" | "cerebras"` in Firestore

### 3. Model Capabilities

#### Vision Models (Auto-detected):
- Pattern matches: `vision`, `llava`, `pixtral`, `gpt-4o`, `gemini-1.5`, `claude-3`, `qwen-vl`
- Shows 👁️ Vision badge in UI
- Supports image content in messages

#### Reasoning Models (Auto-detected):
- Pattern matches: `deepseek-reasoner`, `o1`, `o3`, `reasoning`, `think`, `qwq`
- Shows 💡 Reasoning badge in UI
- Displays reasoning level selector (Low/Medium/High)
- Passes `reasoning: { effort: 'low' | 'medium' | 'high' }` to API

### 4. Streaming Support

**All providers now stream:**
- ✅ Groq: Native streaming
- ✅ OpenRouter: Now supports streaming (NEW!)
- ⚠️ Cerebras: Non-streaming (via proxy)

```typescript
// Example streaming call:
await streamChatCompletion({
  model: selectedModel,
  messages: apiMessages,
  reasoning: isReasoningModel ? { effort: reasoningLevel } : undefined,
  onDelta: (delta) => { /* Update UI */ },
  onDone: (text) => { /* Finalize */ },
  signal: abortController.signal,
});
```

### 5. UI Enhancements

**Model Picker Shows:**
- 🏷️ Type badge (text/vision/reason)
- 🏢 Provider badge (OpenAI, Google, Meta, etc.)
- ⚡ Inference badge (groq, openrouter, cerebras)
- 💡 Reasoning badge (if capable)
- 👁️ Vision badge (if capable)

**Reasoning Level Selector:**
- Only visible for reasoning-capable models
- Three levels with descriptions:
  - **Low**: Fast responses, concise answers
  - **Medium**: Balanced quality and speed
  - **High**: Thorough, detailed analysis

## Adding New Models to Firestore

### Basic Model:
```javascript
{
  model: "Llama 3.3 70B",
  modelID: "llama-3.3-70b-versatile",
  type: "text",
  inference: "groq"
}
```

### Vision Model:
```javascript
{
  model: "GPT-4 Turbo with Vision",
  modelID: "gpt-4-turbo-preview",
  type: "vision",              // Required for vision
  inference: "openrouter"
}
```

### Reasoning Model:
```javascript
{
  model: "DeepSeek R1",
  modelID: "deepseek-reasoner",
  type: "reason",              // Required for reasoning
  inference: "openrouter",
  hasReasoning: true,          // Optional explicit flag
  reasoningLevel: "high"       // Optional default level
}
```

### Multi-Capability Model:
```javascript
{
  model: "Claude 3.5 Sonnet",
  modelID: "anthropic/claude-3.5-sonnet",
  type: "vision",              // Supports vision
  inference: "openrouter",
  hasReasoning: true           // Also supports reasoning
}
```

## Troubleshooting

### Model Not Working:
1. Check Firestore document has `modelID` field
2. Verify `inference` field is set correctly
3. Ensure API key is configured in Settings > Dedicated Inference
4. Check browser console for errors

### No Streaming:
1. Cerebras models don't stream (by design)
2. Check network tab for SSE connection
3. Verify API endpoint is accessible

### Reasoning Not Working:
1. Check model has `hasReasoning: true` or `reasoningLevel` field
2. Verify reasoning level selector appears
3. Check API call includes `reasoning: { effort: '...' }` parameter

### Vision Not Working:
1. Verify model `type: "vision"` or has vision pattern in ID
2. Check vision badge appears in model picker
3. Image upload feature coming soon

## API Key Configuration

**User-Specific Keys** (Settings > Dedicated Inference):
- Groq: `users/{uid}/api/groq` with `{ key: "...", enabled: true }`
- OpenRouter: `users/{uid}/api/openrouter` with `{ key: "...", enabled: true }`
- Cerebras: `users/{uid}/api/cerebras` with `{ key: "...", enabled: true }`

**Global Fallback Keys** (Admin):
- `api/groq` with `{ key: "..." }`
- `api/openrouter` with `{ key: "..." }`
- `api/cerebras` with `{ key: "..." }`

## Performance Tips

1. **Use Groq for speed**: Fastest inference, native streaming
2. **Use OpenRouter for quality**: Access to GPT-4, Claude, etc.
3. **Use Cerebras for scale**: High throughput, good pricing
4. **Enable reasoning only when needed**: Adds latency but improves quality
5. **Choose appropriate reasoning level**: Low for speed, High for accuracy

## Common Patterns

### Check Model Capabilities:
```typescript
import { getModelEntry, hasReasoningCapability, isVisionId } from '@/lib/modelCatalog';

const model = getModelEntry(modelId, firestoreModels);
const canReason = hasReasoningCapability(modelId, firestoreModels);
const hasVision = isVisionId(modelId, firestoreModels);
```

### Route to Correct Provider:
```typescript
const inference = model.inference || 'groq'; // Auto-detect if not set

if (inference === 'groq') {
  await streamChatCompletion({ ... });
} else if (inference === 'openrouter') {
  await openRouterStreamCompletion({ ... });
} else if (inference === 'cerebras') {
  await cerebrasChatCompletion({ ... });
}
```

### Add Reasoning Support:
```typescript
const isReasoningModel = model.hasReasoning || model.type === 'reason';
const reasoning = isReasoningModel ? { effort: reasoningLevel } : undefined;

await streamChatCompletion({
  model: modelId,
  messages: apiMessages,
  reasoning, // Only included for reasoning models
  // ...
});
```

## What's Next

Planned enhancements:
- 📷 Image upload for vision models
- 💰 Cost tracking per model/provider
- 📊 Performance metrics (latency, tokens/sec)
- ⭐ Favorite models
- 🔍 Model search/filter
- 📁 Group models by provider
- 🎯 Model-specific parameter tuning
