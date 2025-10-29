import { InteractionCategory, Archetype, Vibe } from '../components/types';

/**
 * Story Chip System
 *
 * Different chip types that build a complete story:
 * - ACTIVITY: What you did (shared a meal, hung out, went for a walk)
 * - PEOPLE: Who was there (just us, with a group, double date)
 * - TOPIC: What you talked about (work, relationships, dreams)
 * - FEELING: How it felt (connected, inspired, comfortable)
 * - MOMENT: A specific moment (laughed so hard, had a breakthrough)
 */

export type ChipType = 'activity' | 'people' | 'topic' | 'feeling' | 'moment';

export interface StoryChipComponent {
  id: string;
  original: string;
  alternatives: string[];
}

export interface StoryChip {
  id: string;
  type: ChipType;
  category?: InteractionCategory;
  archetypes?: Archetype[];
  vibes?: Vibe[];

  // Simple text template (can have {component_id} placeholders)
  template: string;

  // Components for customization
  components?: Record<string, StoryChipComponent>;

  // Plain text version
  plainText: string;

  weight?: number;
}

/**
 * STORY CHIPS LIBRARY
 */
export const STORY_CHIPS: StoryChip[] = [
  // ====================================================================
  // ACTIVITY CHIPS - What you did
  // ====================================================================
  {
    id: 'activity_shared-meal',
    type: 'activity',
    category: 'meal-drink',
    template: 'We shared a {meal_type}',
    components: {
      meal_type: {
        id: 'meal_type',
        original: 'meal',
        alternatives: ['coffee', 'drink', 'long dinner', 'quick bite'],
      },
    },
    plainText: 'We shared a meal',
  },
  {
    id: 'activity_hung-out',
    type: 'activity',
    category: 'hangout',
    template: 'We hung out',
    plainText: 'We hung out',
  },
  {
    id: 'activity_went-for',
    type: 'activity',
    category: 'hangout',
    template: 'We went for a {activity}',
    components: {
      activity: {
        id: 'activity',
        original: 'walk',
        alternatives: ['drive', 'wander', 'adventure'],
      },
    },
    plainText: 'We went for a walk',
  },
  {
    id: 'activity_deep-conversation',
    type: 'activity',
    category: 'deep-talk',
    template: 'We had a deep conversation',
    plainText: 'We had a deep conversation',
  },
  {
    id: 'activity_caught-up',
    type: 'activity',
    category: 'text-call',
    template: 'We caught up',
    plainText: 'We caught up',
  },
  {
    id: 'activity_did-activity',
    type: 'activity',
    category: 'activity-hobby',
    template: 'We {activity}',
    components: {
      activity: {
        id: 'activity',
        original: 'did something together',
        alternatives: ['worked on a project', 'practiced', 'created', 'played'],
      },
    },
    plainText: 'We did something together',
  },
  {
    id: 'activity_celebrated',
    type: 'activity',
    category: 'celebration',
    template: 'We celebrated',
    plainText: 'We celebrated',
  },
  {
    id: 'activity_event',
    type: 'activity',
    category: 'event-party',
    template: 'We went to a {event_type}',
    components: {
      event_type: {
        id: 'event_type',
        original: 'gathering',
        alternatives: ['party', 'event', 'celebration', 'get-together'],
      },
    },
    plainText: 'We went to a gathering',
  },

  // ====================================================================
  // PEOPLE CHIPS - Who was there
  // ====================================================================
  {
    id: 'people_just-us',
    type: 'people',
    template: 'just the two of us',
    plainText: 'just the two of us',
  },
  {
    id: 'people_with-group',
    type: 'people',
    template: 'with a group',
    plainText: 'with a group',
  },
  {
    id: 'people_with-friends',
    type: 'people',
    template: 'with mutual friends',
    plainText: 'with mutual friends',
  },

  // ====================================================================
  // TOPIC CHIPS - What you talked about
  // ====================================================================
  {
    id: 'topic_work-dreams',
    type: 'topic',
    template: 'talked about {topic}',
    components: {
      topic: {
        id: 'topic',
        original: 'work and dreams',
        alternatives: ['life and where we are', 'what we\'ve been thinking about', 'the big stuff', 'everything and nothing'],
      },
    },
    plainText: 'talked about work and dreams',
  },
  {
    id: 'topic_relationships',
    type: 'topic',
    template: 'discussed relationships',
    plainText: 'discussed relationships',
  },
  {
    id: 'topic_fears',
    type: 'topic',
    category: 'deep-talk',
    archetypes: ['HighPriestess', 'Hermit'],
    template: 'opened up about {topic}',
    components: {
      topic: {
        id: 'topic',
        original: 'our fears',
        alternatives: ['what we\'ve been holding', 'something vulnerable', 'the hard stuff'],
      },
    },
    plainText: 'opened up about our fears',
  },
  {
    id: 'topic_future',
    type: 'topic',
    template: 'talked about the future',
    plainText: 'talked about the future',
  },
  {
    id: 'topic_nothing-specific',
    type: 'topic',
    archetypes: ['Fool'],
    template: 'talked about nothing and everything',
    plainText: 'talked about nothing and everything',
  },

  // ====================================================================
  // FEELING CHIPS - How it felt
  // ====================================================================
  {
    id: 'feeling_connected',
    type: 'feeling',
    template: 'felt {quality} connected',
    components: {
      quality: {
        id: 'quality',
        original: 'really',
        alternatives: ['deeply', 'more', 'so'],
      },
    },
    plainText: 'felt really connected',
  },
  {
    id: 'feeling_understood',
    type: 'feeling',
    archetypes: ['HighPriestess', 'Empress'],
    template: 'felt {feeling}',
    components: {
      feeling: {
        id: 'feeling',
        original: 'understood',
        alternatives: ['seen', 'heard', 'safe', 'held'],
      },
    },
    plainText: 'felt understood',
  },
  {
    id: 'feeling_comfortable',
    type: 'feeling',
    template: 'it was {quality}',
    components: {
      quality: {
        id: 'quality',
        original: 'comfortable',
        alternatives: ['easy', 'natural', 'effortless', 'like no time had passed'],
      },
    },
    plainText: 'it was comfortable',
  },
  {
    id: 'feeling_joyful',
    type: 'feeling',
    archetypes: ['Sun', 'Fool'],
    template: 'felt {feeling}',
    components: {
      feeling: {
        id: 'feeling',
        original: 'joyful',
        alternatives: ['alive', 'radiant', 'light', 'happy'],
      },
    },
    plainText: 'felt joyful',
  },
  {
    id: 'feeling_nourished',
    type: 'feeling',
    archetypes: ['Empress'],
    category: 'meal-drink',
    template: 'felt {feeling}',
    components: {
      feeling: {
        id: 'feeling',
        original: 'nourished',
        alternatives: ['cared for', 'cherished', 'warm', 'held'],
      },
    },
    plainText: 'felt nourished',
  },
  {
    id: 'feeling_inspired',
    type: 'feeling',
    archetypes: ['Magician'],
    template: 'felt {feeling}',
    components: {
      feeling: {
        id: 'feeling',
        original: 'inspired',
        alternatives: ['creative', 'energized', 'full of ideas'],
      },
    },
    plainText: 'felt inspired',
  },

  // ====================================================================
  // MOMENT CHIPS - Specific moments
  // ====================================================================
  {
    id: 'moment_laughed',
    type: 'moment',
    archetypes: ['Fool', 'Sun'],
    template: 'laughed {how}',
    components: {
      how: {
        id: 'how',
        original: 'so much',
        alternatives: ['until we cried', 'at nothing', 'the whole time'],
      },
    },
    plainText: 'laughed so much',
  },
  {
    id: 'moment_silence',
    type: 'moment',
    archetypes: ['Hermit', 'Empress'],
    template: 'enjoyed {what}',
    components: {
      what: {
        id: 'what',
        original: 'comfortable silence',
        alternatives: ['just being together', 'not needing words', 'the quiet'],
      },
    },
    plainText: 'enjoyed comfortable silence',
  },
  {
    id: 'moment_breakthrough',
    type: 'moment',
    category: 'deep-talk',
    vibes: ['FullMoon', 'WaxingGibbous'],
    template: 'had a {what}',
    components: {
      what: {
        id: 'what',
        original: 'breakthrough',
        alternatives: ['realization', 'deep moment', 'shift'],
      },
    },
    plainText: 'had a breakthrough',
  },
  {
    id: 'moment_lost-track-time',
    type: 'moment',
    template: 'lost track of time',
    plainText: 'lost track of time',
  },
];

/**
 * Get chips for a specific type, filtered by context
 */
export function getChipsForType(
  type: ChipType,
  context: {
    category: InteractionCategory;
    archetype?: Archetype;
    vibe?: Vibe;
  }
): StoryChip[] {
  return STORY_CHIPS.filter(chip => {
    // Must match type
    if (chip.type !== type) return false;

    // Filter by category if specified
    if (chip.category && chip.category !== context.category) return false;

    // Boost if archetype matches (don't exclude if doesn't match)
    // Boost if vibe matches (don't exclude if doesn't match)

    return true;
  }).sort((a, b) => {
    // Calculate relevance score
    let scoreA = 0;
    let scoreB = 0;

    if (a.archetypes && context.archetype && a.archetypes.includes(context.archetype)) scoreA += 10;
    if (b.archetypes && context.archetype && b.archetypes.includes(context.archetype)) scoreB += 10;

    if (a.vibes && context.vibe && a.vibes.includes(context.vibe)) scoreA += 5;
    if (b.vibes && context.vibe && b.vibes.includes(context.vibe)) scoreB += 5;

    return scoreB - scoreA;
  });
}

/**
 * Get the next chip type to show based on what's already selected
 */
export function getNextChipType(selectedTypes: ChipType[]): ChipType | null {
  const typeOrder: ChipType[] = ['activity', 'people', 'topic', 'feeling', 'moment'];

  for (const type of typeOrder) {
    if (!selectedTypes.includes(type)) {
      return type;
    }
  }

  return null; // All types filled
}

/**
 * Get label for chip type
 */
export function getChipTypeLabel(type: ChipType): string {
  const labels: Record<ChipType, string> = {
    activity: 'What did you do?',
    people: 'Who was there?',
    topic: 'What did you talk about?',
    feeling: 'How did it feel?',
    moment: 'Any special moments?',
  };
  return labels[type];
}
