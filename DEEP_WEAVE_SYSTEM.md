# Deep Weave System: Enriching Reflections Through Context

## Philosophy Shift

### ❌ What We're Avoiding:
- Hashtags (#DeepTalk, #Vulnerable) - too Twitter/Instagram
- Visible tagging UI - feels performative and millennial
- Manual categorization - creates friction

### ✅ What We're Building:
- **Invisible intelligence** - system learns from natural language
- **Guided depth** - optional structured prompts for richer capture
- **Pattern recognition** - NLP extracts meaning without user effort
- **Contextual scoring** - quality detected, not declared

---

## The Deep Weave Flow

### Standard Weave (Quick Capture)
**User Journey:**
1. Select type: "Meal/Drink" 🍽️
2. Select when/vibe
3. Single prompt: "What did you talk about over coffee?"
4. Write brief note: "Sarah opened up about her career transition"
5. Save

**Behind the scenes:**
- NLP detects: "opened up" → marks as **vulnerable/meaningful**
- Scoring: Meal (22) × FullMoon (1.3) × **depth_detected (1.2)** = 34 pts
- Pattern stored: "Coffee with Sarah often involves depth"

---

### Deep Weave (Optional Expansion)

**Trigger:** User selects FullMoon vibe OR writes meaningful reflection

**Gentle prompt appears:**
```
╔════════════════════════════════════════╗
║  This sounds meaningful...             ║
║                                        ║
║  Want to capture the depth?            ║
║                                        ║
║  [Not now]            [Reflect →]     ║
╚════════════════════════════════════════╝
```

**If "Reflect →"** - Structured Deep Weave form opens

---

## Deep Weave Structured Prompts

### Not Tags - **Reflection Dimensions**

Instead of "add a tag," we ask **dimensional questions** that paint a richer picture:

```
╔════════════════════════════════════════╗
║  Deep Weave: Coffee with Sarah         ║
║  ────────────────────────────────────  ║
║                                        ║
║  The Conversation                      ║
║  ─────────────────                     ║
║                                        ║
║  What did you talk about?              ║
║  ○ Surface-level catch-up              ║
║  ● Deep personal sharing               ║
║  ○ Ideas and intellectual exchange     ║
║  ○ Future dreams and plans             ║
║  ○ Past memories and stories           ║
║                                        ║
║  The Energy                            ║
║  ───────────                           ║
║                                        ║
║  How did this feel?                    ║
║  ○ Light and playful                   ║
║  ○ Comfortable and easy                ║
║  ● Intimate and vulnerable             ║
║  ○ Energizing and inspiring            ║
║  ○ Contemplative and quiet             ║
║                                        ║
║  The Connection                        ║
║  ────────────────                      ║
║                                        ║
║  What deepened?                        ║
║  ☑ Trust                               ║
║  ☑ Understanding                       ║
║  ☐ Shared vision                       ║
║  ☐ Playfulness                         ║
║  ☐ Support                             ║
║                                        ║
║  [Skip Rest]              [Continue]   ║
╚════════════════════════════════════════╝
```

**If Continue:**

```
╔════════════════════════════════════════╗
║  The Details (optional)                ║
║  ─────────────────────                 ║
║                                        ║
║  Was this...                           ║
║  ☑ One-on-one                          ║
║  ☐ With others too                     ║
║                                        ║
║  ☑ Planned in advance                  ║
║  ☐ Spontaneous                         ║
║                                        ║
║  ☐ First time doing this               ║
║  ☑ Familiar ritual                     ║
║                                        ║
║  ☑ Long overdue                        ║
║  ☐ Recent reconnection                 ║
║                                        ║
║  The Memory                            ║
║  ──────────                            ║
║                                        ║
║  What will you remember?               ║
║  ┌──────────────────────────────────┐ ║
║  │ The way Sarah's eyes lit up when │ ║
║  │ talking about the new job        │ ║
║  └──────────────────────────────────┘ ║
║                                        ║
║  [Save Deep Weave]                     ║
╚════════════════════════════════════════╝
```

---

## NLP-Powered Context Detection

### Invisible Intelligence

**System reads reflection text and detects patterns:**

```typescript
interface ContextSignals {
  depth: 'surface' | 'meaningful' | 'profound';
  emotional_tone: 'joyful' | 'vulnerable' | 'contemplative' | 'energizing' | 'challenging';
  novelty: 'routine' | 'fresh' | 'novel';
  vulnerability: number; // 0-1 score
  playfulness: number;   // 0-1 score
  intimacy: number;      // 0-1 score
}
```

### Detection Patterns

#### Depth Detection:
```typescript
const DEPTH_SIGNALS = {
  profound: [
    'opened up', 'vulnerable', 'shared something deep',
    'truth', 'honest', 'real talk', 'breakthrough',
    'cried', 'tears', 'emotional', 'raw'
  ],
  meaningful: [
    'talked about', 'discussed', 'shared',
    'learned', 'understood', 'connected',
    'important', 'meaningful', 'significant'
  ],
  surface: [
    'caught up', 'quick chat', 'checked in',
    'brief', 'casual', 'light'
  ]
};
```

#### Emotional Tone:
```typescript
const TONE_SIGNALS = {
  vulnerable: [
    'opened up', 'shared', 'admitted', 'confessed',
    'scared', 'worried', 'struggling', 'hard time',
    'difficult', 'challenging', 'heavy'
  ],
  joyful: [
    'laughed', 'hilarious', 'so much fun', 'joy',
    'happy', 'celebrating', 'amazing', 'wonderful',
    'love', 'grateful', 'blessed'
  ],
  contemplative: [
    'reflected', 'pondered', 'wondered', 'quiet',
    'thoughtful', 'deep', 'philosophical', 'meaning',
    'purpose', 'existential'
  ],
  energizing: [
    'inspired', 'motivated', 'excited', 'pumped',
    'energized', 'alive', 'possibility', 'vision',
    'dreams', 'plans', 'future'
  ]
};
```

#### Novelty Detection:
```typescript
const NOVELTY_SIGNALS = {
  novel: [
    'first time', 'never', 'new', 'tried',
    'explored', 'discovered', 'different',
    'unexpected', 'surprise'
  ],
  routine: [
    'usual', 'regular', 'normal', 'typical',
    'as always', 'like we always do'
  ]
};
```

#### Vulnerability Scoring:
```typescript
function calculateVulnerabilityScore(text: string): number {
  const vulnerabilityMarkers = [
    'opened up', 'shared something personal',
    'admitted', 'confessed', 'told them about',
    'vulnerable', 'emotional', 'cried',
    'secret', 'never told anyone', 'first time saying',
    'scared to share', 'hard to talk about'
  ];

  let score = 0;
  const lowerText = text.toLowerCase();

  vulnerabilityMarkers.forEach(marker => {
    if (lowerText.includes(marker)) {
      score += 0.2;
    }
  });

  // Bonus for longer, detailed reflections (indicates emotional processing)
  if (text.length > 100) score += 0.1;
  if (text.length > 200) score += 0.1;

  return Math.min(1.0, score);
}
```

---

## Scoring Adjustments Based on Context

### Context Multipliers (Invisible to User)

```typescript
function calculateContextualScore(
  baseScore: number,
  reflection: string,
  structuredData?: DeepWeaveData
): number {

  // NLP detection
  const signals = detectContextSignals(reflection);

  let multiplier = 1.0;

  // Depth bonus
  if (signals.depth === 'profound') multiplier *= 1.3;
  else if (signals.depth === 'meaningful') multiplier *= 1.15;

  // Vulnerability bonus (deep sharing strengthens bonds)
  multiplier *= (1.0 + (signals.vulnerability * 0.3));

  // Novelty bonus (new experiences create memories)
  if (signals.novelty === 'novel') multiplier *= 1.15;

  // If user filled Deep Weave form, extra bonus for effort
  if (structuredData) {
    multiplier *= 1.1;

    // Specific bonuses based on selections
    if (structuredData.conversation === 'deep_personal_sharing') {
      multiplier *= 1.2;
    }
    if (structuredData.connection_deepened.includes('trust')) {
      multiplier *= 1.1;
    }
    if (structuredData.connection_deepened.includes('vulnerability')) {
      multiplier *= 1.15;
    }
  }

  return Math.round(baseScore * multiplier);
}
```

### Example Calculations:

**Scenario 1: Quick coffee, brief chat**
```
Type: Meal/Drink (22 pts)
Vibe: WaxingCrescent (1.0x)
Reflection: "Quick coffee to catch up on the week"
NLP detected: depth=surface
Final: 22 pts
```

**Scenario 2: Deep coffee conversation**
```
Type: Meal/Drink (22 pts)
Vibe: FullMoon (1.3x)
Reflection: "Sarah opened up about her fears around the job transition.
We talked for 2 hours - she shared things she'd been holding for months.
Felt really close and trusted."

NLP detected:
- depth=profound (1.3x)
- vulnerability=0.8 (1.24x)
- emotional_tone=vulnerable

Final: 22 × 1.3 × 1.3 × 1.24 = 47 pts
```

**Scenario 3: Deep Weave form completed**
```
Same as above + Deep Weave selections:
- Conversation: "Deep personal sharing"
- Energy: "Intimate and vulnerable"
- Connection deepened: Trust, Understanding

Bonuses:
- Deep Weave completion (1.1x)
- Deep personal sharing (1.2x)
- Trust deepened (1.1x)

Final: 22 × 1.3 × 1.3 × 1.24 × 1.1 × 1.2 × 1.1 = 68 pts!
```

---

## Deep Weave Dimensions (Structured Data)

### Data Schema:

```typescript
interface DeepWeaveData {
  // The Conversation
  conversation:
    | 'surface_catchup'
    | 'deep_personal_sharing'
    | 'intellectual_exchange'
    | 'future_dreams'
    | 'past_memories'
    | null;

  // The Energy
  energy:
    | 'light_playful'
    | 'comfortable_easy'
    | 'intimate_vulnerable'
    | 'energizing_inspiring'
    | 'contemplative_quiet'
    | null;

  // The Connection (multi-select)
  connection_deepened: Array<
    | 'trust'
    | 'understanding'
    | 'shared_vision'
    | 'playfulness'
    | 'support'
    | 'intimacy'
  >;

  // The Details (checkboxes)
  was_one_on_one: boolean;
  was_spontaneous: boolean;
  was_first_time: boolean;
  was_overdue: boolean;

  // The Memory (free text)
  memorable_moment?: string;
}
```

### Database Schema Update:

```typescript
interactions table:
  // Existing fields
  - interaction_date: number
  - interaction_type: string
  - vibe: string (optional)
  - note: string (optional)

  // New fields
  + reflection: string (optional)              // Basic reflection
  + deep_weave_data: string (optional)         // JSON of DeepWeaveData
  + context_signals: string (optional)         // JSON of NLP-detected signals
  + context_score_multiplier: number (default: 1.0)
  + last_edited: number (optional)
```

---

## Deep Weave Prompts by Archetype

### Conversation Dimension - Archetype Variations:

**High Priestess:**
- "What truth was revealed?"
- Options: Surface / **Sacred sharing** / Mystical exchange / Dreams / Stories

**Emperor:**
- "What was discussed?"
- Options: Logistics / **Goals and plans** / Achievements / Structure / Vision

**Empress:**
- "What was nurtured?"
- Options: Catch-up / **Heart sharing** / Beauty discussed / Comfort / Memories

**Fool:**
- "What sparked joy?"
- Options: Silly talk / **Adventure planning** / Playful ideas / Dreams / Stories

**Sun:**
- "What was celebrated?"
- Options: Updates / **Wins and joys** / Inspiration / Vision / Memories

**Hermit:**
- "What was contemplated?"
- Options: Small talk / **Life's meaning** / Philosophy / Silence / Wisdom

**Magician:**
- "What was created?"
- Options: Brainstorm / **Vision and plans** / Strategy / Possibility / Stories

**Lover:**
- "What deepened between you?"
- Options: Connection / **Vulnerable intimacy** / Emotional truth / Future / Past

---

## Pattern Recognition & Insights

### What the System Learns (Invisibly):

```typescript
interface FriendshipPattern {
  friend_id: string;
  archetype: Archetype;

  // Detected patterns
  typical_depth: 'surface' | 'meaningful' | 'profound';
  typical_energy: string;
  strength_areas: string[];  // e.g., ['trust', 'playfulness']

  // Context patterns
  best_settings: string[];   // e.g., ['coffee', 'walks', 'home']
  best_format: string;       // e.g., 'one-on-one'

  // Quality indicators
  avg_vulnerability_score: number;
  peak_moments: Array<{
    interaction_id: string;
    what_made_it_special: string;
  }>;
}
```

### Insights Surfaced to User:

**In Friend Profile:**
```
╔════════════════════════════════════════╗
║  Sarah's Friendship Pattern            ║
║  ────────────────────────────────────  ║
║                                        ║
║  Your connection thrives on:           ║
║  • Deep one-on-one conversations       ║
║  • Trust and vulnerable sharing        ║
║  • Coffee dates and long walks         ║
║                                        ║
║  Peak moments together:                ║
║  🌕 "The way Sarah's eyes lit up..."   ║
║      (Coffee, 3 months ago)            ║
║                                        ║
║  🌕 "We talked about her mother..."    ║
║      (Walk, 6 months ago)              ║
║                                        ║
╚════════════════════════════════════════╝
```

**Suggestion Engine Uses This:**
```
Sarah (High Priestess, score 45) hasn't connected in 2 weeks.

Detected pattern: Your best connections happen over coffee.
Last profound moment: 3 months ago.

Suggestion: "Invite Sarah for coffee - your deep talks nourish you both."
```

---

## Implementation: NLP Detection Service

### `src/lib/context-detection.ts`

```typescript
import { ContextSignals, DeepWeaveData } from '../types';

export class ContextDetector {

  static detectSignals(reflectionText: string): ContextSignals {
    const text = reflectionText.toLowerCase();

    return {
      depth: this.detectDepth(text),
      emotional_tone: this.detectTone(text),
      novelty: this.detectNovelty(text),
      vulnerability: this.calculateVulnerabilityScore(text),
      playfulness: this.calculatePlayfulnessScore(text),
      intimacy: this.calculateIntimacyScore(text),
    };
  }

  private static detectDepth(text: string): 'surface' | 'meaningful' | 'profound' {
    const profoundMarkers = [
      'opened up', 'vulnerable', 'shared something deep',
      'truth', 'honest conversation', 'real talk', 'breakthrough',
      'cried', 'tears', 'emotional', 'raw', 'sacred'
    ];

    const meaningfulMarkers = [
      'talked about', 'discussed', 'shared',
      'learned', 'understood', 'connected',
      'important', 'meaningful', 'significant'
    ];

    const profoundCount = profoundMarkers.filter(m => text.includes(m)).length;
    const meaningfulCount = meaningfulMarkers.filter(m => text.includes(m)).length;

    if (profoundCount >= 2) return 'profound';
    if (profoundCount >= 1 || meaningfulCount >= 2) return 'meaningful';
    return 'surface';
  }

  private static detectTone(text: string): string {
    const tones = {
      vulnerable: ['opened up', 'shared', 'scared', 'difficult', 'struggling'],
      joyful: ['laughed', 'fun', 'joy', 'happy', 'amazing', 'love'],
      contemplative: ['reflected', 'wondered', 'philosophical', 'meaning'],
      energizing: ['inspired', 'excited', 'motivated', 'alive', 'possibility']
    };

    let maxScore = 0;
    let detectedTone = 'neutral';

    Object.entries(tones).forEach(([tone, markers]) => {
      const score = markers.filter(m => text.includes(m)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedTone = tone;
      }
    });

    return detectedTone;
  }

  private static calculateVulnerabilityScore(text: string): number {
    const markers = [
      'opened up', 'shared something personal', 'admitted',
      'vulnerable', 'emotional', 'cried', 'secret',
      'never told', 'first time saying', 'hard to talk about'
    ];

    let score = 0;
    markers.forEach(m => {
      if (text.includes(m)) score += 0.15;
    });

    if (text.length > 100) score += 0.1;
    if (text.length > 200) score += 0.15;

    return Math.min(1.0, score);
  }

  static calculateContextMultiplier(
    signals: ContextSignals,
    deepWeaveData?: DeepWeaveData
  ): number {
    let multiplier = 1.0;

    // Depth bonus
    if (signals.depth === 'profound') multiplier *= 1.3;
    else if (signals.depth === 'meaningful') multiplier *= 1.15;

    // Vulnerability bonus
    multiplier *= (1.0 + (signals.vulnerability * 0.3));

    // Playfulness bonus (joy matters too!)
    multiplier *= (1.0 + (signals.playfulness * 0.2));

    // Intimacy bonus
    multiplier *= (1.0 + (signals.intimacy * 0.25));

    // Deep Weave completion bonus
    if (deepWeaveData) {
      multiplier *= 1.1;

      if (deepWeaveData.conversation === 'deep_personal_sharing') {
        multiplier *= 1.2;
      }
      if (deepWeaveData.energy === 'intimate_vulnerable') {
        multiplier *= 1.15;
      }
      if (deepWeaveData.connection_deepened.includes('trust')) {
        multiplier *= 1.1;
      }
    }

    return multiplier;
  }
}
```

---

## UI Components Needed

### 1. `DeepWeavePrompt.tsx`
Gentle invitation after meaningful reflection detected

```tsx
interface DeepWeavePromptProps {
  onAccept: () => void;
  onDecline: () => void;
}
```

### 2. `DeepWeaveForm.tsx`
Multi-step structured reflection form

```tsx
interface DeepWeaveFormProps {
  friendArchetype: Archetype;
  interactionType: InteractionType;
  onSave: (data: DeepWeaveData) => void;
  onSkip: () => void;
}
```

### 3. `FriendshipPattern.tsx`
Display detected patterns in friend profile

```tsx
interface FriendshipPatternProps {
  pattern: FriendshipPattern;
  peakMoments: Interaction[];
}
```

---

## Benefits of This Approach

### ✅ Sophisticated, Not Performative
- No hashtags or social media vibes
- Feels like journaling, not posting
- Invisible intelligence vs visible categorization

### ✅ Effortless for Users
- Write naturally, system understands
- Optional depth, never required
- Richer data without more work

### ✅ Smarter Scoring
- Quality detected from language
- Vulnerability and intimacy rewarded
- Effort (Deep Weave) recognized

### ✅ Meaningful Insights
- "Your connection with Sarah thrives on deep conversations"
- Pattern recognition without user tagging
- Peak moments automatically highlighted

---

## Next Steps

Would you like me to:

**A)** Build the `ContextDetector` class with full NLP patterns

**B)** Create the DeepWeaveForm component design

**C)** Design the FriendshipPattern insights display

**D)** Build the complete scoring system with context multipliers

This feels much more **mature and intentional** - like a relationship journal, not Instagram. 🎯
