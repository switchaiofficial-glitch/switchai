# Reasoning Improvements - Website

## Summary
Enhanced reasoning support to match the mobile app implementation with collapsible reasoning blocks, proper tag handling, and model-specific reasoning level controls.

## Changes Made

### 1. **Collapsible Reasoning Block** (`src/components/Markdown.tsx`)

**Before:**
- Reasoning shown as static code block
- Always expanded
- Basic styling

**After:**
- ✅ Collapsible with chevron icon
- ✅ Click to expand/collapse
- ✅ Premium green theme (`rgba(16, 185, 129, ...)`)
- ✅ Brain emoji (🧠) badge
- ✅ Hover effects
- ✅ Max height with scroll (480px)
- ✅ Shows "Nothing to think, Skipped Reasoning" if empty

**UI Design:**
```
┌─────────────────────────────────┐
│ 🧠 Reasoning              ▼     │ ← Clickable header
├─────────────────────────────────┤
│ [Reasoning content here...]     │ ← Expandable content
│ (max 480px height, scrollable)  │
└─────────────────────────────────┘
```

### 2. **Handle Closing-Only Tags** (`src/components/Markdown.tsx`)

**Problem:**
Some reasoning models only output `</think>` without opening tag.

**Solution:**
```typescript
// Handle full tags: <think>...</think>
.replace(/<\s*(think|reason|reasoning)\s*>[\s\n]*([\s\S]*?)[\s\n]*<\s*\/\s*(think|reason|reasoning)\s*>/gi, ...)

// Handle closing-only tags: </think>
.replace(/^([\s\S]*?)<\s*\/\s*(think|reason|reasoning)\s*>/i, ...)
```

Now handles:
- ✅ `<think>content</think>`
- ✅ `<reason>content</reason>`
- ✅ `<reasoning>content</reasoning>`
- ✅ `content</think>` (closing-only)
- ✅ `content</reason>` (closing-only)
- ✅ `content</reasoning>` (closing-only)

### 3. **Model-Specific Reasoning Level** (Already Implemented)

**Reasoning level dropdown only shows for:**
- Models with `hasReasoning: true` in Firestore
- Models with `type: 'reason'`

**Detection:**
```typescript
const isReasoningSelected = !!(
  selectedEntryForReason?.hasReasoning || 
  selectedEntryForReason?.type === 'reason'
);
```

**Reasoning Levels:**
- **Low:** Fast, brief responses
- **Medium:** Balanced quality and speed (default)
- **High:** Thorough, detailed analysis

### 4. **System Message for Reasoning Models**

When a reasoning model is selected, a system message is added:

```typescript
const sysMsg = isReasoningModel ? {
  role: 'system',
  content: `Reasoning effort: ${reasoningLevel}. ${guidance}`
} : null;
```

**Guidance by Level:**
- **Low:** "Prioritize speed and brevity. Provide a concise answer without over-explaining."
- **Medium:** "Balance quality and speed."
- **High:** "Prioritize thoroughness and accuracy. Consider edge cases and provide a well-structured answer. Avoid exposing internal chain-of-thought; share only conclusions."

## Visual Comparison

### App (Mobile)
```
┌─────────────────────────────┐
│ 🧠 Reasoning          ▼     │
└─────────────────────────────┘
```

### Website (Now Matches!)
```
┌─────────────────────────────┐
│ 🧠 Reasoning          ▼     │
└─────────────────────────────┘
```

## Reasoning Block Styling

**Colors (Pitch-Black Theme):**
- Border: `rgba(255,255,255,0.12)` (subtle white)
- Background: `rgba(255,255,255,0.03)` (almost black)
- Header: `rgba(255,255,255,0.05)` (slightly lighter)
- Hover: `rgba(255,255,255,0.08)` (brighter on hover)

**Badge:**
- 20x20px rounded square
- Green background (`theme.colors.primary`)
- Brain emoji (🧠)

**Typography:**
- Title: 13px, font-weight 600
- Content: 14px monospace
- Line height: 1.6

**Layout:**
- Width: 100% (matches message container)
- No horizontal scroll (word-wrap enabled)
- Vertical scroll only (max 480px height)
- Text wrapping: `pre-wrap` with `word-wrap: break-word`

## Files Modified

1. ✅ `website/src/components/Markdown.tsx`
   - Added collapsible reasoning block
   - Handle closing-only tags (`</think>`)
   - Imported ChevronDown, ChevronUp icons
   - Added reasoningOpen state

2. ✅ `website/src/pages/HomeScreen.tsx`
   - Already has model-specific reasoning level
   - Already checks `hasReasoning` flag
   - Already adds system message for reasoning models

## How to Use

### For Model Creators (Firestore)
Add reasoning support to a model:
```javascript
{
  model: "DeepSeek R1",
  modelID: "deepseek-r1",
  type: "reason",  // or "text"
  hasReasoning: true,  // ← Enable reasoning
  inference: "openrouter"
}
```

### For Users
1. Select a reasoning-capable model
2. Reasoning level dropdown appears in footer
3. Choose Low/Medium/High
4. AI responses will include collapsible reasoning blocks
5. Click to expand/collapse reasoning

## Benefits

### For Users
- ✅ Clean UI (reasoning collapsed by default)
- ✅ Easy to expand when needed
- ✅ Control reasoning depth (low/medium/high)
- ✅ Consistent with mobile app

### For Developers
- ✅ Handles edge cases (closing-only tags)
- ✅ Robust tag detection
- ✅ Model-specific features
- ✅ Maintainable code

## Testing Checklist

- [x] Full tags `<think>...</think>` render correctly
- [x] Closing-only tags `</think>` render correctly
- [x] Empty reasoning shows fallback text
- [x] Collapsible works (click to expand/collapse)
- [x] Reasoning level only shows for reasoning models
- [x] System message added for reasoning models
- [x] Green theme matches design
- [x] Hover effects work
- [x] Scrolling works for long reasoning

## Conclusion

Reasoning support now matches the mobile app with:
- ✅ Collapsible reasoning blocks
- ✅ Handles closing-only tags
- ✅ Model-specific reasoning levels
- ✅ Premium green theme
- ✅ System message guidance
- ✅ Clean, intuitive UX

The website now provides the same high-quality reasoning experience as the mobile app! 🧠✨
