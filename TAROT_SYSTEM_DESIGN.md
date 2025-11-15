# Tarot Achievement System - Design Document

## Overview

Replace the current gamified achievement system with a tarot-based insight system that aligns with Weave's spiritual, mindful aesthetic.

**Core Concept**: Instead of "unlocking achievements," users **draw tarot cards** at meaningful relationship milestones. Each card offers a reading—a moment of reflection about what this milestone reveals about their connection practice.

---

## Why This Works

### Alignment with Weave's Philosophy
- **Introspective, not competitive**: Readings invite reflection, not collection
- **Spiritual framework**: Tarot is already in Weave's DNA (archetypes)
- **Narrative arc**: The Fool's Journey maps beautifully to relationship growth
- **Subtle, not shouty**: Card draws feel ceremonial, not gamified

### Language & Aesthetic Consistency
- Replaces: "Legendary Weaver Achievement Unlocked! 🏆"
- With: "The Hermit wishes to reveal itself..." *[card flips]*
- Uses existing tarot visual language from archetype system
- Transforms milestones from metrics to meaning

---

## The System

### Major Arcana (22 Cards)
Global relationship practice milestones mapped to The Fool's Journey:

| Card | Milestone | Theme |
|------|-----------|-------|
| **0: The Fool** | First weave logged | Beginning the journey |
| **I: The Magician** | 20+ interaction types used | Mastery of tools |
| **II: High Priestess** | 50+ reflections | Deep listening |
| **III: The Empress** | 20+ active friends | Abundance & nurturing |
| **IV: The Emperor** | Perfect week achieved | Structure serving love |
| **V: The Hierophant** | 6-month consistency bond | Sacred ritual |
| **VI: The Lovers** | First kindred spirit (500 weaves) | Chosen intimacy |
| **VII: The Chariot** | 365-day streak | Willpower & momentum |
| **VIII: Strength** | 3+ dormant rekindled | Compassionate courage |
| **IX: The Hermit** | 100+ one-on-one weaves | Intimate depth |
| **X: Wheel of Fortune** | All moon phases logged | Acceptance of cycles |
| **XI: Justice** | All 7 archetypes in circle | Balance & diversity |
| **XII: Hanged Man** | 150+ reflections | Wisdom from stillness |
| **XIII: Death** | Major circle transformation | Endings & rebirth |
| **XIV: Temperance** | Balanced tier engagement | Right proportion |
| **XV: The Devil** | Night owl weave (2am) | Shadow work |
| **XVI: The Tower** | 10+ weaves in one day | Breakthrough intensity |
| **XVII: The Star** | 5 inner circle friends >80 | Hope as practice |
| **XVIII: The Moon** | Moon phase awareness | Trusting the unseen |
| **XIX: The Sun** | 50+ celebration weaves | Joy multiplied |
| **XX: Judgement** | One year with app | Witnessing transformation |
| **XXI: The World** | Integration milestone | Wholeness |

### Minor Arcana (Future Phase)
56 cards for relationship-specific progression:
- **Cups** (Emotion/Depth): Reflection quality, vulnerability
- **Wands** (Energy/Consistency): Streaks, momentum, rhythm
- **Swords** (Clarity/Communication): Interaction diversity, intentionality
- **Pentacles** (Commitment/Stability): Long-term bonds, anniversaries

**Phase 1**: Major Arcana only (22 cards)
**Phase 2**: Add Minor Arcana for friend-specific badges

---

## User Experience

### Card Draw Moment

When a milestone is reached:

```
1. Screen darkens slightly
2. Soft chime / shimmer sound
3. Text appears: "A card wishes to reveal itself..."
4. Deck appears (cards face-down, gentle shuffle animation)
5. User taps to draw
6. Card rises from deck and flips
7. Card face revealed with soft glow
8. Reading text fades in below
9. Gentle dismiss: "Add to Spread" or "Reflect Later"
```

**Key Differences from Current System**:
- ❌ No "LEGENDARY UNLOCK!" explosion
- ❌ No rarity tiers or completion %
- ✅ Ceremonial, meditative pacing
- ✅ Invitation to pause and reflect
- ✅ Feels like pulling a real tarot card

### The Spread (replaces Trophy Cabinet)

A beautiful visual layout showing your journey:

**Layout Options**:

1. **The Path Layout** (default)
   - Cards arranged in The Fool's Journey order (0-21)
   - Drawn cards: Full color, can tap to re-read
   - Undrawn cards: Faded/outlined, show progress bar beneath
   - Visual "path" connecting cards in sequence

2. **Three-Row Spread**
   - **Past**: Cards drawn >30 days ago
   - **Present**: Cards drawn recently
   - **Future**: Next 3 cards closest to unlocking

3. **Category Clusters**
   - Cards grouped by theme (Beginning, Inner Work, Shadow, etc.)
   - Each cluster shows cards within that theme

**Spread Features**:
- Tap any drawn card → See full reading again
- Tap undrawn card → See progress + threshold (e.g., "75/100 one-on-one weaves")
- Filter: Show All / Only Drawn / Close to Unlocking
- "Recently Drawn" section at top
- Completion count: "12 of 22 cards drawn"

### Ambient Integration

**Dashboard**:
- Recently drawn card appears as subtle shimmer in corner
- Tap to see quick reading
- "Your latest draw: The Hermit" with mini card icon

**Friend Profiles** (Phase 2 - Minor Arcana):
- Show 1-2 key cards drawn with this person
- E.g., "Five of Cups - You've weathered storms together"

**Settings**:
- "Your Spread" button (replaces "Trophy Cabinet")
- Opens full spread view

### Notifications (Subtle)

When a card is ready:
- Gentle notification: "The Magician wishes to reveal itself"
- NOT: "Achievement unlocked!"
- User opens app → card draw triggers immediately

---

## Technical Implementation

### Database Changes

**Existing Models to Repurpose**:
- `AchievementUnlock` → `CardDraw`
  - Rename fields:
    - `achievementId` → `cardId` (TarotCardId)
    - `achievementType` → `cardType` ('major' | 'minor')
    - Keep: `unlockedAt`, `hasBeenCelebrated`, `relatedFriendId`

**New Fields**:
- `UserProgress` model:
  - Add: `drawnCards: TarotCardId[]` (array of drawn Major Arcana IDs)
  - Keep existing progress counters (used for calculations)

### Card Checking Logic

**Similar to Current Achievement Tracker**:

```typescript
// src/lib/tarot-tracker.ts

export async function checkAndDrawCards(
  userStats: UserStats,
  database: Database
): Promise<CardDraw[]> {
  const drawnCardIds = await getDrawnCardIds(database);
  const readyCards = getReadyCards(userStats, drawnCardIds);

  const newDraws: CardDraw[] = [];

  for (const card of readyCards) {
    const draw = await database.write(async () => {
      const cardDraw = await database.get('card_draws').create(record => {
        record.cardId = card.id;
        record.cardType = 'major';
        record.unlockedAt = Date.now();
        record.hasBeenCelebrated = false;
      });
      return cardDraw;
    });

    newDraws.push(draw);
  }

  return newDraws;
}
```

### Integration Points

**In `weave-engine.ts` → `logNewWeave()`**:

After logging interaction:
```typescript
// Current: Check achievements
const { badgeUnlocks, achievementUnlocks } = await checkAchievements(...);

// New: Check tarot cards
const cardDraws = await checkAndDrawCards(userStats, database);

// Queue for display
if (cardDraws.length > 0) {
  uiStore.queueCardDraws(cardDraws);
}
```

**In UI Store**:

```typescript
// src/stores/uiStore.ts
interface UIStore {
  cardDrawQueue: CardDraw[];
  isSpreadOpen: boolean;

  queueCardDraws: (draws: CardDraw[]) => void;
  dismissCardDraw: () => void;
  openSpread: () => void;
  closeSpread: () => void;
}
```

### UI Components to Build

1. **`CardDrawModal.tsx`**
   - Replaces `BadgeUnlockModal`
   - Handles card flip animation
   - Shows reading
   - Marks as celebrated on dismiss

2. **`SpreadView.tsx`**
   - Replaces `TrophyCabinetModal`
   - Shows all cards in chosen layout
   - Progress bars for undrawn cards
   - Filter/sort options

3. **`TarotCard.tsx`**
   - Reusable card display component
   - Props: `card`, `isDrawn`, `progress`
   - Shows icon, name, progress
   - Tap to expand reading

4. **`CardReading.tsx`**
   - Full-screen reading view
   - Shows card icon, name, full reading text
   - Aesthetic styling (mystical vibe)

---

## Visual Design

### Card Styling

**Drawn Cards**:
- Full color icon
- Subtle glow/shimmer (not aggressive)
- Elegant border (gold? silver? depends on theme)
- Readable text in Lora font

**Undrawn Cards**:
- Grayscale or outlined icon
- Dim, faded appearance
- Thin progress bar beneath (subtle)
- "???" if fully locked, or show icon if close

### Color Palette

Stay consistent with Weave's existing theme:
- Deep purples/indigos for mystical feel
- Gold accents for drawn cards
- Soft glows, NOT neon explosions
- Use `theme.ts` colors

### Animation Style

- **Deck shuffle**: Gentle, organic movement
- **Card flip**: Smooth, 3D transform
- **Reading reveal**: Fade in, no slide/bounce
- **Glow effects**: Subtle, ambient (not pulsing)

---

## Migration Strategy

### Phase 1: Build New System (Parallel)
1. Create `tarot-cards.ts` definitions ✓
2. Create `tarot-tracker.ts` checking logic
3. Build `CardDrawModal` component
4. Build `SpreadView` component
5. Add database fields/migrations
6. Integrate into `weave-engine.ts`
7. Test thoroughly

### Phase 2: Graceful Transition
1. Keep old achievement system running temporarily
2. New users see tarot system only
3. Existing users:
   - Old achievements stay visible in "Archive"
   - New milestones draw tarot cards
   - Offer "reset" option to convert progress

### Phase 3: Deprecate Old System
1. Archive old achievement UI
2. Clean up database (optional migration)
3. Remove old achievement checking code

---

## Icon Implementation

**Available Icons** (from `assets/TarotIcons/`):
- ✓ The Fool, Magician, High Priestess, Empress, Emperor
- ✓ The Lovers, Strength, Hermit, Wheel of Fortune
- ✓ Justice, Judgement, Temperance, The Tower, The Moon, The Sun

**Missing Icons**:
- The Hierophant, The Chariot, The Hanged Man, Death, The Devil, The Star, The World

**Interim Solution**:
- Use Emperor icon as placeholder for missing cards
- Or use emoji/symbol icons
- Or commission/find matching SVG icons

**Icon Usage**:
```tsx
import TheFool from '../../assets/TarotIcons/TheFool.svg';

<TheFool width={120} height={200} color={theme.colors.primary} />
```

---

## Readings: Voice & Tone

**Style Guidelines**:
- **Reflective, not instructional**: "You've learned..." not "You should..."
- **Poetic but accessible**: Evocative without being pretentious
- **Grounded in data**: Reference specific numbers ("50 reflections") to make it personal
- **Open-ended**: Invite interpretation, don't prescribe meaning
- **Second person**: "You" statements for intimacy

**Example Reading (The High Priestess)**:
> The High Priestess appears when you've learned to listen deeply.
>
> Fifty times you've paused to reflect—to ask yourself what lies beneath the surface of your connections. This is the practice of inner knowing.
>
> The High Priestess reminds you: your intuition about your relationships is worth trusting. The answers are already within you.

**Placeholder vs. Final**:
- **Now**: Generated readings (functional, evocative)
- **Later**: User will refine/rewrite for perfect voice

---

## Future Enhancements

### Tarot Readings Feature (Unlockable)

After drawing your first 5-7 cards, unlock **Circle Readings**:

**Reading Types**:
1. **Three-Card Pull**: Past/Present/Future of your overall practice
2. **Relationship Reading**: Pull for a specific friend (energy check)
3. **Intention Setting**: "What should I focus on this week?"
4. **Moon Reading**: Special reading during Full/New Moon

**Reading Generation**:
- Use traditional tarot interpretations adapted to relationships
- AI-assisted poetic readings based on user data + card meaning
- Feels like a **tool for reflection**, not fortune-telling

**Example Three-Card Reading**:
```
Past: The Hermit (reversed)
You've been scattered, giving too little depth to any one connection.

Present: The Empress
Now you're tending your garden with care. Things are blooming.

Future: The Chariot
If you maintain this momentum, you'll achieve what once felt impossible.
```

### Minor Arcana (Friend Badges)

Each friend can draw cards from the Minor Arcana:

**Cups** (14 cards):
- Ace of Cups: First deep conversation
- Two of Cups: Mutual vulnerability
- Five of Cups: Weathering grief together
- Ten of Cups: Deep contentment

**Wands** (14 cards):
- Ace of Wands: Spark of new friendship
- Three of Wands: Weekly rhythm established
- Eight of Wands: Rapid fire connection (busy period)
- King of Wands: Sustained passionate friendship

**Swords** (14 cards):
- Ace of Swords: Breakthrough clarity
- Three of Swords: Difficult conversation
- Queen of Swords: Truth-telling friendship

**Pentacles** (14 cards):
- Ace of Pentacles: First shared milestone
- Four of Pentacles: Protective friendship
- Ten of Pentacles: Legacy bond (10+ years)

Each friend profile shows their 2-4 drawn cards as visual storytelling.

---

## Success Metrics

How do we know this is better than achievements?

### Qualitative
- Users describe milestones as "meaningful" not "gamified"
- Language shifts from "unlocking" to "discovering"
- Users re-read card readings (engagement with meaning)

### Quantitative
- Time spent in Spread view vs. Trophy Cabinet
- Re-open rate for card readings
- User feedback sentiment
- Retention after first card draw

---

## Open Questions

1. **How literal with tarot?**
   - Decision: Adapt liberally. Use structure, not dogma.

2. **Card pull UX - interrupt or defer?**
   - Option A: Modal immediately after weave log (current achievement style)
   - Option B: Notification → user opens Spread when ready
   - **Recommendation**: Option A for first card, Option B for subsequent (reduce interruption)

3. **Multiple cards at once?**
   - If user crosses 3 thresholds in one weave, show all 3 cards in sequence?
   - Or save 2nd/3rd for next session?
   - **Recommendation**: Show all, but with pacing (one at a time with "Next" button)

4. **Placeholder icons - priority?**
   - High: Get proper icons for missing Major Arcana
   - Low: Emoji placeholders are fine for now
   - **Recommendation**: Use Emperor/generic as placeholder, note in backlog

5. **Minor Arcana timeline?**
   - Phase 1: Major Arcana only (simpler, focused)
   - Phase 2: Add Minor for friend badges
   - **Recommendation**: Ship Phase 1 first, validate concept

---

## Next Steps

### Implementation Checklist

- [x] Create `tarot-cards.ts` definitions
- [ ] Create `tarot-tracker.ts` checking logic
- [ ] Create `CardDrawModal.tsx` component
- [ ] Create `SpreadView.tsx` component
- [ ] Create `TarotCard.tsx` reusable component
- [ ] Add database migration for `card_draws` table
- [ ] Update `UserProgress` model with `drawnCards` field
- [ ] Integrate card checking into `weave-engine.ts`
- [ ] Add UI Store state for card queue
- [ ] Update Settings to open Spread instead of Trophy Cabinet
- [ ] Test card draw flow end-to-end
- [ ] Refine readings (user pass)
- [ ] Source missing tarot icons
- [ ] Remove old achievement system

### Current Status
**Phase**: Design + Initial Implementation
**Milestone**: Major Arcana system designed, definitions created
**Next**: Build card tracker logic and UI components

---

## Conclusion

This tarot-based system transforms achievements from **extrinsic gamification** to **intrinsic insight**. Instead of chasing badges, users discover wisdom about their relationship practice through a framework that already resonates with Weave's spiritual identity.

The result: progression feels meaningful, milestones invite reflection, and the entire system reinforces the app's core philosophy—that relationships are sacred, and the practice of connection is transformative.
