# Google Gemini Support - Website Implementation

## Summary
Added native Google Gemini API support to the website with vision capabilities, matching the mobile app implementation.

## What Was Added

### 1. **Google/Gemini Client** (`src/lib/googleClient.ts`)
- Created complete Google Gemini API client
- Uses proxy server at `https://switchai.onrender.com`
- Supports streaming via SSE (Server-Sent Events)
- Supports vision (multimodal with images)
- API key management (user-specific + global fallback)
- Implements both streaming and non-streaming completions

### 2. **Model Catalog Updates** (`src/lib/modelCatalog.ts`)
- Added `'google'` as inference provider type
- Auto-detects Gemini models → routes to Google API
- Separates Gemini from OpenRouter (native API vs third-party)
- Smart detection: `gemini` in model ID → Google inference

### 3. **HomeScreen Integration** (`src/pages/HomeScreen.tsx`)
- Added Google client import
- Added `'google'` to inference routing logic
- Implemented Google streaming in send flow
- Added Google section in model picker
- Added green color scheme for Google models (🟢)

### 4. **Model Picker UI**
- New "Google" section in model picker
- Green badge for Google inference: `rgba(34, 197, 94, 0.15)` background
- Displays alongside Groq, Cerebras, Mistral, OpenRouter

## How It Works

### Inference Routing
```typescript
// Auto-detection in modelCatalog.ts
if (id.includes('gemini')) {
  return 'google';  // Uses native Google API via proxy
}
```

### API Flow
1. **Client** → Fetches Gemini API key from Firestore
2. **Request** → Sends to proxy server with messages + API key
3. **Proxy** → Converts OpenAI format → Gemini format
4. **Proxy** → Handles vision (base64 images)
5. **Proxy** → Streams response back via SSE
6. **Client** → Parses SSE and displays in real-time

### Vision Support
The proxy server automatically handles:
- OpenAI `image_url` format → Gemini `inlineData` format
- Base64 image encoding
- Multi-modal content arrays

## Firestore Configuration

### Model Document Example
```javascript
{
  model: "Gemini 2.5 Flash",
  modelID: "gemini-2.5-flash",
  type: "vision",  // or "text"
  inference: "google",  // Critical!
  provider: "Google"
}
```

### API Keys
- **Global:** `api/gemini` → `{ key: "AIza..." }`
- **User-specific:** `users/{uid}/api/gemini` → `{ key: "AIza..." }`

## Supported Models

All Gemini models via Google's API:
- ✅ `gemini-2.5-flash` - Fast, vision-capable
- ✅ `gemini-2.5-pro` - High quality, vision-capable
- ✅ `gemini-2.0-flash-exp` - Experimental, image generation
- ✅ Any other Gemini model

## Inference Provider Summary

| Provider | Models | Use Case | Vision |
|----------|--------|----------|--------|
| **Groq** 🟠 | Llama, Mixtral | Fast text inference | ❌ |
| **Cerebras** 🔴 | Llama 3.3 | Ultra-fast inference | ❌ |
| **Mistral** 🟣 | Mistral, Pixtral | Native Mistral models | ✅ |
| **Google** 🟢 | Gemini | Native Google models | ✅ |
| **OpenRouter** 🔵 | GPT, Claude, etc. | Multi-provider access | ✅ |

## Key Differences from OpenRouter

### Why Separate Google Inference?

**OpenRouter Gemini:**
- Third-party proxy
- May have rate limits
- Additional latency
- Costs per request

**Native Google API:**
- Direct from Google
- User's own API key
- Lower latency
- User controls costs
- Full feature access (image generation, etc.)

## Files Modified

1. ✅ `website/src/lib/googleClient.ts` - **NEW** Google API client
2. ✅ `website/src/lib/modelCatalog.ts` - Added Google inference detection
3. ✅ `website/src/pages/HomeScreen.tsx` - Added Google routing + UI
4. ✅ `website/GOOGLE_GEMINI_SUPPORT.md` - This documentation

## Testing

### Test Gemini Model
1. Add model to Firestore with `inference: "google"`
2. Add Gemini API key to `api/gemini` in Firestore
3. Select model in UI
4. Send a message
5. Should stream response from Google API

### Test Vision
1. Use a vision-capable model (e.g., `gemini-2.5-flash`)
2. Attach an image
3. Ask about the image
4. Proxy server handles image encoding automatically

## Error Handling

### Common Issues

**404 Model Not Found:**
- ❌ Wrong: Model doesn't exist on provider
- ✅ Fix: Ensure model ID is correct and available

**401 Unauthorized:**
- ❌ Wrong: Invalid or missing API key
- ✅ Fix: Check Firestore `api/gemini` has valid key

**Inference Mismatch:**
- ❌ Wrong: Model set to wrong inference provider
- ✅ Fix: Set `inference: "google"` in Firestore

## Advantages

### For Users
- ✅ Use their own Gemini API key
- ✅ Direct access to latest Gemini models
- ✅ Full vision capabilities
- ✅ Image generation support (future)
- ✅ Lower latency than third-party proxies

### For Developers
- ✅ Consistent with mobile app architecture
- ✅ Reuses existing proxy server
- ✅ Easy to add new Gemini models
- ✅ Automatic vision support

## Next Steps (Optional)

1. **Image Generation UI** - Add UI for Gemini image generation
2. **Model Badges** - Show vision capability in model picker
3. **Usage Tracking** - Display token usage for Gemini
4. **Settings Page** - Add dedicated Gemini API key input
5. **Model Descriptions** - Add tooltips explaining model capabilities

## Conclusion

Google Gemini is now fully integrated with:
- ✅ Native Google API support (not OpenRouter)
- ✅ Vision capabilities for multimodal use
- ✅ Streaming for real-time responses
- ✅ Consistent with mobile app implementation
- ✅ User-controlled API keys
- ✅ Premium pitch-black UI

The website now supports **5 inference providers** with smart auto-detection! 🎉
