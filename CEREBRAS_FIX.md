# Cerebras API Fix - Troubleshooting Guide

## Issue Fixed
**Error**: "Cerebras request failed: Load failed"

## Root Cause
The website was trying to use a proxy server (`switchai.onrender.com`) to access Cerebras API, which caused:
- CORS (Cross-Origin Resource Sharing) errors
- Network connection failures
- "Load failed" errors in the browser

## Solution Applied
Changed Cerebras client to call the API **directly** instead of through a proxy:

### Before (Using Proxy):
```typescript
const url = resolveProxyBase() + '/cerebras/chat'; // http://localhost:5058 or https://switchai.onrender.com
// Required proxy server to be running
```

### After (Direct API):
```typescript
const url = 'https://api.cerebras.ai/v1/chat/completions';
// Calls Cerebras API directly with Authorization header
```

## Additional Improvements

### 1. Added Streaming Support
Cerebras now supports **streaming responses** just like Groq and OpenRouter:
- Responses appear word-by-word in real-time
- Better user experience
- No waiting for complete response

### 2. Better Error Handling
```typescript
// Detects network errors specifically
if (err?.message?.includes('Load failed') || err?.message?.includes('NetworkError')) {
  throw new Error('Unable to connect to Cerebras API. Please check your network connection or try a different model.');
}
```

### 3. Token Limit Fix
Reduced max_tokens from 32768 to 8192 to match Cerebras API limits.

## How to Test

### Test Cerebras Models:
1. Open the website
2. Select a Cerebras model (e.g., `llama-3.3-70b`)
3. Send a message
4. Should see streaming response ✅

### Expected Behavior:
- ✅ No "Load failed" errors
- ✅ Streaming text appears gradually
- ✅ Proper error messages if API key is invalid
- ✅ Works without proxy server

## API Requirements

### Firestore Configuration:
```javascript
// Global key (fallback):
/api/cerebras
  - key: "csk-xxxxx..."

// User-specific key (optional):
/users/{uid}/api/cerebras
  - key: "csk-xxxxx..."
  - enabled: true
```

## Alternative: If Direct API Fails

If the direct API call still fails due to CORS (some browsers block it), you have two options:

### Option 1: Use Browser Extension
Install a CORS unblocking extension (development only)

### Option 2: Re-enable Proxy
If you have the proxy server running:

```typescript
// In cerebrasClient.ts, change back to:
const url = 'http://localhost:5058/cerebras/chat'; // local dev
// or
const url = 'https://switchai.onrender.com/cerebras/chat'; // production
```

## Files Changed
- ✅ `website/src/lib/cerebrasClient.ts` - Direct API calls + streaming
- ✅ `website/src/pages/HomeScreen.tsx` - Use streaming instead of non-streaming

## Benefits
1. **No Proxy Required**: Works without external server
2. **Faster**: Direct connection to Cerebras
3. **Streaming**: Better UX with real-time responses
4. **Reliable**: No proxy downtime issues
5. **Simpler**: Less infrastructure to maintain

## Common Issues

### Issue: "Cerebras API error 401"
**Solution**: Check API key in Firestore (`/api/cerebras` or `/users/{uid}/api/cerebras`)

### Issue: "Cerebras API error 429"
**Solution**: Rate limit exceeded - wait a moment and try again

### Issue: Still getting "Load failed"
**Solution**: 
1. Check browser console for CORS errors
2. Verify API key is valid
3. Try a different model (use Groq or OpenRouter)
4. Check internet connection

## Testing Checklist
- [ ] Cerebras models load in picker
- [ ] Model picker shows "Cerebras" badge
- [ ] Can send message to Cerebras model
- [ ] Streaming text appears gradually
- [ ] No proxy errors in console
- [ ] Error messages are user-friendly

All fixed! 🎉
