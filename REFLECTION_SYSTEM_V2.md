# Reflection System V2 - Simplified Design

## Philosophy: Low Friction, High Depth

**Quick tap & done** with **optional deepening**

The moon phase is **prominent feedback** about how the interaction felt. It influences which sentence options appear, but the user chose it consciously - it's not hidden magic.

---

## User Flow

### 1. **Select Category**
User chooses how they connected (e.g., "Meal/Drink", "Deep Talk")

### 2. **Select Moon Phase** (PROMINENT)
This is key feedback:
- 🌑 **New Moon** - Challenging
- 🌒 **Waxing Crescent** - Good
- 🌓 **First Quarter** - Good
- 🌔 **Waxing Gibbous** - Great
- 🌕 **Full Moon** - Peak/Amazing
- etc.

**This selection is visible and intentional** - it's how the user rates the vibe of their interaction.

### 3. **See Contextual Prompt**
Based on category + archetype + vibe:
- "What did you enjoy about spending time together?"
- "What truth emerged between you?"
- "What made this meal so special?"

### 4. **Choose Quick Reflection** (Tap & Done)
4-6 complete sentence chips appear:
- ✨ "We talked about life and where we are over food"
- ✨ "We just hung out and it was easy"
- ✨ "We went deep and something true emerged"
- ✨ "I opened up about something I've been carrying"

**User taps one** → Text fills into the box below

### 5. **Optionally Edit or Add More**
- Save immediately (tap & done!)
- Edit the text
- Add more details
- Or type from scratch

---

## What This Fixes

### ❌ Old System (Too Cluttered):
```
Prompt: "What did you enjoy about spending time together?"

Tags: [What] [Did] [How] [Felt]
      work  laughed  deep  closer
      relationships  opened-up  vulnerable  understood

→ User confused: "How do these connect?"
→ Too much cognitive load
→ Moon phase influence invisible
```

### ✅ New System (Simple & Clear):
```
Prompt: "What did you enjoy about spending time together?"

Tap one:
• "We just hung out and it was easy"
• "We talked about life and where we are over food"
• "We enjoyed comfortable silence together"
• "We laughed at absolutely nothing"

→ User taps → Done!
→ Or edits/adds more
→ Moon phase directly influences which sentences appear
```

---

## Example Scenarios

### Scenario 1: Meal/Drink + Empress + Full Moon (Peak)

**Prompt:** "What made this meal so special?"

**Chips:**
- "This was special — we really connected and I felt so grateful"
- "We talked about life and where we are over food"
- "We shared a meal and it was nourishing"

**User taps:** "This was special — we really connected and I felt so grateful"

**Result:** Saved! (Or they can edit/add more)

---

### Scenario 2: Deep Talk + High Priestess + Full Moon

**Prompt:** "What truth emerged between you?"

**Chips:**
- "We went deep and something true emerged"
- "I opened up about something I've been carrying and it felt like a release"
- "We sat with the quiet and found wisdom in the silence"
- "We talked about something vulnerable and I felt really seen"

**User taps:** "I opened up about something I've been carrying and it felt like a release"

**Edits to:** "I opened up about my fears around work and it felt like a release"

**Saves:** Perfect!

---

### Scenario 3: Hangout + Fool + Waxing Crescent (Good)

**Prompt:** "What did you enjoy about spending time together?"

**Chips:**
- "We just hung out and it was easy"
- "We did something spontaneous and laughed so much"
- "We laughed at absolutely nothing"

**User taps:** "We did something spontaneous and laughed so much"

**Saves immediately:** Tap & done!

---

## Moon Phase Influence (Visible to User)

The user **chose the moon phase** as feedback about the vibe. It's not hidden - it's how they rate the interaction.

Moon phase influences sentence selection:

**Full Moon / Waxing Gibbous (Peak):**
- More vulnerable, breakthrough sentences
- "This was special — we really connected"
- "I opened up about something I've been carrying"
- Celebratory, peak-moment language

**New Moon (Challenging):**
- Honest, supportive sentences
- "We talked about the hard stuff"
- "It was difficult but we showed up"
- Grounded, real language

**First Quarter / Waxing Crescent (Good):**
- Comfortable, pleasant sentences
- "We just hung out and it was easy"
- "We caught up and it felt good to connect"
- Warm, steady language

---

## Technical Implementation

### New Files Created:

1. **`src/lib/reflection-sentences.ts`**
   - Library of 40+ complete sentences
   - Organized by category + archetype + vibe
   - Each sentence has editable components (for future enhancement)

2. **`src/components/ReflectionSentenceChips.tsx`**
   - Simple horizontal scroll of sentence chips
   - "Tap to use, or write your own below"
   - Clean, minimal UI

3. **Updated: `src/components/ContextualReflectionInput.tsx`**
   - Shows prompt
   - Shows sentence chips
   - Shows text input (auto-fills on chip tap)
   - Simple, linear flow

### Old Files (Can be removed):
- `src/lib/reflection-tags.ts` (old tag system)
- `src/components/ReflectionTagChips.tsx` (old tag UI)

---

## Future Enhancement: Editable Components

**Phase 2 (Not Yet Built):**

When a sentence is tapped, certain words become **tappable to swap**:

**Example:**
Sentence: "We talked about **life and where we are** over **food**"

User taps "life and where we are" → alternatives appear:
- "work and dreams"
- "everything and nothing"
- "what's been on our minds"

User taps "food" → alternatives appear:
- "coffee"
- "drinks"
- "dinner"

**Result:** "We talked about work and dreams over coffee"

This gives users **granular control** without having to type, while keeping the flow simple.

---

## Architecture Benefits

✅ **Low friction:** Tap once, done
✅ **Flexible:** Can always edit or write from scratch
✅ **Context-aware:** Sentences match category + archetype + vibe
✅ **Natural language:** Complete thoughts, not fragments
✅ **Moon phase visible:** User chose it as feedback, it influences options
✅ **Easy to expand:** Add sentences to library, no code changes
✅ **Future-proof:** Components ready for tappable editing later

---

## Next Steps

1. **Test the simplified flow** - Is it clearer? Less cluttered?
2. **Add more sentences** - Currently 40+, could expand to 100+
3. **Build tappable components** (Phase 2) - Allow users to swap words
4. **"Deepen weave" flow** - Add reflection retroactively to timeline items
5. **Visual progression** - Weaves transform when enriched with reflection

---

Ready to test! The new system is:
- Simpler
- Clearer
- Lower friction
- Still allows full customization
- Moon phase is visible and intentional
