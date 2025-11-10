import { InteractionCategory, Archetype, Vibe, Tier } from '../components/types';

/**
 * Story Chip System
 *
 * Different chip types that build a complete story:
 * - ACTIVITY: What you did (shared a meal, hung out, went for a walk)
 * - SETTING: Where/how you connected (at my place, over video call, somewhere new)
 * - PEOPLE: Who was there (just us, with a group, double date)
 * - DYNAMIC: How the interaction flowed (shared equally, I opened up first)
 * - TOPIC: What you talked about (work, relationships, dreams)
 * - FEELING: How it felt (connected, inspired, comfortable, bittersweet)
 * - MOMENT: A specific moment (laughed so hard, had a breakthrough)
 * - SURPRISE: Unexpected elements (learned something new, saw a different side)
 */

export type ChipType = 'activity' | 'setting' | 'people' | 'dynamic' | 'topic' | 'feeling' | 'moment' | 'surprise';

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
  tiers?: Tier[]; // Tier-specific chips (for smart filtering)

  // Simple text template (can have {component_id} placeholders)
  template: string;

  // Components for customization
  components?: Record<string, StoryChipComponent>;

  // Plain text version
  plainText: string;

  weight?: number;

  // For adaptive/custom chips
  isCustom?: boolean;
  createdAt?: number;
  userId?: string;
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
    archetypes: ['Empress', 'Lovers'],
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
    id: 'activity_cooked-together',
    type: 'activity',
    category: 'meal-drink',
    archetypes: ['Empress', 'Magician'],
    template: 'We cooked together',
    plainText: 'We cooked together',
  },
  {
    id: 'activity_hung-out',
    type: 'activity',
    category: 'hangout',
    archetypes: ['Fool', 'Hermit'],
    template: 'We hung out',
    plainText: 'We hung out',
  },
  {
    id: 'activity_went-for',
    type: 'activity',
    category: 'hangout',
    archetypes: ['Fool', 'Hermit'],
    template: 'We went for a {activity}',
    components: {
      activity: {
        id: 'activity',
        original: 'walk',
        alternatives: ['drive', 'wander', 'adventure', 'hike'],
      },
    },
    plainText: 'We went for a walk',
  },
  {
    id: 'activity_deep-conversation',
    type: 'activity',
    category: 'deep-talk',
    archetypes: ['HighPriestess', 'Hermit'],
    tiers: ['InnerCircle', 'CloseFriends'],
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
    id: 'activity_texted-all-day',
    type: 'activity',
    category: 'text-call',
    archetypes: ['Fool', 'Lovers'],
    template: 'We texted throughout the day',
    plainText: 'We texted throughout the day',
  },
  {
    id: 'activity_voice-noted',
    type: 'activity',
    category: 'voice-note',
    archetypes: ['HighPriestess', 'Empress'],
    template: 'We sent voice notes',
    plainText: 'We sent voice notes',
  },
  {
    id: 'activity_did-activity',
    type: 'activity',
    category: 'activity-hobby',
    archetypes: ['Magician', 'Emperor'],
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
    id: 'activity_helped-them',
    type: 'activity',
    category: 'favor-support',
    archetypes: ['Empress', 'Emperor'],
    template: 'I helped them with something',
    plainText: 'I helped them with something',
  },
  {
    id: 'activity_they-helped-me',
    type: 'activity',
    category: 'favor-support',
    archetypes: ['Empress', 'Emperor'],
    template: 'They helped me with something',
    plainText: 'They helped me with something',
  },
  {
    id: 'activity_celebrated',
    type: 'activity',
    category: 'celebration',
    archetypes: ['Sun', 'Empress'],
    template: 'We celebrated {what}',
    components: {
      what: {
        id: 'what',
        original: 'something special',
        alternatives: ['them', 'a milestone', 'good news'],
      },
    },
    plainText: 'We celebrated something special',
  },
  {
    id: 'activity_event',
    type: 'activity',
    category: 'event-party',
    archetypes: ['Sun', 'Fool'],
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
  {
    id: 'activity_ran-errands',
    type: 'activity',
    category: 'hangout',
    archetypes: ['Empress', 'Hermit'],
    template: 'We ran errands together',
    plainText: 'We ran errands together',
  },
  {
    id: 'activity_watched-something',
    type: 'activity',
    category: 'hangout',
    archetypes: ['Empress', 'Hermit', 'Fool'],
    template: 'We watched something together',
    plainText: 'We watched something together',
  },

  // ====================================================================
  // SETTING CHIPS - Where/how you connected
  // ====================================================================
  {
    id: 'setting_my-place',
    type: 'setting',
    category: 'hangout',
    archetypes: ['Empress', 'Hermit'],
    template: 'at my place',
    plainText: 'at my place',
  },
  {
    id: 'setting_their-place',
    type: 'setting',
    category: 'hangout',
    archetypes: ['Empress', 'Hermit'],
    template: 'at their place',
    plainText: 'at their place',
  },
  {
    id: 'setting_somewhere-new',
    type: 'setting',
    archetypes: ['Fool', 'Magician'],
    template: 'somewhere {how}',
    components: {
      how: {
        id: 'how',
        original: 'new',
        alternatives: ['we love', 'unexpected', 'we\'d been meaning to try'],
      },
    },
    plainText: 'somewhere new',
  },
  {
    id: 'setting_video-call',
    type: 'setting',
    category: 'text-call',
    template: 'over video call',
    plainText: 'over video call',
  },
  {
    id: 'setting_while-commuting',
    type: 'setting',
    category: 'text-call',
    template: 'while {when}',
    components: {
      when: {
        id: 'when',
        original: 'commuting',
        alternatives: ['driving', 'on the train', 'walking'],
      },
    },
    plainText: 'while commuting',
  },
  {
    id: 'setting_in-public',
    type: 'setting',
    template: 'out in public',
    plainText: 'out in public',
  },
  {
    id: 'setting_our-spot',
    type: 'setting',
    archetypes: ['Empress', 'Hermit', 'Lovers'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'at our usual spot',
    plainText: 'at our usual spot',
  },
  {
    id: 'setting_spontaneous',
    type: 'setting',
    archetypes: ['Fool'],
    template: 'spontaneously, no plan',
    plainText: 'spontaneously, no plan',
  },

  // ====================================================================
  // PEOPLE CHIPS - Who was there
  // ====================================================================
  {
    id: 'people_just-us',
    type: 'people',
    archetypes: ['Hermit', 'HighPriestess', 'Empress', 'Lovers'],
    template: 'just the two of us',
    plainText: 'just the two of us',
  },
  {
    id: 'people_with-group',
    type: 'people',
    archetypes: ['Sun', 'Fool'],
    template: 'with a group',
    plainText: 'with a group',
  },
  {
    id: 'people_with-friends',
    type: 'people',
    archetypes: ['Sun', 'Fool', 'Empress'],
    template: 'with {who}',
    components: {
      who: {
        id: 'who',
        original: 'mutual friends',
        alternatives: ['their friends', 'my friends', 'both our people'],
      },
    },
    plainText: 'with mutual friends',
  },
  {
    id: 'people_small-gathering',
    type: 'people',
    archetypes: ['Empress', 'Sun'],
    template: 'small intimate group',
    plainText: 'small intimate group',
  },
  {
    id: 'people_introduced-them',
    type: 'people',
    archetypes: ['Sun', 'Magician'],
    template: 'introduced them to someone',
    plainText: 'introduced them to someone',
  },
  {
    id: 'people_met-their-people',
    type: 'people',
    archetypes: ['Fool', 'Sun'],
    template: 'met their {who}',
    components: {
      who: {
        id: 'who',
        original: 'people',
        alternatives: ['family', 'partner', 'close friends', 'roommates'],
      },
    },
    plainText: 'met their people',
  },

  // ====================================================================
  // DYNAMIC CHIPS - How the interaction flowed
  // ====================================================================
  {
    id: 'dynamic_shared-equally',
    type: 'dynamic',
    archetypes: ['Lovers', 'Hermit'],
    template: 'we both shared equally',
    plainText: 'we both shared equally',
  },
  {
    id: 'dynamic_i-listened',
    type: 'dynamic',
    archetypes: ['Empress', 'HighPriestess'],
    template: 'I mostly listened',
    plainText: 'I mostly listened',
  },
  {
    id: 'dynamic_they-listened',
    type: 'dynamic',
    archetypes: ['Empress', 'HighPriestess'],
    template: 'they mostly listened',
    plainText: 'they mostly listened',
  },
  {
    id: 'dynamic_i-opened-up',
    type: 'dynamic',
    archetypes: ['HighPriestess', 'Hermit'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'I opened up first',
    plainText: 'I opened up first',
  },
  {
    id: 'dynamic_they-opened-up',
    type: 'dynamic',
    archetypes: ['HighPriestess', 'Empress'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'they opened up first',
    plainText: 'they opened up first',
  },
  {
    id: 'dynamic_picked-up',
    type: 'dynamic',
    archetypes: ['Hermit', 'Empress'],
    template: 'picked up right where we left off',
    plainText: 'picked up right where we left off',
  },
  {
    id: 'dynamic_felt-distant',
    type: 'dynamic',
    vibes: ['NewMoon', 'WaxingCrescent'],
    template: 'felt a bit {how}',
    components: {
      how: {
        id: 'how',
        original: 'distant',
        alternatives: ['disconnected', 'out of sync', 'like starting over'],
      },
    },
    plainText: 'felt a bit distant',
  },
  {
    id: 'dynamic_they-led',
    type: 'dynamic',
    archetypes: ['Emperor', 'Magician'],
    template: 'they took the lead',
    plainText: 'they took the lead',
  },
  {
    id: 'dynamic_i-led',
    type: 'dynamic',
    archetypes: ['Emperor', 'Magician'],
    template: 'I took the lead',
    plainText: 'I took the lead',
  },
  {
    id: 'dynamic_flowed-naturally',
    type: 'dynamic',
    archetypes: ['Fool', 'Hermit', 'Lovers'],
    template: 'everything flowed naturally',
    plainText: 'everything flowed naturally',
  },

  // ====================================================================
  // TOPIC CHIPS - What you talked about
  // ====================================================================
  {
    id: 'topic_work-dreams',
    type: 'topic',
    archetypes: ['Emperor', 'Magician'],
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
    archetypes: ['HighPriestess', 'Empress', 'Lovers'],
    template: 'discussed {what}',
    components: {
      what: {
        id: 'what',
        original: 'relationships',
        alternatives: ['love', 'dating', 'our people', 'family'],
      },
    },
    plainText: 'discussed relationships',
  },
  {
    id: 'topic_fears',
    type: 'topic',
    category: 'deep-talk',
    archetypes: ['HighPriestess', 'Hermit'],
    tiers: ['InnerCircle', 'CloseFriends'],
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
    archetypes: ['Magician', 'Emperor', 'Fool'],
    template: 'talked about {what}',
    components: {
      what: {
        id: 'what',
        original: 'the future',
        alternatives: ['our dreams', 'what\'s next', 'where we\'re headed'],
      },
    },
    plainText: 'talked about the future',
  },
  {
    id: 'topic_nothing-specific',
    type: 'topic',
    archetypes: ['Fool', 'Hermit'],
    template: 'talked about nothing and everything',
    plainText: 'talked about nothing and everything',
  },
  {
    id: 'topic_memories',
    type: 'topic',
    archetypes: ['Empress', 'Hermit'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'reminisced about {what}',
    components: {
      what: {
        id: 'what',
        original: 'old times',
        alternatives: ['our history', 'how we met', 'favorite memories'],
      },
    },
    plainText: 'reminisced about old times',
  },
  {
    id: 'topic_struggles',
    type: 'topic',
    category: 'deep-talk',
    archetypes: ['HighPriestess', 'Empress'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'talked through {what}',
    components: {
      what: {
        id: 'what',
        original: 'what\'s been hard',
        alternatives: ['our struggles', 'what\'s weighing on us', 'tough stuff'],
      },
    },
    plainText: 'talked through what\'s been hard',
  },
  {
    id: 'topic_ideas',
    type: 'topic',
    archetypes: ['Magician', 'Fool', 'Emperor'],
    template: 'brainstormed {what}',
    components: {
      what: {
        id: 'what',
        original: 'ideas',
        alternatives: ['plans', 'dreams', 'projects', 'what if scenarios'],
      },
    },
    plainText: 'brainstormed ideas',
  },
  {
    id: 'topic_culture',
    type: 'topic',
    archetypes: ['HighPriestess', 'Magician'],
    template: 'talked about {what}',
    components: {
      what: {
        id: 'what',
        original: 'culture and identity',
        alternatives: ['our backgrounds', 'where we come from', 'our roots'],
      },
    },
    plainText: 'talked about culture and identity',
  },
  {
    id: 'topic_current-events',
    type: 'topic',
    archetypes: ['Emperor', 'HighPriestess'],
    template: 'discussed what\'s happening in the world',
    plainText: 'discussed what\'s happening in the world',
  },

  // ====================================================================
  // FEELING CHIPS - How it felt
  // ====================================================================
  {
    id: 'feeling_connected',
    type: 'feeling',
    archetypes: ['Lovers', 'Empress', 'HighPriestess'],
    template: 'felt {quality} connected',
    components: {
      quality: {
        id: 'quality',
        original: 'really',
        alternatives: ['deeply', 'more', 'so', 'incredibly'],
      },
    },
    plainText: 'felt really connected',
  },
  {
    id: 'feeling_understood',
    type: 'feeling',
    archetypes: ['HighPriestess', 'Empress'],
    tiers: ['InnerCircle', 'CloseFriends'],
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
    archetypes: ['Hermit', 'Empress'],
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
    vibes: ['FullMoon', 'WaxingGibbous'],
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
    archetypes: ['Magician', 'Fool'],
    template: 'felt {feeling}',
    components: {
      feeling: {
        id: 'feeling',
        original: 'inspired',
        alternatives: ['creative', 'energized', 'full of ideas', 'motivated'],
      },
    },
    plainText: 'felt inspired',
  },
  {
    id: 'feeling_grateful',
    type: 'feeling',
    archetypes: ['Empress', 'Hermit'],
    vibes: ['FullMoon', 'WaxingGibbous'],
    template: 'felt {feeling}',
    components: {
      feeling: {
        id: 'feeling',
        original: 'grateful',
        alternatives: ['lucky', 'blessed', 'appreciative'],
      },
    },
    plainText: 'felt grateful',
  },
  {
    id: 'feeling_bittersweet',
    type: 'feeling',
    archetypes: ['HighPriestess', 'Hermit'],
    vibes: ['WaxingCrescent', 'NewMoon'],
    template: 'felt bittersweet',
    plainText: 'felt bittersweet',
  },
  {
    id: 'feeling_exhausted-good',
    type: 'feeling',
    archetypes: ['HighPriestess', 'Empress'],
    template: 'emotionally {how} but in a good way',
    components: {
      how: {
        id: 'how',
        original: 'exhausted',
        alternatives: ['drained', 'spent', 'full'],
      },
    },
    plainText: 'emotionally exhausted but in a good way',
  },
  {
    id: 'feeling_awkward-worth-it',
    type: 'feeling',
    vibes: ['WaxingCrescent'],
    template: 'slightly awkward but worth it',
    plainText: 'slightly awkward but worth it',
  },
  {
    id: 'feeling_closer',
    type: 'feeling',
    archetypes: ['Lovers', 'Empress', 'HighPriestess'],
    vibes: ['WaxingGibbous', 'FullMoon'],
    template: 'felt {how} closer',
    components: {
      how: {
        id: 'how',
        original: 'even',
        alternatives: ['so much', 'noticeably', 'surprisingly'],
      },
    },
    plainText: 'felt even closer',
  },
  {
    id: 'feeling_needed-space',
    type: 'feeling',
    archetypes: ['Hermit'],
    vibes: ['NewMoon', 'WaxingCrescent'],
    template: 'needed space after',
    plainText: 'needed space after',
  },
  {
    id: 'feeling_wanted-more',
    type: 'feeling',
    archetypes: ['Fool', 'Sun', 'Lovers'],
    template: 'wanted more time',
    plainText: 'wanted more time',
  },
  {
    id: 'feeling_energized',
    type: 'feeling',
    archetypes: ['Sun', 'Magician'],
    template: 'left feeling energized',
    plainText: 'left feeling energized',
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
        alternatives: ['until we cried', 'at nothing', 'the whole time', 'our heads off'],
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
    id: 'moment_awkward-silence',
    type: 'moment',
    vibes: ['NewMoon', 'WaxingCrescent'],
    template: 'had some awkward silences',
    plainText: 'had some awkward silences',
  },
  {
    id: 'moment_breakthrough',
    type: 'moment',
    category: 'deep-talk',
    archetypes: ['HighPriestess', 'Magician'],
    vibes: ['FullMoon', 'WaxingGibbous'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'had a {what}',
    components: {
      what: {
        id: 'what',
        original: 'breakthrough',
        alternatives: ['realization', 'deep moment', 'shift', 'aha moment'],
      },
    },
    plainText: 'had a breakthrough',
  },
  {
    id: 'moment_lost-track-time',
    type: 'moment',
    archetypes: ['Fool', 'Hermit', 'Lovers'],
    template: 'lost track of time',
    plainText: 'lost track of time',
  },
  {
    id: 'moment_they-got-me',
    type: 'moment',
    archetypes: ['HighPriestess', 'Lovers'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'they really got me',
    plainText: 'they really got me',
  },
  {
    id: 'moment_misunderstood',
    type: 'moment',
    vibes: ['NewMoon', 'WaxingCrescent'],
    template: 'felt {how}',
    components: {
      how: {
        id: 'how',
        original: 'misunderstood',
        alternatives: ['like they didn\'t get it', 'disconnected', 'out of sync'],
      },
    },
    plainText: 'felt misunderstood',
  },
  {
    id: 'moment_shared-something',
    type: 'moment',
    archetypes: ['HighPriestess', 'Empress'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'shared something I\'ve been holding',
    plainText: 'shared something I\'ve been holding',
  },
  {
    id: 'moment_they-shared',
    type: 'moment',
    archetypes: ['HighPriestess', 'Empress'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'they shared something vulnerable',
    plainText: 'they shared something vulnerable',
  },
  {
    id: 'moment_disagreement',
    type: 'moment',
    vibes: ['NewMoon', 'WaxingCrescent'],
    template: 'had a disagreement',
    plainText: 'had a disagreement',
  },
  {
    id: 'moment_worked-through',
    type: 'moment',
    archetypes: ['Emperor', 'HighPriestess'],
    vibes: ['WaxingGibbous', 'FullMoon'],
    template: 'worked through something',
    plainText: 'worked through something',
  },
  {
    id: 'moment_inside-joke',
    type: 'moment',
    archetypes: ['Fool', 'Hermit'],
    tiers: ['InnerCircle', 'CloseFriends'],
    template: 'our inside joke came up',
    plainText: 'our inside joke came up',
  },
  {
    id: 'moment_new-tradition',
    type: 'moment',
    archetypes: ['Empress', 'Emperor'],
    template: 'started a new tradition',
    plainText: 'started a new tradition',
  },
  {
    id: 'moment_stayed-up-late',
    type: 'moment',
    archetypes: ['Fool', 'Hermit', 'HighPriestess'],
    template: 'stayed up way too late',
    plainText: 'stayed up way too late',
  },

  // ====================================================================
  // SURPRISE CHIPS - Unexpected elements
  // ====================================================================
  {
    id: 'surprise_learned-new',
    type: 'surprise',
    archetypes: ['Magician', 'Fool'],
    template: 'learned something {what} about them',
    components: {
      what: {
        id: 'what',
        original: 'new',
        alternatives: ['surprising', 'unexpected', 'I didn\'t know'],
      },
    },
    plainText: 'learned something new about them',
  },
  {
    id: 'surprise_different-side',
    type: 'surprise',
    archetypes: ['HighPriestess', 'Magician'],
    template: 'saw a different side of them',
    plainText: 'saw a different side of them',
  },
  {
    id: 'surprise_perspective-shift',
    type: 'surprise',
    archetypes: ['HighPriestess', 'Magician'],
    template: 'they changed my perspective on something',
    plainText: 'they changed my perspective on something',
  },
  {
    id: 'surprise_unexpected-topic',
    type: 'surprise',
    archetypes: ['Fool', 'HighPriestess'],
    template: 'they brought up something unexpected',
    plainText: 'they brought up something unexpected',
  },
  {
    id: 'surprise_deeper-than-expected',
    type: 'surprise',
    archetypes: ['HighPriestess', 'Hermit'],
    template: 'went deeper than I expected',
    plainText: 'went deeper than I expected',
  },
  {
    id: 'surprise_more-fun',
    type: 'surprise',
    archetypes: ['Fool', 'Sun'],
    template: 'was way more fun than expected',
    plainText: 'was way more fun than expected',
  },
  {
    id: 'surprise_they-remembered',
    type: 'surprise',
    archetypes: ['Empress', 'Lovers'],
    template: 'they remembered something {what}',
    components: {
      what: {
        id: 'what',
        original: 'important',
        alternatives: ['I mentioned', 'I forgot I told them', 'meaningful'],
      },
    },
    plainText: 'they remembered something important',
  },
  {
    id: 'surprise_coincidence',
    type: 'surprise',
    archetypes: ['Magician', 'Fool'],
    template: 'discovered a {what} coincidence',
    components: {
      what: {
        id: 'what',
        original: 'weird',
        alternatives: ['funny', 'surprising', 'meaningful'],
      },
    },
    plainText: 'discovered a weird coincidence',
  },
];

/**
 * Smart context for chip filtering
 */
export interface ChipContext {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe;
  tier?: Tier;
  interactionCount?: number; // Total interactions with this friend
  daysSinceLastInteraction?: number; // For history awareness
  frequencyScores?: Record<string, number>; // For adaptive suggestions
}

/**
 * Get chips for a specific type, with smart contextual filtering
 */
export function getChipsForType(
  type: ChipType,
  context: ChipContext
): StoryChip[] {
  return STORY_CHIPS.filter(chip => {
    // Must match type
    if (chip.type !== type) return false;

    // Filter by category if chip specifies one and it doesn't match
    if (chip.category && chip.category !== context.category) return false;

    // Filter by tier if chip specifies one and it doesn't match
    if (chip.tiers && context.tier && !chip.tiers.includes(context.tier)) return false;

    return true;
  }).sort((a, b) => {
    // Calculate relevance score with smart weighting
    let scoreA = 0;
    let scoreB = 0;

    // Archetype matching (high weight)
    if (a.archetypes && context.archetype && a.archetypes.includes(context.archetype)) scoreA += 15;
    if (b.archetypes && context.archetype && b.archetypes.includes(context.archetype)) scoreB += 15;

    // Vibe matching (medium weight)
    if (a.vibes && context.vibe && a.vibes.includes(context.vibe)) scoreA += 8;
    if (b.vibes && context.vibe && b.vibes.includes(context.vibe)) scoreB += 8;

    // Tier matching (medium weight) - boost chips designed for this tier
    if (a.tiers && context.tier && a.tiers.includes(context.tier)) scoreA += 10;
    if (b.tiers && context.tier && b.tiers.includes(context.tier)) scoreB += 10;

    // Category exact match (small boost for perfect match)
    if (a.category && a.category === context.category) scoreA += 3;
    if (b.category && b.category === context.category) scoreB += 3;

    // Frequency-based adaptive boost (if frequency data provided)
    if (context.frequencyScores) {
      scoreA += (context.frequencyScores[a.id] || 0) * 20; // High multiplier for frequently used chips
      scoreB += (context.frequencyScores[b.id] || 0) * 20;
    }

    // History-aware boosting
    if (context.interactionCount !== undefined) {
      // For new relationships (< 5 interactions), boost "getting to know" type chips
      if (context.interactionCount < 5) {
        if (a.id === 'surprise_learned-new' || a.id === 'feeling_comfortable' || a.id === 'dynamic_flowed-naturally') scoreA += 5;
        if (b.id === 'surprise_learned-new' || b.id === 'feeling_comfortable' || b.id === 'dynamic_flowed-naturally') scoreB += 5;
      }

      // For established relationships (> 20 interactions), boost depth chips
      if (context.interactionCount > 20) {
        if (a.tiers?.includes('InnerCircle') || a.id.includes('breakthrough') || a.id.includes('vulnerable')) scoreA += 5;
        if (b.tiers?.includes('InnerCircle') || b.id.includes('breakthrough') || b.id.includes('vulnerable')) scoreB += 5;
      }
    }

    // After long gaps (> 30 days), boost reconnection chips
    if (context.daysSinceLastInteraction !== undefined && context.daysSinceLastInteraction > 30) {
      if (a.id === 'dynamic_picked-up' || a.id === 'dynamic_felt-distant' || a.id === 'topic_memories') scoreA += 8;
      if (b.id === 'dynamic_picked-up' || b.id === 'dynamic_felt-distant' || b.id === 'topic_memories') scoreB += 8;
    }

    return scoreB - scoreA;
  });
}

/**
 * Get the next chip type to show based on what's already selected
 */
export function getNextChipType(selectedTypes: ChipType[]): ChipType | null {
  // Prioritized order: most important to least important
  const typeOrder: ChipType[] = ['activity', 'setting', 'people', 'dynamic', 'topic', 'feeling', 'moment', 'surprise'];

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
    setting: 'Where were you?',
    people: 'Who was there?',
    dynamic: 'How did it flow?',
    topic: 'What did you talk about?',
    feeling: 'How did it feel?',
    moment: 'Any special moments?',
    surprise: 'Anything unexpected?',
  };
  return labels[type];
}

/**
 * Calculate chip usage frequency for adaptive suggestions
 * Returns normalized scores (0-1) for each chip based on usage frequency
 */
export function calculateChipFrequency(chipUsageHistory: Array<{ chipId: string; timestamp: number }>): Record<string, number> {
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  // Count recent uses (last 30 days)
  const recentCounts: Record<string, number> = {};
  let maxCount = 0;

  chipUsageHistory.forEach(usage => {
    if (usage.timestamp >= thirtyDaysAgo) {
      recentCounts[usage.chipId] = (recentCounts[usage.chipId] || 0) + 1;
      maxCount = Math.max(maxCount, recentCounts[usage.chipId]);
    }
  });

  // Normalize to 0-1 scale
  const normalizedScores: Record<string, number> = {};
  Object.entries(recentCounts).forEach(([chipId, count]) => {
    normalizedScores[chipId] = maxCount > 0 ? count / maxCount : 0;
  });

  return normalizedScores;
}

/**
 * Suggest creating a custom chip based on repeated custom text patterns
 * Returns suggested chip if pattern detected, null otherwise
 */
export function suggestCustomChip(
  customTextHistory: string[],
  minOccurrences: number = 3
): { suggestedText: string; occurrences: number } | null {
  if (customTextHistory.length < minOccurrences) return null;

  // Simple word-based similarity detection
  // In production, this could use more sophisticated NLP
  const phrases = customTextHistory.map(text => text.toLowerCase().trim());
  const phraseCounts: Record<string, number> = {};

  phrases.forEach(phrase => {
    if (phrase.length > 5) { // Ignore very short text
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
    }
  });

  // Find most common phrase
  let maxCount = 0;
  let mostCommon = '';
  Object.entries(phraseCounts).forEach(([phrase, count]) => {
    if (count >= minOccurrences && count > maxCount) {
      maxCount = count;
      mostCommon = phrase;
    }
  });

  if (mostCommon && maxCount >= minOccurrences) {
    return {
      suggestedText: mostCommon,
      occurrences: maxCount,
    };
  }

  return null;
}

/**
 * Create a custom chip from user input
 */
export function createCustomChip(
  plainText: string,
  type: ChipType,
  userId: string
): StoryChip {
  const id = `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type,
    template: plainText,
    plainText,
    isCustom: true,
    createdAt: Date.now(),
    userId,
  };
}
