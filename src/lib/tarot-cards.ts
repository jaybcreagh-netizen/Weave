/**
 * Tarot Card System for Weave
 *
 * Replaces traditional "achievements" with tarot card draws at meaningful milestones.
 * Each card represents a threshold crossed and offers insight about the journey.
 */

export type TarotCardId =
  | 'the_fool'
  | 'the_magician'
  | 'the_high_priestess'
  | 'the_empress'
  | 'the_emperor'
  | 'the_hierophant'
  | 'the_lovers'
  | 'the_chariot'
  | 'strength'
  | 'the_hermit'
  | 'wheel_of_fortune'
  | 'justice'
  | 'the_hanged_man'
  | 'death'
  | 'temperance'
  | 'the_devil'
  | 'the_tower'
  | 'the_star'
  | 'the_moon'
  | 'the_sun'
  | 'judgement'
  | 'the_world';

export interface TarotCard {
  id: TarotCardId;
  number: number; // 0-21
  name: string;
  icon: string; // Path to SVG icon in assets
  shortReading: string; // One-line insight (for small displays)
  reading: string; // Full reading text
  calculateProgress: (userStats: UserStats) => number; // Returns 0-100
  threshold: number; // When progress hits 100, card is drawn
  category: 'beginning' | 'building' | 'journey' | 'inner_work' | 'fate' | 'transformation' | 'shadow' | 'completion';
}

export interface UserStats {
  // Global stats
  totalWeaves: number;
  totalReflections: number;
  deepReflections: number; // Profound + detailed reflections
  activeFriends: number;
  innerCircleFriends: number;
  innerCircleHighScore: number; // Count of inner circle > 80 score

  // Streaks & consistency
  currentStreak: number;
  bestStreak: number;

  // Diversity
  uniqueInteractionTypes: number;
  archetypesInCircle: number; // Unique archetypes

  // Special conditions
  dormantRekindles: number;
  nightOwlWeaves: number; // Logged at 2am-4am
  burstDays: number; // Days with 10+ weaves
  moonPhaseLogged: string[]; // Which phases have been logged
  perfectWeeks: number; // Weeks where all friends contacted

  // Time-based
  daysWithApp: number;

  // Relationship depth
  kindredSpirits: number; // Friends with 500+ weaves
  sixMonthBonds: number; // Friends with 6+ month consistency
  celebrationWeaves: number; // Party, birthday, milestone types
  oneOnOneWeaves: number; // Deep conversation types (chat, call, etc.)

  // Friend-level aggregates (for relationship spread)
  getFriendStats?: (friendId: string) => FriendStats;
}

export interface FriendStats {
  weaveCount: number;
  reflectionCount: number;
  deepReflections: number;
  consistencyMonths: number;
  firstWeaveDate: Date;
  latestWeaveDate: Date;
  isDormant: boolean;
  wasRekindled: boolean;
}

/**
 * THE MAJOR ARCANA - 22 Cards
 * Mapped to relationship practice milestones
 */
export const MAJOR_ARCANA: TarotCard[] = [
  {
    id: 'the_fool',
    number: 0,
    name: 'The Fool',
    icon: 'TarotIcons/TheFool.svg',
    shortReading: 'You step onto the path',
    reading: `The Fool appears at the beginning of your journey.

You've taken your first step onto the path of intentional connection. Like The Fool, you carry only what you need—curiosity, openness, and a willingness to try.

The Fool reminds you: every master was once a beginner. Trust the journey ahead.`,
    category: 'beginning',
    threshold: 1,
    calculateProgress: (stats) => {
      return stats.totalWeaves >= 1 ? 100 : 0;
    },
  },

  {
    id: 'the_magician',
    number: 1,
    name: 'The Magician',
    icon: 'TarotIcons/TheMagician.svg',
    shortReading: 'You wield your tools with intention',
    reading: `The Magician appears when you've mastered your tools.

You've explored ${20} different ways to connect—calls, texts, meals, walks, celebrations. The Magician teaches that mastery isn't about having many tools, but knowing when to use each one.

"As above, so below." Your outer practice now reflects your inner intention.`,
    category: 'beginning',
    threshold: 20,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.uniqueInteractionTypes / 20) * 100);
    },
  },

  {
    id: 'the_high_priestess',
    number: 2,
    name: 'The High Priestess',
    icon: 'TarotIcons/HighPriestess.svg',
    shortReading: 'You hear what isn't spoken',
    reading: `The High Priestess appears when you've learned to listen deeply.

${50} times you've paused to reflect—to ask yourself what lies beneath the surface of your connections. This is the practice of inner knowing.

The High Priestess reminds you: your intuition about your relationships is worth trusting. The answers are already within you.`,
    category: 'beginning',
    threshold: 50,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.totalReflections / 50) * 100);
    },
  },

  {
    id: 'the_empress',
    number: 3,
    name: 'The Empress',
    icon: 'TarotIcons/TheEmpress.svg',
    shortReading: 'Your circle blooms with abundance',
    reading: `The Empress appears when your garden is flourishing.

You're nurturing ${20} active friendships. Like The Empress, you understand that relationships are living things—they need attention, care, and room to grow.

The Empress whispers: abundance isn't about quantity, but the richness of what blooms when tended with love.`,
    category: 'building',
    threshold: 20,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.activeFriends / 20) * 100);
    },
  },

  {
    id: 'the_emperor',
    number: 4,
    name: 'The Emperor',
    icon: 'TarotIcons/TheEmperor.svg',
    shortReading: 'Structure serves love',
    reading: `The Emperor appears when discipline becomes devotion.

You've achieved a perfect week—every friend in your circle received your attention. The Emperor teaches that structure isn't rigid; it's the container that holds what matters.

When wielded with care, order creates space for connection to deepen.`,
    category: 'building',
    threshold: 1,
    calculateProgress: (stats) => {
      return stats.perfectWeeks >= 1 ? 100 : 0;
    },
  },

  {
    id: 'the_hierophant',
    number: 5,
    name: 'The Hierophant',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'Sacred rituals emerge from devotion',
    reading: `The Hierophant appears when practice becomes ritual.

Six months of consistent contact with someone you love. The Hierophant honors tradition—not as dogma, but as the rhythms that carry us through seasons.

Your consistency is a form of devotion. These rituals of connection are sacred because you've made them so.`,
    category: 'building',
    threshold: 1,
    calculateProgress: (stats) => {
      return stats.sixMonthBonds >= 1 ? 100 : 0;
    },
  },

  {
    id: 'the_lovers',
    number: 6,
    name: 'The Lovers',
    icon: 'TarotIcons/TheLovers.svg',
    shortReading: 'True intimacy is chosen again and again',
    reading: `The Lovers appear when you've built something rare.

Five hundred moments with someone. The Lovers remind you: intimacy isn't found, it's forged—through five hundred choices to show up, to listen, to stay.

This is what it means to be a kindred spirit: not fate, but devotion made visible.`,
    category: 'journey',
    threshold: 1,
    calculateProgress: (stats) => {
      return stats.kindredSpirits >= 1 ? 100 : 0;
    },
  },

  {
    id: 'the_chariot',
    number: 7,
    name: 'The Chariot',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'Willpower in service of love',
    reading: `The Chariot appears when momentum becomes unstoppable.

A full year of consistent practice. ${365} days of choosing connection. The Chariot represents the triumph of will over inertia.

You've proven that love is not just feeling—it's action, again and again and again.`,
    category: 'journey',
    threshold: 365,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.bestStreak / 365) * 100);
    },
  },

  {
    id: 'strength',
    number: 8,
    name: 'Strength',
    icon: 'TarotIcons/Strength.svg',
    shortReading: 'Compassion is courage',
    reading: `Strength appears when you choose tenderness over abandonment.

Three times you've rekindled friendships that had gone quiet. Strength isn't force—it's the gentle courage to reach out again, to risk rejection, to say "I still care."

The lion bows to the maiden because true power is soft.`,
    category: 'inner_work',
    threshold: 3,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.dormantRekindles / 3) * 100);
    },
  },

  {
    id: 'the_hermit',
    number: 9,
    name: 'The Hermit',
    icon: 'TarotIcons/TheHermit.svg',
    shortReading: 'Depth requires solitude for two',
    reading: `The Hermit appears when you've discovered the power of intimate presence.

${100} one-on-one moments—calls, walks, quiet teas, long conversations. The Hermit teaches that sometimes depth requires stepping away from the crowd.

Your lamp illuminates the path not by broadcasting light everywhere, but by focusing it where it matters most.`,
    category: 'inner_work',
    threshold: 100,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.oneOnOneWeaves / 100) * 100);
    },
  },

  {
    id: 'wheel_of_fortune',
    number: 10,
    name: 'Wheel of Fortune',
    icon: 'TarotIcons/Wheel of Fortune.svg',
    shortReading: 'Connection has seasons',
    reading: `The Wheel of Fortune appears when you've witnessed the full cycle.

You've logged weaves across all moon phases—from new moon's quiet introspection to full moon's radiant celebration. The Wheel teaches acceptance of natural rhythms.

Not every moment will feel the same. The wisdom is in honoring each season as it comes.`,
    category: 'fate',
    threshold: 8, // All 8 moon phases
    calculateProgress: (stats) => {
      return Math.min(100, ((stats.moonPhaseLogged?.length || 0) / 8) * 100);
    },
  },

  {
    id: 'justice',
    number: 11,
    name: 'Justice',
    icon: 'TarotIcons/Justice.svg',
    shortReading: 'Balance brings wisdom',
    reading: `Justice appears when you've found equilibrium.

Friends across all seven archetypes—Emperor, Empress, High Priestess, Fool, Sun, Hermit, Magician. Justice teaches that no single path contains all truth.

Balance isn't about equal time; it's about honoring the full spectrum of what connection can be.`,
    category: 'fate',
    threshold: 7,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.archetypesInCircle / 7) * 100);
    },
  },

  {
    id: 'the_hanged_man',
    number: 12,
    name: 'The Hanged Man',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'Wisdom comes from pausing',
    reading: `The Hanged Man appears when you've learned to sit with reflection.

${150} reflections recorded. The Hanged Man hangs upside-down by choice, seeing the world from a new angle. You've proven that action isn't always the answer.

Sometimes the deepest work is done in stillness, asking: What does this connection teach me?`,
    category: 'inner_work',
    threshold: 150,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.totalReflections / 150) * 100);
    },
  },

  {
    id: 'death',
    number: 13,
    name: 'Death',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'Endings make space for growth',
    reading: `Death appears not as ending, but as transformation.

You've witnessed significant change in your circle—friendships that had to end, tiers that shifted, people who grew apart. Death teaches that clinging prevents rebirth.

What falls away creates space for what must come next. Honor the grief, and trust the unfolding.`,
    category: 'transformation',
    threshold: 1,
    calculateProgress: (stats) => {
      // This might track dormancy transitions, major tier changes, etc.
      // Placeholder logic - needs implementation
      return 0;
    },
  },

  {
    id: 'temperance',
    number: 14,
    name: 'Temperance',
    icon: 'TarotIcons/Temperance.svg',
    shortReading: 'Harmony flows from measured attention',
    reading: `Temperance appears when you've found your rhythm.

Balance across all three circles—Inner Circle, Close Friends, Community. Each receives what it needs, no more, no less. Temperance teaches the art of right proportion.

You've learned that love doesn't mean everyone gets equal time. It means everyone gets what the relationship requires.`,
    category: 'transformation',
    threshold: 1,
    calculateProgress: (stats) => {
      // Check if all Dunbar tiers have healthy engagement
      // Placeholder - needs tier-specific stats
      return 0;
    },
  },

  {
    id: 'the_devil',
    number: 15,
    name: 'The Devil',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'Shadow work happens in liminal hours',
    reading: `The Devil appears in the small hours when you couldn't sleep.

Logged at 2am, when the boundary between days blurs. The Devil isn't evil—it's the shadow self, the part that reaches out when loneliness hits, the vulnerability behind the nighttime text.

You've touched the edges of what connection means when the world is dark. This too is sacred.`,
    category: 'shadow',
    threshold: 1,
    calculateProgress: (stats) => {
      return stats.nightOwlWeaves >= 1 ? 100 : 0;
    },
  },

  {
    id: 'the_tower',
    number: 16,
    name: 'The Tower',
    icon: 'TarotIcons/The Tower.svg',
    shortReading: 'Breakthrough shatters the pattern',
    reading: `The Tower appears in moments of sudden intensity.

Ten weaves in a single day. The Tower strikes like lightning—unexpected, dramatic, destroying old structures to reveal new ground. Sometimes connection isn't slow and steady.

Sometimes it's urgent. Sometimes you need to show up everywhere at once. The breakthrough comes when the pattern can no longer hold.`,
    category: 'shadow',
    threshold: 1,
    calculateProgress: (stats) => {
      return stats.burstDays >= 1 ? 100 : 0;
    },
  },

  {
    id: 'the_star',
    number: 17,
    name: 'The Star',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'Hope is a practice',
    reading: `The Star appears when your inner circle shines bright.

Every friend in your most intimate tier holds a weave score above 80. The Star is hope made visible—not wishful thinking, but the result of consistent care.

You've proven that it's possible to keep multiple deep bonds flourishing. Your practice is radiant.`,
    category: 'shadow',
    threshold: 5, // 5 inner circle friends all > 80
    calculateProgress: (stats) => {
      const target = 5;
      return Math.min(100, (stats.innerCircleHighScore / target) * 100);
    },
  },

  {
    id: 'the_moon',
    number: 18,
    name: 'The Moon',
    icon: 'TarotIcons/The Moon.svg',
    shortReading: 'Trust the tides',
    reading: `The Moon appears when you've learned to navigate by feel.

You've tracked moon phases, noted how connection feels different under new moon's introspection versus full moon's exuberance. The Moon teaches trust in what can't be seen.

Not everything needs to be understood. Sometimes you follow the pull of the tide and discover where it leads.`,
    category: 'shadow',
    threshold: 50, // 50 weaves with moon phase notes/awareness
    calculateProgress: (stats) => {
      // Needs implementation: count weaves during specific phases with high vibe awareness
      return Math.min(100, ((stats.moonPhaseLogged?.length || 0) / 8) * 100);
    },
  },

  {
    id: 'the_sun',
    number: 19,
    name: 'The Sun',
    icon: 'TarotIcons/TheSun.svg',
    shortReading: 'Joy shared is joy multiplied',
    reading: `The Sun appears when you've mastered celebration.

${50} moments of joy—parties, birthdays, milestones, gatherings. The Sun is pure radiance, uncomplicated happiness, the warmth of being together.

You've learned that connection isn't always deep work. Sometimes it's just dancing in the light with people you love.`,
    category: 'shadow',
    threshold: 50,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.celebrationWeaves / 50) * 100);
    },
  },

  {
    id: 'judgement',
    number: 20,
    name: 'Judgement',
    icon: 'TarotIcons/Judgement.svg',
    shortReading: 'Witness how far you've come',
    reading: `Judgement appears at the threshold of one full year.

365 days with Weave. Judgement isn't about being judged—it's the moment you pause, look back, and see the path you've walked. The person you were when you started is not who you are now.

You've been transformed by the practice of showing up. Bear witness to your own becoming.`,
    category: 'completion',
    threshold: 365,
    calculateProgress: (stats) => {
      return Math.min(100, (stats.daysWithApp / 365) * 100);
    },
  },

  {
    id: 'the_world',
    number: 21,
    name: 'The World',
    icon: 'TarotIcons/TheEmperor.svg', // Placeholder - no icon yet
    shortReading: 'You carry the whole world within you',
    reading: `The World appears at the completion of the great cycle.

You've walked every path: mastered your tools, nurtured abundance, found balance, touched shadow, celebrated light, witnessed transformation, built lasting bonds.

The World teaches that completion isn't an ending—it's integration. You now carry the full spectrum of what connection can be. The journey continues, but you are whole.`,
    category: 'completion',
    threshold: 1,
    calculateProgress: (stats) => {
      // Unlocks only when most other major cards are drawn
      // Placeholder - needs implementation tracking other cards
      return 0;
    },
  },
];

/**
 * Get all cards in the user's deck (drawn + available)
 */
export function getUserDeck(drawnCardIds: TarotCardId[]): {
  drawn: TarotCard[];
  available: TarotCard[];
  progress: Map<TarotCardId, number>;
} {
  const drawnSet = new Set(drawnCardIds);

  return {
    drawn: MAJOR_ARCANA.filter(card => drawnSet.has(card.id)),
    available: MAJOR_ARCANA.filter(card => !drawnSet.has(card.id)),
    progress: new Map(), // Will be populated with actual progress values
  };
}

/**
 * Check which cards are ready to be drawn based on current stats
 */
export function getReadyCards(
  userStats: UserStats,
  drawnCardIds: TarotCardId[]
): TarotCard[] {
  const drawnSet = new Set(drawnCardIds);

  return MAJOR_ARCANA.filter(card => {
    if (drawnSet.has(card.id)) return false;

    const progress = card.calculateProgress(userStats);
    return progress >= 100;
  });
}

/**
 * Get progress toward next card draws
 */
export function getCardProgress(
  userStats: UserStats,
  drawnCardIds: TarotCardId[]
): Array<{ card: TarotCard; progress: number }> {
  const drawnSet = new Set(drawnCardIds);

  return MAJOR_ARCANA
    .filter(card => !drawnSet.has(card.id))
    .map(card => ({
      card,
      progress: card.calculateProgress(userStats),
    }))
    .sort((a, b) => b.progress - a.progress); // Highest progress first
}

/**
 * Categories for organizing the spread view
 */
export const CARD_CATEGORIES = {
  beginning: { name: 'The Beginning', description: 'First steps on the path' },
  building: { name: 'Building Foundations', description: 'Creating structure and abundance' },
  journey: { name: 'The Journey', description: 'Tests of will and devotion' },
  inner_work: { name: 'Inner Work', description: 'Reflection and depth' },
  fate: { name: 'Fate & Balance', description: 'Cycles and equilibrium' },
  transformation: { name: 'Transformation', description: 'Change and alchemy' },
  shadow: { name: 'Shadow & Light', description: 'The full spectrum' },
  completion: { name: 'Completion', description: 'Integration and wholeness' },
} as const;
