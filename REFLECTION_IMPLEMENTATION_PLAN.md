# Post-Interaction Reflection: Implementation Plan

## Overview

Transform the existing interaction logging system to capture **qualitative richness** through archetype-aware, psychology-grounded reflection prompts.

**Key Insight:** We already have the Moon Phase selector as our quality/vibe system - we just need to reframe it and add contextual prompts around it.

---

## What We Already Have ✅

### Existing Components:
1. **MoonPhaseSelector** (`src/components/MoonPhaseSelector.tsx`)
   - Beautiful visual selector with 5 phases
   - Already captures emotional quality/vibe
   - Perfect for representing interaction quality

2. **Interaction Form** (`app/interaction-form.tsx`)
   - Progressive disclosure flow
   - Mode → Activity → Details (date, vibe, notes)
   - Generic "Notes..." textarea

3. **Quick-Touch Logging** (Radial menu in CardGestureContext)
   - Fast, frictionless logging
   - Currently no follow-up

4. **Archetype System** (7 types in constants.ts)
   - Emperor, Empress, High Priestess, Fool, Sun, Hermit, Magician
   - Each has unique interaction multipliers

### What We're Building On:
- Moon phases already represent quality (🌑 NewMoon = challenging → 🌕 FullMoon = peak)
- Notes field exists but needs **contextual prompting**
- Archetype data includes rich descriptions we can use

---

## Implementation Strategy

### Phase 1: Enhance Manual Logging (Week 1)
**Goal:** Make the existing interaction form more meaningful

#### Step 1.1: Replace Generic Notes with Contextual Prompts

**Current State:**
```tsx
<TextInput
  style={[styles.input, styles.multilineInput]}
  placeholder="Notes..."
  value={notes}
  onChangeText={setNotes}
  multiline
/>
```

**New State:**
```tsx
<ContextualReflectionInput
  friendArchetype={friend.archetype}
  selectedMode={selectedMode}
  selectedActivity={selectedActivity}
  selectedVibe={selectedVibe}
  value={notes}
  onChange={setNotes}
/>
```

**What this component does:**
- Shows archetype-specific placeholder text
- Updates prompt based on selected mode and vibe
- Feels intelligent and personalized

**Example Prompts:**

**Before selecting vibe:**
```
Placeholder: "What happened? (1 sentence)"
```

**After selecting 🌕 FullMoon + Coffee + High Priestess friend:**
```
Prompt: "What truth or insight emerged between you?"
Placeholder: "Share what made this conversation meaningful..."
Optional follow-up button: "+ Add deeper reflection"
```

#### Step 1.2: Add "Deeper Reflection" Optional Step

After user fills basic note and selects FullMoon vibe, show gentle expansion option:

```tsx
{selectedVibe === 'FullMoon' || selectedVibe === 'WaxingGibbous' ? (
  <TouchableOpacity
    style={styles.deeperReflectionPrompt}
    onPress={() => setShowDeepReflection(true)}
  >
    <Sparkles size={16} />
    <Text>This felt special - capture the depth?</Text>
  </TouchableOpacity>
) : null}
```

**Expanded View:**
```
╔════════════════════════════════════════╗
║  Deepen Your Reflection                ║
║  ──────────────────────────────────    ║
║                                        ║
║  🔮 What truth was revealed?           ║
║  ┌──────────────────────────────────┐ ║
║  │                                  │ ║
║  └──────────────────────────────────┘ ║
║                                        ║
║  💭 What lingers in your heart?        ║
║  ┌──────────────────────────────────┐ ║
║  │                                  │ ║
║  └──────────────────────────────────┘ ║
║                                        ║
║  [Skip]                   [Save ✓]    ║
╚════════════════════════════════════════╝
```

#### Schema Changes Required:

```typescript
interactions table:
  + reflection: string (optional)           // Deeper reflection text
  + reflection_type: string (optional)      // 'quick', 'standard', 'deep'
  + last_edited: number (optional)          // For editing later
```

---

### Phase 2: Quick-Touch Micro-Reflection (Week 1-2)
**Goal:** Add gentle follow-up after radial menu logging

#### Current Quick-Touch Flow:
1. Long-press card → Radial menu appears
2. Drag to activity (e.g., ☕ Coffee)
3. Release → Toast "Logged Coffee with Sarah"
4. **Done** ❌

#### New Flow:
1. Long-press card → Radial menu appears
2. Drag to activity → Release
3. Toast "Logged Coffee with Sarah"
4. **After 2 seconds:** Micro-reflection prompt slides up 🆕

**Micro-Reflection Component:**

```tsx
<MicroReflectionSheet
  friend={friend}
  activity={activityLabel}
  interactionId={newInteractionId}
  onSkip={handleSkip}
  onCapture={handleCapture}
/>
```

**Visual:**
```
╔════════════════════════════════════╗
║                                    ║
║  ✨ How did that feel?             ║
║                                    ║
║  Coffee with Sarah                 ║
║                                    ║
║  ┌──────────────────────────────┐ ║
║  │ 🎤 Voice note or text...     │ ║
║  └──────────────────────────────┘ ║
║                                    ║
║  [Skip]              [Save ✓]     ║
╚════════════════════════════════════╝
```

**Key Features:**
- **Voice input option** (future: expo-av)
- **Single open-ended question**
- **Takes 15 seconds max**
- **Easy to skip without guilt**

**After capture, optionally add Moon Phase:**
```
Thanks for capturing that moment!

How did it feel?
🌑 🌒 🌓 🌔 🌕

[Skip]  [Save vibe]
```

---

### Phase 3: Edit Past Reflections (Week 2)
**Goal:** Allow users to add thoughts to past interactions

#### Update InteractionDetailModal:

**Current:**
```tsx
<InfoRow icon={...} title={...} subtitle={...} />
// Just displays info
```

**New:**
```tsx
<InfoRow icon={...} title={...} subtitle={...} />

{interaction.note && (
  <View style={styles.reflectionCard}>
    <Text style={styles.reflectionLabel}>Your Notes</Text>
    <Text style={styles.reflectionText}>{interaction.note}</Text>
  </View>
)}

{interaction.reflection && (
  <View style={styles.reflectionCard}>
    <Text style={styles.reflectionLabel}>Reflection</Text>
    <Text style={styles.reflectionText}>{interaction.reflection}</Text>
  </View>
)}

<TouchableOpacity
  style={styles.editButton}
  onPress={() => setShowReflectionEditor(true)}
>
  <Edit size={20} />
  <Text>Add Reflection</Text>
</TouchableOpacity>
```

**Reflection Editor Modal:**
```tsx
<ReflectionEditorModal
  interaction={interaction}
  friend={friend}
  onSave={handleSaveReflection}
  onClose={() => setShowReflectionEditor(false)}
/>
```

**Content:**
```
╔════════════════════════════════════════╗
║  Coffee with Sarah                     ║
║  3 days ago                            ║
║  ──────────────────────────────────    ║
║                                        ║
║  [Existing note shown here]            ║
║                                        ║
║  💭 Looking back, what did this mean?  ║
║  ┌──────────────────────────────────┐ ║
║  │                                  │ ║
║  └──────────────────────────────────┘ ║
║                                        ║
║  Vibe: 🌕 FullMoon [Tap to adjust]    ║
║                                        ║
║  [Save Changes]                        ║
╚════════════════════════════════════════╝
```

---

## Smart Prompt Selection Logic

### Prompt Library Structure:

```typescript
interface ReflectionPromptSet {
  archetype: Archetype;
  mode: string;
  vibe: Vibe | null;
  prompts: {
    quick: string;           // For basic notes
    deep: string[];          // For extended reflection (1-2 questions)
    retrospective: string;   // For editing past interactions
  };
}
```

### Example Prompt Sets:

**High Priestess + One-on-One + FullMoon:**
```typescript
{
  archetype: 'HighPriestess',
  mode: 'one-on-one',
  vibe: 'FullMoon',
  prompts: {
    quick: "What truth or insight emerged between you?",
    deep: [
      "What did you sense beneath the words?",
      "What question lingers in your heart from this exchange?"
    ],
    retrospective: "Looking back, what sacred truth was revealed?"
  }
}
```

**Sun + Celebration + FullMoon:**
```typescript
{
  archetype: 'Sun',
  mode: 'celebration',
  vibe: 'FullMoon',
  prompts: {
    quick: "What moment of pure joy stands out?",
    deep: [
      "How did you celebrate being together?",
      "What made you feel radiant and alive?"
    ],
    retrospective: "What will you toast to when you look back?"
  }
}
```

**Hermit + Quick-Touch + null:**
```typescript
{
  archetype: 'Hermit',
  mode: 'quick-touch',
  vibe: null,
  prompts: {
    quick: "What wisdom came through in your exchange?",
    deep: [],  // No deep prompts for quick-touch
    retrospective: "What did this quiet moment offer?"
  }
}
```

### Fallback Prompts (When no specific match):

```typescript
const FALLBACK_PROMPTS = {
  quick: "What made this moment special?",
  deep: [
    "What did you appreciate about this time together?",
    "What will you remember?"
  ],
  retrospective: "Looking back, what did this connection offer?"
};
```

---

## Reframing Moon Phases for Reflection

### Current Moon Phase Microcopy:
```typescript
{ phase: "NewMoon", icon: "🌑", microcopy: "The night is dark. A new thread awaits." }
{ phase: "WaxingCrescent", icon: "🌒", microcopy: "The crescent stirs with quiet promise." }
{ phase: "FullMoon", icon: "🌕", microcopy: "The moon is full, the bond complete." }
```

### Enhanced Microcopy for Reflection Context:

**When selecting vibe in manual log:**
```typescript
{ phase: "NewMoon", icon: "🌑", microcopy: "Challenging - but honest and real" }
{ phase: "WaxingCrescent", icon: "🌒", microcopy: "Pleasant - a gentle connection" }
{ phase: "FirstQuarter", icon: "🌓", microcopy: "Good - steady and nourishing" }
{ phase: "WaxingGibbous", icon: "🌔", microcopy: "Really meaningful - depth and warmth" }
{ phase: "FullMoon", icon: "🌕", microcopy: "Peak moment - deeply nourishing" }
```

**When adding vibe in micro-reflection:**
```typescript
"How did this feel?"
🌑 Difficult
🌒 Pleasant
🌓 Good
🌔 Meaningful
🌕 Magical
```

---

## New Components to Build

### 1. `ContextualReflectionInput.tsx`
Smart text input that shows archetype-aware prompts

**Props:**
```typescript
interface ContextualReflectionInputProps {
  friendArchetype: Archetype;
  selectedMode: string;
  selectedActivity: string;
  selectedVibe: Vibe | null;
  value: string;
  onChange: (text: string) => void;
}
```

### 2. `MicroReflectionSheet.tsx`
Bottom sheet for quick-touch follow-up

**Props:**
```typescript
interface MicroReflectionSheetProps {
  friend: Friend;
  activity: string;
  interactionId: string;
  onSkip: () => void;
  onCapture: (reflection: string, vibe?: Vibe) => void;
}
```

### 3. `DeepReflectionForm.tsx`
Optional expansion for manual logs with 2-3 contextual questions

**Props:**
```typescript
interface DeepReflectionFormProps {
  archetype: Archetype;
  mode: string;
  vibe: Vibe;
  onSave: (reflections: string[]) => void;
  onSkip: () => void;
}
```

### 4. `ReflectionEditorModal.tsx`
For editing past interactions

**Props:**
```typescript
interface ReflectionEditorModalProps {
  interaction: Interaction;
  friend: Friend;
  onSave: (updates: Partial<Interaction>) => void;
  onClose: () => void;
}
```

### 5. `reflectionPrompts.ts` (Utility)
Prompt selection logic

```typescript
export function selectPrompts(
  archetype: Archetype,
  mode: string,
  vibe: Vibe | null,
  activity: string
): ReflectionPromptSet {
  // Smart matching logic
  // Returns contextual prompts
}
```

---

## Database Migration

### Schema Version: 8 → 9

**File: `src/db/schema.ts`**

```typescript
export default appSchema({
  version: 9,
  tables: [
    // ... existing tables ...
    tableSchema({
      name: 'interactions',
      columns: [
        // Existing columns
        { name: 'interaction_date', type: 'number' },
        { name: 'interaction_type', type: 'string' },
        { name: 'duration', type: 'string', isOptional: true },
        { name: 'vibe', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'activity', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'mode', type: 'string' },
        { name: 'created_at', type: 'number' },

        // NEW FIELDS
        { name: 'reflection', type: 'string', isOptional: true },
        { name: 'reflection_type', type: 'string', isOptional: true },
        { name: 'last_edited', type: 'number', isOptional: true },
      ]
    })
  ]
})
```

**Migration:**
```typescript
// src/db/index.ts
migrations: [
  {
    toVersion: 9,
    steps: [
      addColumns({
        table: 'interactions',
        columns: [
          { name: 'reflection', type: 'string', isOptional: true },
          { name: 'reflection_type', type: 'string', isOptional: true },
          { name: 'last_edited', type: 'number', isOptional: true },
        ]
      })
    ]
  }
]
```

**Update Model:**
```typescript
// src/db/models/Interaction.ts
export default class Interaction extends Model {
  // ... existing fields ...

  @field('reflection') reflection?: string;
  @field('reflection_type') reflectionType?: string;
  @date('last_edited') lastEdited?: Date;
}
```

---

## Implementation Timeline

### Week 1: Foundation
**Days 1-2:**
- [ ] Create schema migration (v8 → v9)
- [ ] Update Interaction model with new fields
- [ ] Create `reflectionPrompts.ts` utility with prompt library
- [ ] Build `ContextualReflectionInput` component

**Days 3-4:**
- [ ] Integrate contextual prompts into manual log form
- [ ] Test prompt selection logic with all archetypes
- [ ] Add "deeper reflection" optional expansion
- [ ] Polish animations and UX flow

**Day 5:**
- [ ] Create `MicroReflectionSheet` component
- [ ] Test bottom sheet animations
- [ ] Integrate with CardGestureContext (add 2-sec delay trigger)

### Week 2: Enhancement & Polish
**Days 6-7:**
- [ ] Build `ReflectionEditorModal` component
- [ ] Add "Reflect" button to InteractionDetailModal
- [ ] Test editing past interactions
- [ ] Ensure last_edited timestamp updates

**Days 8-9:**
- [ ] Polish all reflection UX (typography, spacing, colors)
- [ ] Add voice input placeholder UI (actual implementation later)
- [ ] Test full user journeys (quick-touch, manual, editing)
- [ ] Fix any bugs

**Day 10:**
- [ ] User testing & feedback
- [ ] Documentation
- [ ] Prepare for rollout

---

## Success Metrics (Track After 2 Weeks)

### Adoption:
- % of quick-touches that add micro-reflection (Goal: 30%+)
- % of manual logs with notes/reflection (Goal: 60%+)
- Avg reflection length (Goal: 15+ words)

### Engagement:
- % of users who edit past reflections (Goal: 10%+)
- % of users who expand to "deeper reflection" (Goal: 15%+)

### Quality:
- User feedback: "Does reflection feel meaningful?" (Goal: 80%+ positive)
- Archetype-prompt match satisfaction

---

## Future Enhancements (Phase 2)

1. **Voice Memos** - Record audio reflections with expo-av
2. **Emotion Tags** - Quick-select emotions (joyful, deep, easy, challenging)
3. **Reflection Timeline** - Dedicated view showing all reflections
4. **Quality Analytics** - Show quality trends over time
5. **Share Reflections** - Export beautiful cards of favorite memories
6. **AI Summary** - Monthly AI-generated relationship summaries

---

## Conclusion

This implementation plan transforms Weave's interaction logging from **transactional tracking** to **intentional relationship awareness**. By:

1. **Leveraging existing Moon Phase UI** as quality/vibe system
2. **Adding archetype-aware contextual prompts**
3. **Creating gentle, optional micro-reflections**
4. **Enabling retrospective meaning-making**

We turn every weave into an opportunity for **savoring, gratitude, and relational mindfulness**.

The difference between:
- "I had coffee with Sarah"
- "Sarah and I dove deep over coffee - she opened up about her fears around the new job, and I realized how much I trust her with my own vulnerabilities. These conversations are why she's irreplaceable."

That's what we're building.
