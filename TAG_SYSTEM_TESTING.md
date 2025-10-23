# Tag/Chip System - Testing Guide

## What's Been Built

The interactive tag/chip reflection system is now complete and integrated into the interaction form. Here's what you can test:

### 1. **ReflectionTagChips Component** (`src/components/ReflectionTagChips.tsx`)
   - Displays contextual tags organized by type (What, Did, How, Felt)
   - Horizontally scrollable chips within each type group
   - Multi-select functionality (tap to select/deselect)
   - Visual feedback with animations and color changes
   - "Show more tags..." button to expand tag library
   - Smart tag selection based on category, archetype, and vibe

### 2. **Enhanced ContextualReflectionInput** (`src/components/ContextualReflectionInput.tsx`)
   - **Two modes:**
     - **Tag mode** (default): Tap chips to build reflection
     - **Freeform mode**: Type freely like before
   - Toggle between modes with "Type instead" / "Use tags" button
   - Real-time preview of assembled text from selected tags
   - Optional custom details field (hybrid mode: tags + custom text)
   - Contextual prompts based on category/archetype/vibe

### 3. **Integration** (`app/interaction-form.tsx`)
   - Tag system enabled by default with `enableTags={true}`
   - Works seamlessly with existing vibe selector
   - Friend archetype automatically loaded for contextual tag selection

## How to Test

### Basic Flow:
1. **Start the app:** `npm start`
2. **Navigate to a friend's profile**
3. **Tap "Log a Moment"** or **"Plan Time"**
4. **Select a category** (e.g., "Deep Talk", "Meal/Drink")
5. **In the "Add Details" section:**
   - You'll see the contextual prompt question
   - Below that, see 4 groups of tags: **What**, **Did**, **How**, **Felt**
   - **Scroll horizontally** within each group to see more tags
   - **Tap tags** to select them (they'll highlight with primary color)
   - Watch the **"Preview:"** box update with assembled text
   - Optionally **add custom details** in the text field below
   - Or tap **"Type instead"** to switch to freeform mode

### Test Scenarios:

#### Scenario 1: Deep Talk with High Priestess
- Select friend with **High Priestess** archetype
- Choose **"Deep Talk"** category
- Select **Full Moon** vibe
- **Expected tags:** fears, vulnerable, sacred, truth, seen-deeply, trusted
- **Example combination:** `fears` + `vulnerable` + `seen` = "Opened up about fears - something vulnerable. Felt deeply seen."

#### Scenario 2: Meal/Drink with Fool
- Select friend with **Fool** archetype
- Choose **"Meal/Drink"** category
- Select **Waxing Crescent** vibe (good time)
- **Expected tags:** spontaneous, laughed, random-stuff, fun, easy
- **Example combination:** `random-stuff` + `laughed` + `easy` = "Talked about random stuff and laughed together. It was easy and fun."

#### Scenario 3: Hangout with Empress
- Select friend with **Empress** archetype
- Choose **"Hangout"** category
- No vibe selected (neutral)
- **Expected tags:** cozy, comfortable, nourishing, cherished, cared-for
- **Example combination:** `cozy` + `comfortable` + `recharged` = "Felt cozy and comfortable. Recharged together."

#### Scenario 4: Hybrid Mode (Tags + Custom Text)
- Select any category
- Choose 2-3 tags
- Add custom details like: "We sat by the lake and watched the sunset"
- **Expected result:** Assembled tags + your custom text = "Talked about work and felt understood. We sat by the lake and watched the sunset."

#### Scenario 5: Freeform Mode
- Select any category
- Tap **"Type instead"**
- Type reflection like before
- **Expected result:** Works exactly like the old system

### What to Look For:

✅ **Context-aware tags:** Different categories show relevant tags
✅ **Archetype influence:** High Priestess gets "sacred, intuitive", Fool gets "spontaneous, playful"
✅ **Vibe boosting:** Full Moon shows more vulnerability/depth tags
✅ **Natural assembly:** Selected tags combine into readable sentences
✅ **Type diversity:** Mix of topic, action, quality, connection tags
✅ **Smooth animations:** Tags zoom in on load, chips scale on selection
✅ **Visual feedback:** Selected chips highlighted, disabled chips when limit reached
✅ **Preview updates:** Real-time preview of assembled text

### Potential Issues to Watch:

⚠️ **Tag limit:** Can only select 5 tags max (intentional)
⚠️ **Assembly quality:** Some tag combinations might read awkwardly (report these!)
⚠️ **Performance:** Scrolling should be smooth with 30+ tags
⚠️ **Mode switching:** Should preserve custom text when switching modes

## Tag Library Stats

- **100+ tags** across 4 types
- **Universal tags:** work, relationships, family, dreams, struggles, good-news
- **Category-specific:** deep-talk gets fears/vulnerable, meal-drink gets nourishing/lingered
- **Archetype-influenced:** Each archetype has 4-8 unique quality/connection tags
- **Vibe-boosted:** Full Moon boosts vulnerability, New Moon boosts honesty/support

## Example Assembled Texts

**Deep Talk + High Priestess + Full Moon:**
- `fears` + `vulnerable` + `seen` → "Opened up about fears - something vulnerable. Felt deeply seen."

**Meal/Drink + Empress + Good:**
- `work` + `nourishing` + `cherished` → "Talked about work - something nourishing. Felt cherished."

**Hangout + Fool + Great:**
- `spontaneous` + `laughed` + `alive` → "Did something spontaneous and laughed together. Felt alive."

**Event/Party + Sun + Peak:**
- `danced` + `radiant` + `celebrated` → "Danced together - felt radiant. Celebrated life."

## Next Steps (Not Yet Built)

1. **"Deepen Weave" Flow** - Add reflection retroactively to quick weaves from timeline
2. **Visual Progression** - Weaves transform aesthetically when enriched with reflection data
3. **Reward Animation** - Satisfying animation when completing a deep weave

## Architecture Notes

The system uses three key modules:

1. **reflection-tags.ts** - Tag library, selector, assembler
2. **ReflectionTagChips.tsx** - Interactive chip UI
3. **ContextualReflectionInput.tsx** - Hybrid input with tag + freeform modes

All data-driven, easy to expand by adding tag objects to the library!
