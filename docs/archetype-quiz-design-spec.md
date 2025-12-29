# Weave Archetype Quiz - Design Specification

## Overview

A short, engaging quiz that helps users discover their friendship archetype. The result becomes their default archetype in their Weave profile, visible to friends who add them.

### Goals

1. **Reduce friction** - Self-assigned archetypes populate when friends add each other
2. **Teach the philosophy** - Questions subtly communicate how Weave thinks about friendships
3. **Create engagement** - A fun, shareable moment that feels personally insightful
4. **Accurate results** - The quiz should reliably surface the user's actual friendship style

### Design Principles

- **Grounded, not mystical** - Questions are relatable and practical. The tarot framing earns its place in the *results*, not the questions.
- **No wrong answers** - Every archetype is valid. The quiz flatters while being accurate.
- **Quick but meaningful** - Target completion time: 60-90 seconds.

---

## Quiz Format

### Structure

- **8 questions**
- **Binary choices** presented on a slider
- **Scenario-based framing** for engagement
- **Weighted scoring** based on slider position

### Slider Behaviour

Users position a slider between two options. The position determines point distribution:

| Slider Position | Points to A | Points to B |
|-----------------|-------------|-------------|
| Hard Left | 100% | 0% |
| Left-Leaning | 75% | 25% |
| Centre | 50% | 50% |
| Right-Leaning | 25% | 75% |
| Hard Right | 0% | 100% |

**Implementation note:** Use a 5-point scale internally (0, 1, 2, 3, 4) where 0 = Hard Left, 4 = Hard Right.

```typescript
function calculatePoints(
  sliderValue: number, // 0-4
  optionAPoints: ArchetypePoints,
  optionBPoints: ArchetypePoints
): ArchetypePoints {
  const aWeight = (4 - sliderValue) / 4; // 1.0 to 0.0
  const bWeight = sliderValue / 4;        // 0.0 to 1.0
  
  return mergePoints(
    multiplyPoints(optionAPoints, aWeight),
    multiplyPoints(optionBPoints, bWeight)
  );
}
```

---

## Questions & Scoring

### Q1: Social Energy
*"It's Friday evening. You're free. You feel most recharged..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | At a gathering, feeding off the energy | Sun +3, Fool +2, Emperor +2, Lovers +1 |
| B | One-on-one, fully present with someone | Hermit +3, HighPriestess +2, Empress +2 |

**What this measures:** Introvert/extrovert energy, group vs intimate preference

---

### Q2: Support Style
*"A close friend is going through a hard time. Your instinct is to..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | Talk it through - help them process and find clarity | HighPriestess +3 |
| B | Take care of them - cook, comfort, show up physically | Empress +3 |

**What this measures:** Emotional support (HP) vs practical/physical support (Empress)

---

### Q3: Staying Connected
*"Between seeing someone, you prefer to stay in touch via..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | Voice - calls, voice notes, longer messages | HighPriestess +2, Lovers +2, Empress +1 |
| B | Text - memes, links, quick check-ins | Hermit +3, Magician +2 |

**What this measures:** Communication bandwidth preference, emotional availability

---

### Q4: Best Hangouts
*"Your favourite time with friends usually involves..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | Doing something - activities, adventures, creating | Fool +2, Magician +2, Emperor +2, Sun +1 |
| B | Being together - talking, eating, existing in the same space | Empress +2, Lovers +2, HighPriestess +2, Hermit +2 |

**What this measures:** Activity-oriented vs presence-oriented connection

---

### Q5: Group Dynamics
*"At a gathering, you're usually..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | The energy - people orbit around you | Sun +3, Emperor +2 |
| B | Seeking depth - drawn to the meaningful conversations | Lovers +3, HighPriestess +2 |

**What this measures:** Centre-of-group energy vs depth-seeking within groups

---

### Q6: Making Plans
*"When it comes to making plans, you prefer..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | Things in the calendar - you like knowing what's happening | Emperor +3, Empress +2, Sun +1 |
| B | Keeping it loose - you'd rather decide in the moment | Fool +3, Magician +2 |

**What this measures:** Structure vs spontaneity

---

### Q7: Give & Take
*"In close friendships, what matters more..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | Balance - you notice when things feel one-sided | Lovers +3, Emperor +1 |
| B | Ease - you're not tracking, you just show up | Hermit +2, Fool +2, Empress +1 |

**What this measures:** Reciprocity-sensitivity (Lovers' key trait)

---

### Q8: What Energises You
*"You're more energised by..."*

| Option | Text | Scoring |
|--------|------|---------|
| A | Creating something together - a project, an idea | Magician +3 |
| B | Experiencing something together - adventure, novelty | Fool +3, Sun +1 |

**What this measures:** Creative collaboration vs experiential adventure

---

## Scoring Summary

### Max Points Per Archetype

| Archetype | Max Points | Primary Questions |
|-----------|------------|-------------------|
| Hermit | 12 | Q1B, Q3B, Q4B, Q7B |
| HighPriestess | 13 | Q1B, Q2A, Q3A, Q4B, Q5B |
| Empress | 12 | Q1B, Q2B, Q3A, Q4B, Q6A, Q7B |
| Emperor | 12 | Q1A, Q4A, Q5A, Q6A, Q7A |
| Magician | 11 | Q3B, Q4A, Q6B, Q8A |
| Fool | 12 | Q1A, Q4A, Q6B, Q7B, Q8B |
| Sun | 12 | Q1A, Q4A, Q5A, Q6A, Q8B |
| Lovers | 12 | Q1A, Q3A, Q4B, Q5B, Q7A |

### Scoring Algorithm

```typescript
interface QuizAnswer {
  questionId: number;
  sliderValue: number; // 0-4
}

interface ArchetypeScores {
  Hermit: number;
  HighPriestess: number;
  Empress: number;
  Emperor: number;
  Magician: number;
  Fool: number;
  Sun: number;
  Lovers: number;
}

function calculateResults(answers: QuizAnswer[]): {
  primary: Archetype;
  secondary: Archetype;
  scores: ArchetypeScores;
  percentages: ArchetypeScores;
} {
  // 1. Sum weighted points from all answers
  const scores = answers.reduce((acc, answer) => {
    const questionScoring = QUESTION_SCORING[answer.questionId];
    const points = calculatePoints(
      answer.sliderValue,
      questionScoring.optionA,
      questionScoring.optionB
    );
    return mergeScores(acc, points);
  }, initialScores());

  // 2. Sort archetypes by score
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a);

  // 3. Calculate percentages (normalized to top 3)
  const topThreeTotal = sorted[0][1] + sorted[1][1] + sorted[2][1];
  const percentages = Object.fromEntries(
    sorted.map(([archetype, score]) => [
      archetype,
      Math.round((score / topThreeTotal) * 100)
    ])
  );

  return {
    primary: sorted[0][0] as Archetype,
    secondary: sorted[1][0] as Archetype,
    scores,
    percentages,
  };
}
```

---

## Result Screen

### Content Structure

1. **Primary archetype reveal** (with animation)
2. **Archetype title and one-line description**
3. **Alignment breakdown** (top 3 as percentages)
4. **"What this means" paragraph**
5. **CTA: Continue to profile**

### Result Copy Per Archetype

#### Hermit
**Title:** The Hermit
**One-liner:** You value depth over frequency.
**Description:** Your friendships are intimate, patient, and don't need constant tending. You'd rather share a passion or sit in comfortable silence than make small talk. Friends come to you when they want something real.
**Alignment example:** Hermit 58% · High Priestess 24% · Magician 18%

#### High Priestess
**Title:** The High Priestess
**One-liner:** You're the friend people come to for clarity.
**Description:** You hold space. You listen deeply. Your friendships are built on emotional honesty and meaningful conversation. People trust you with their inner world, and you honour that.
**Alignment example:** High Priestess 52% · Hermit 28% · Empress 20%

#### Empress
**Title:** The Empress
**One-liner:** You nurture through presence.
**Description:** You show love by showing up - with food, with comfort, with care. Your home is a haven for your people. You create warmth wherever you go, and friendships flourish around you.
**Alignment example:** Empress 48% · High Priestess 30% · Lovers 22%

#### Emperor
**Title:** The Emperor
**One-liner:** You bring structure to connection.
**Description:** You're the one who makes plans happen. Reliable, consistent, and intentional - your friendships have rhythm because you create it. People know they can count on you.
**Alignment example:** Emperor 55% · Sun 25% · Magician 20%

#### Magician
**Title:** The Magician
**One-liner:** You connect through creation.
**Description:** Your best friendships involve making something together - ideas, projects, possibilities. You're energised by collaboration and inspired by people who challenge you to grow.
**Alignment example:** Magician 50% · Hermit 28% · Fool 22%

#### Fool
**Title:** The Fool
**One-liner:** You're the spark.
**Description:** Life is an adventure, and your friendships are part of the journey. You say yes, suggest the unexpected, and pull people out of their routines. With you, things happen.
**Alignment example:** Fool 54% · Sun 26% · Magician 20%

#### Sun
**Title:** The Sun
**One-liner:** You bring the joy.
**Description:** Your energy is magnetic. You light up rooms, gather people together, and turn ordinary moments into celebrations. Friendships with you feel like sunshine.
**Alignment example:** Sun 52% · Fool 28% · Lovers 20%

#### Lovers
**Title:** The Lovers
**One-liner:** You seek true connection.
**Description:** You're drawn to depth within the social world. At any gathering, you're having the realest conversation in the room. You notice the give and take, and you value friends who meet you there.
**Alignment example:** Lovers 48% · High Priestess 30% · Sun 22%

---

## Edge Cases

### Ties

If two archetypes have scores within 0.5 points of each other after weighting:

**Option A: Show as blend**
"You're a Hermit-Magician blend" with both descriptions shortened.

**Option B: Use tiebreaker hierarchy**
If tied, prefer the archetype that scored higher on more questions (breadth over depth).

**Recommendation:** Option A feels more honest and interesting. Blends are real.

### Flat Distribution

If no archetype has more than 15% lead over the others (very centrist answers):

Show result as "Adaptable" with copy like:
> "You're fluid - you adapt your friendship style to the person and moment. Here's how you lean..."

Then show top 3 with roughly even percentages.

### All Sliders Centred

If user puts every slider at dead centre (possibly rushing):

Prompt: "Looks like you're right in the middle on everything. Want to revisit any questions, or see your balanced result?"

---

## UX Flow

### Screens

1. **Intro Screen**
   - Headline: "Discover Your Archetype"
   - Subhead: "8 quick questions about how you connect"
   - CTA: "Let's go"

2. **Question Screens (×8)**
   - Progress indicator (dots or bar)
   - Question text (scenario framing)
   - Option A label (left)
   - Slider
   - Option B label (right)
   - Next button (enabled after slider moved)

3. **Calculating Screen** (brief, 1-2 seconds)
   - Animation while "calculating"
   - Builds anticipation

4. **Result Screen**
   - Archetype reveal (animation)
   - Description
   - Alignment percentages
   - "Save to Profile" CTA
   - Optional: "Share Result" secondary action

### Accessibility Notes

- Slider must be keyboard navigable
- Labels must be screen-reader friendly
- Colour shouldn't be the only indicator of slider position

---

## Data Model

### Quiz Result Storage

```typescript
interface QuizResult {
  oderId: string;
  odertakenAt: Date;
  answers: QuizAnswer[];
  result: {
    primary: Archetype;
    secondary: Archetype;
    scores: ArchetypeScores;
  };
}

interface UserProfile {
  oderId: string;
  archetype: Archetype;           // From quiz or manual override
  archetypeSource: 'quiz' | 'manual';
  quizResult?: QuizResult;       // Stored if taken
}
```

### When to Prompt Quiz

- **New user onboarding:** After basic profile setup, before adding friends
- **Existing user without archetype:** Soft prompt in profile section
- **Retake:** Available anytime from profile settings

---

## Future Considerations

### Shareability (v2)

- Generate shareable image with result
- "Share to Instagram Stories" format
- Referral hook: "Find out yours at [link]"

### Quiz Versioning

If questions change in future, store quiz version with results:

```typescript
interface QuizResult {
  quizVersion: string; // e.g., "1.0", "1.1"
  // ...
}
```

### Archetype Confidence

Could calculate and store confidence score based on:
- How decisive the slider positions were
- How much separation between primary and secondary
- Display as "Strong Hermit" vs "Leaning Hermit"

---

## Implementation Checklist

### Components
- [ ] `ArchetypeQuizScreen.tsx` - Main quiz flow container
- [ ] `QuizIntro.tsx` - Intro screen with CTA
- [ ] `QuizQuestion.tsx` - Single question with slider
- [ ] `QuizProgress.tsx` - Progress indicator
- [ ] `QuizCalculating.tsx` - Brief loading state
- [ ] `QuizResult.tsx` - Result reveal with animation

### Services
- [ ] `quiz.service.ts` - Scoring algorithm, result calculation
- [ ] `quiz.constants.ts` - Question text, scoring matrix

### Storage
- [ ] Add `quizResult` to user profile schema
- [ ] Add `archetypeSource` field to track quiz vs manual

### Analytics (Optional)
- [ ] Track quiz starts, completions, drop-off points
- [ ] Track result distribution (are archetypes balanced in practice?)

---

## Appendix: Full Scoring Matrix

```typescript
export const QUESTION_SCORING: Record<number, { optionA: ArchetypePoints; optionB: ArchetypePoints }> = {
  1: {
    optionA: { Sun: 3, Fool: 2, Emperor: 2, Lovers: 1 },
    optionB: { Hermit: 3, HighPriestess: 2, Empress: 2 },
  },
  2: {
    optionA: { HighPriestess: 3 },
    optionB: { Empress: 3 },
  },
  3: {
    optionA: { HighPriestess: 2, Lovers: 2, Empress: 1 },
    optionB: { Hermit: 3, Magician: 2 },
  },
  4: {
    optionA: { Fool: 2, Magician: 2, Emperor: 2, Sun: 1 },
    optionB: { Empress: 2, Lovers: 2, HighPriestess: 2, Hermit: 2 },
  },
  5: {
    optionA: { Sun: 3, Emperor: 2 },
    optionB: { Lovers: 3, HighPriestess: 2 },
  },
  6: {
    optionA: { Emperor: 3, Empress: 2, Sun: 1 },
    optionB: { Fool: 3, Magician: 2 },
  },
  7: {
    optionA: { Lovers: 3, Emperor: 1 },
    optionB: { Hermit: 2, Fool: 2, Empress: 1 },
  },
  8: {
    optionA: { Magician: 3 },
    optionB: { Fool: 3, Sun: 1 },
  },
};
```
