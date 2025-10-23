# Reflection Tag/Chip System - Architecture Design

## Core Concept
Allow users to build reflections by tapping pre-written chips/tags, combining them into natural sentences, with the option to add custom text.

---

## Tag Types & Hierarchy

### 1. **Topic Tags** (What you talked about)
Universal topics that work across most categories:
- `work` → "talked about work"
- `relationships` → "discussed relationships"
- `dreams` → "shared dreams"
- `struggles` → "opened up about struggles"
- `good-news` → "celebrated good news"
- `family` → "talked about family"
- `future` → "discussed the future"
- `past` → "reminisced about the past"

### 2. **Emotional Quality Tags** (How it felt)
Describe the emotional tone:
- `deep` → "something deep"
- `vulnerable` → "something vulnerable"
- `joyful` → "something joyful"
- `meaningful` → "something meaningful"
- `light` → "kept it light"
- `honest` → "got honest"
- `playful` → "stayed playful"

### 3. **Action Tags** (What you did)
Category-specific activities:
- `laughed` → "laughed together"
- `cried` → "cried together"
- `listened` → "really listened"
- `opened-up` → "opened up"
- `supported` → "supported each other"
- `celebrated` → "celebrated"
- `caught-up` → "caught up"

### 4. **Connection Tags** (Nature of connection)
- `closer` → "felt closer"
- `seen` → "felt seen"
- `understood` → "felt understood"
- `safe` → "felt safe"
- `inspired` → "felt inspired"
- `grateful` → "felt grateful"

---

## Tag Data Structure

```typescript
interface ReflectionTag {
  id: string;                      // 'work', 'deep', 'laughed'
  label: string;                   // Display text: "Work"
  type: 'topic' | 'quality' | 'action' | 'connection';

  // Context filters (when to show this tag)
  categories?: InteractionCategory[];  // Only show for certain categories
  archetypes?: Archetype[];           // Only show for certain archetypes
  vibes?: Vibe[];                     // Only show for certain vibes

  // Text generation
  template: string;                   // "talked about {label}" or "{label}"
  position?: 'start' | 'middle' | 'end';  // Preferred position in sentence

  // Metadata
  weight?: number;                    // Display priority (higher = show first)
  synonyms?: string[];                // For future text parsing
  emoji?: string;                     // Optional emoji
}
```

---

## Text Assembly Strategy

### Pattern: `[Action/Topic] + [Quality] + [Connection]`

**Examples:**
1. **Topic + Quality:**
   - `work` + `deep` → "Talked about work - something deep"

2. **Topic + Connection:**
   - `relationships` + `understood` → "Discussed relationships and felt understood"

3. **Action + Quality + Connection:**
   - `opened-up` + `vulnerable` + `closer` → "Opened up about something vulnerable and felt closer"

4. **Multiple Topics:**
   - `work` + `future` + `dreams` → "Talked about work, the future, and shared dreams"

### Assembly Rules:
1. **Start with action/topic tags** (what happened)
2. **Add quality in the middle** (how it felt)
3. **End with connection** (the impact)
4. **Use natural connectors:** "and", "about", "-"
5. **Capitalize first word, end with period**

---

## Category-Specific Tag Sets

### TEXT/CALL
**Topics:** quick-check-in, plans, updates, funny-story
**Actions:** texted, called, voice-messaged
**Quality:** brief, meaningful, timely
**Connection:** stayed-connected, thought-of-them

### MEAL/DRINK
**Topics:** work, life-updates, gossip, philosophy, advice
**Actions:** shared-meal, cooked-together, tried-something-new
**Quality:** nourishing, comfortable, indulgent
**Connection:** bonded, lingered, savored

### DEEP-TALK
**Topics:** fears, hopes, doubts, breakthroughs, beliefs, values
**Actions:** opened-up, listened-deeply, asked-questions, got-real
**Quality:** vulnerable, profound, honest, raw, sacred
**Connection:** understood, seen, trusted, closer

### HANGOUT
**Topics:** nothing-specific, random-stuff, caught-up
**Actions:** chilled, relaxed, wandered, explored
**Quality:** easy, comfortable, spontaneous, low-key
**Connection:** recharged, comfortable-silence, effortless

### EVENT/PARTY
**Topics:** mutual-friends, networking, scene, vibe
**Actions:** danced, mingled, people-watched, left-early, stayed-late
**Quality:** fun, overwhelming, exciting, draining
**Connection:** introduced-people, met-their-world, social-energy

### ACTIVITY/HOBBY
**Topics:** technique, progress, challenges, goals
**Actions:** learned, practiced, competed, created, explored
**Quality:** focused, playful, challenging, satisfying
**Connection:** teamwork, pushed-each-other, shared-passion

### CELEBRATION
**Topics:** milestone, achievement, birthday, anniversary
**Actions:** surprised, toasted, gifted, honored
**Quality:** joyful, emotional, meaningful, festive
**Connection:** proud, celebrated, witnessed

### VOICE-NOTE
**Topics:** check-in, rant, story, thought
**Actions:** rambled, vented, shared-voice
**Quality:** intimate, casual, thoughtful
**Connection:** heard, responded, async-bond

---

## Archetype-Influenced Tags

### High Priestess
**Quality tags:** sacred, intuitive, mystical, truth, depth, unspoken
**Connection tags:** soul-level, seen-deeply, trusted-with-truth

### Empress
**Quality tags:** nourishing, warm, comforting, generous, beautiful
**Connection tags:** cared-for, cherished, nurtured

### Emperor
**Quality tags:** structured, productive, strategic, accomplished
**Connection tags:** respected, aligned, accountable

### Fool
**Quality tags:** spontaneous, playful, adventurous, silly, random
**Connection tags:** laughed, surprised, alive

### Sun
**Quality tags:** radiant, celebratory, joyful, uplifting, energizing
**Connection tags:** beaming, shining, celebrated

### Hermit
**Quality tags:** quiet, contemplative, wise, solitary, reflective
**Connection tags:** peace, stillness, understood-silence

### Magician
**Quality tags:** creative, transformative, inspired, visionary
**Connection tags:** sparked-ideas, co-created, possibility

---

## Vibe-Influenced Tags

### FullMoon / WaxingGibbous (Peak moments)
**Show more:** vulnerable, profound, breakthrough, sacred, transformative
**Emphasis:** connection + emotional quality tags

### NewMoon (Challenging)
**Show more:** struggled, difficult, honest, real, supported
**Emphasis:** honesty + support tags

### FirstQuarter / WaxingCrescent (Good)
**Show more:** comfortable, pleasant, catching-up, steady
**Emphasis:** ease + consistency tags

---

## UI/UX Behavior

### Display Logic:
1. **Show 6-8 tags initially** (most relevant based on context)
2. **Horizontal scroll** for more options
3. **Group by type** with subtle dividers or spacing
4. **"More..." button** to expand full tag library

### Interaction:
1. **Tap to select** (fills in with animation)
2. **Tap again to deselect**
3. **Multi-select** (combine multiple tags)
4. **Preview text updates** in real-time as you tap
5. **Still allow typing** to add custom details

### Visual States:
- **Unselected:** Light background, muted text
- **Selected:** Accent color background, white text
- **Category indicator:** Small icon or dot (optional)

---

## Text Output Examples

### Meal/Drink + High Priestess + FullMoon
**Available tags:**
`work` `relationships` `truth` `vulnerable` `opened-up` `sacred` `understood` `closer`

**User selects:** `relationships` + `truth` + `understood`
**Output:** "Discussed relationships and shared a truth. Felt deeply understood."

### Hangout + Fool + FirstQuarter
**Available tags:**
`nothing-specific` `spontaneous` `laughed` `random-stuff` `easy` `comfortable` `recharged`

**User selects:** `random-stuff` + `laughed` + `easy`
**Output:** "Talked about random stuff and laughed. It was easy and fun."

### Deep-Talk + Hermit + FullMoon
**Available tags:**
`fears` `doubts` `quiet` `contemplative` `opened-up` `listened-deeply` `seen` `trusted`

**User selects:** `fears` + `listened-deeply` + `seen`
**Output:** "Opened up about fears. They really listened, and I felt deeply seen."

---

## Data Management

### Storage:
```typescript
// In reflection-tags.ts
export const REFLECTION_TAGS: ReflectionTag[] = [
  {
    id: 'work',
    label: 'Work',
    type: 'topic',
    template: 'talked about work',
    position: 'start',
    weight: 10,
  },
  {
    id: 'vulnerable',
    label: 'Vulnerable',
    type: 'quality',
    template: 'something vulnerable',
    position: 'middle',
    archetypes: ['HighPriestess', 'Empress'],
    vibes: ['FullMoon', 'WaxingGibbous'],
    weight: 8,
  },
  // ... more tags
];
```

### Tag Selection Algorithm:
```typescript
function selectTags(context: TagContext): ReflectionTag[] {
  // 1. Filter by category
  // 2. Filter by archetype (if specified)
  // 3. Boost by vibe (if specified)
  // 4. Sort by weight
  // 5. Return top 8-12 tags
  // 6. Ensure type diversity (mix of topics, qualities, connections)
}
```

### Text Assembly:
```typescript
function assembleTags(selectedTags: ReflectionTag[]): string {
  // 1. Group by type
  // 2. Order by position preference
  // 3. Apply templates
  // 4. Add natural connectors
  // 5. Capitalize and punctuate
  // 6. Return final text
}
```

---

## Future Enhancements

1. **Learning System:** Track which tags users select most → show those first
2. **Custom Tags:** Allow users to create their own tags
3. **Tag Synonyms:** Parse freeform text and suggest tags
4. **Combos/Patterns:** "You often select 'work + vulnerable' together"
5. **Tag Evolution:** Tags adapt based on friendship history
6. **Multi-language:** Translate tags while keeping logic

---

## Implementation Priority

### Phase 1 (MVP):
1. Core tag data structure
2. Universal topic tags (work, relationships, etc.)
3. Basic quality tags (deep, joyful, etc.)
4. Simple text assembly (concatenation)
5. Basic UI (horizontal scroll, tap to select)

### Phase 2 (Smart):
1. Category-specific tags
2. Archetype-influenced tags
3. Vibe-influenced tags
4. Smarter text assembly with connectors

### Phase 3 (Advanced):
1. Tag analytics
2. Custom tags
3. Learning/personalization
4. Rich text with emoji

---

## Success Metrics

- **Adoption:** % of reflections using tags vs pure text
- **Engagement:** Average # of tags selected per reflection
- **Coverage:** % of reflections that feel "complete" with just tags
- **Satisfaction:** User feedback on tag relevance

---

## Technical Considerations

### Performance:
- Tag filtering must be fast (<50ms)
- Text assembly must be instant
- UI must feel snappy (no lag on tap)

### Accessibility:
- Tags must have clear tap targets (min 44x44)
- Support keyboard navigation
- Screen reader friendly labels

### Flexibility:
- Easy to add new tags without code changes
- Easy to A/B test tag variants
- Easy to disable underperforming tags

---

This architecture balances flexibility (easy to expand), intelligence (context-aware), and simplicity (users just tap what resonates).
