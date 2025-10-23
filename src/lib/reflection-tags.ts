import { InteractionCategory, Archetype, Vibe } from '../components/types';

/**
 * Reflection Tag System
 *
 * Quick-select chips that users can tap to build reflections
 * without typing. Tags combine into natural sentences.
 */

export type TagType = 'topic' | 'quality' | 'action' | 'connection';
export type TagPosition = 'start' | 'middle' | 'end';

export interface ReflectionTag {
  id: string;
  label: string;
  type: TagType;

  // Text generation
  template: string;              // How this tag appears in text
  position?: TagPosition;        // Preferred position in sentence

  // Context filters (when to show this tag)
  categories?: InteractionCategory[];
  archetypes?: Archetype[];
  vibes?: Vibe[];

  // Display
  weight?: number;               // Higher = show first (default: 5)
  emoji?: string;                // Optional emoji

  // Metadata
  synonyms?: string[];           // For future text parsing
  enabled?: boolean;             // Easy disable (default: true)
}

export interface TagContext {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe;
}

/**
 * REFLECTION TAG LIBRARY
 *
 * Add new tags here - the system will automatically
 * filter and display them based on context
 */
export const REFLECTION_TAGS: ReflectionTag[] = [
  // ================================================================
  // UNIVERSAL TOPIC TAGS (work across all categories)
  // ================================================================
  {
    id: 'work',
    label: 'Work',
    type: 'topic',
    template: 'talked about work',
    position: 'start',
    weight: 10,
    emoji: '💼',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    type: 'topic',
    template: 'discussed relationships',
    position: 'start',
    weight: 9,
    emoji: '💕',
  },
  {
    id: 'family',
    label: 'Family',
    type: 'topic',
    template: 'talked about family',
    position: 'start',
    weight: 9,
    emoji: '👨‍👩‍👧‍👦',
  },
  {
    id: 'dreams',
    label: 'Dreams',
    type: 'topic',
    template: 'shared dreams',
    position: 'start',
    weight: 8,
    emoji: '✨',
  },
  {
    id: 'struggles',
    label: 'Struggles',
    type: 'topic',
    template: 'opened up about struggles',
    position: 'start',
    weight: 8,
    emoji: '💪',
  },
  {
    id: 'good-news',
    label: 'Good News',
    type: 'topic',
    template: 'celebrated good news',
    position: 'start',
    weight: 7,
    emoji: '🎉',
  },
  {
    id: 'future',
    label: 'Future',
    type: 'topic',
    template: 'discussed the future',
    position: 'start',
    weight: 7,
  },
  {
    id: 'past',
    label: 'Past',
    type: 'topic',
    template: 'reminisced about the past',
    position: 'start',
    weight: 6,
  },

  // ================================================================
  // UNIVERSAL QUALITY TAGS
  // ================================================================
  {
    id: 'deep',
    label: 'Deep',
    type: 'quality',
    template: 'something deep',
    position: 'middle',
    weight: 9,
  },
  {
    id: 'meaningful',
    label: 'Meaningful',
    type: 'quality',
    template: 'something meaningful',
    position: 'middle',
    weight: 8,
  },
  {
    id: 'joyful',
    label: 'Joyful',
    type: 'quality',
    template: 'something joyful',
    position: 'middle',
    weight: 8,
    emoji: '😊',
  },
  {
    id: 'light',
    label: 'Light',
    type: 'quality',
    template: 'kept it light',
    position: 'middle',
    weight: 7,
  },
  {
    id: 'honest',
    label: 'Honest',
    type: 'quality',
    template: 'got honest',
    position: 'middle',
    weight: 7,
  },
  {
    id: 'playful',
    label: 'Playful',
    type: 'quality',
    template: 'stayed playful',
    position: 'middle',
    weight: 6,
    archetypes: ['Fool', 'Sun'],
  },

  // ================================================================
  // UNIVERSAL ACTION TAGS
  // ================================================================
  {
    id: 'laughed',
    label: 'Laughed',
    type: 'action',
    template: 'laughed together',
    position: 'middle',
    weight: 9,
    emoji: '😂',
  },
  {
    id: 'listened',
    label: 'Listened',
    type: 'action',
    template: 'really listened',
    position: 'middle',
    weight: 8,
  },
  {
    id: 'opened-up',
    label: 'Opened Up',
    type: 'action',
    template: 'opened up',
    position: 'start',
    weight: 8,
  },
  {
    id: 'supported',
    label: 'Supported',
    type: 'action',
    template: 'supported each other',
    position: 'middle',
    weight: 7,
    emoji: '🤝',
  },
  {
    id: 'caught-up',
    label: 'Caught Up',
    type: 'action',
    template: 'caught up',
    position: 'start',
    weight: 7,
  },

  // ================================================================
  // UNIVERSAL CONNECTION TAGS
  // ================================================================
  {
    id: 'closer',
    label: 'Closer',
    type: 'connection',
    template: 'felt closer',
    position: 'end',
    weight: 9,
    emoji: '🤗',
  },
  {
    id: 'understood',
    label: 'Understood',
    type: 'connection',
    template: 'felt understood',
    position: 'end',
    weight: 9,
  },
  {
    id: 'seen',
    label: 'Seen',
    type: 'connection',
    template: 'felt seen',
    position: 'end',
    weight: 8,
  },
  {
    id: 'safe',
    label: 'Safe',
    type: 'connection',
    template: 'felt safe',
    position: 'end',
    weight: 7,
  },
  {
    id: 'grateful',
    label: 'Grateful',
    type: 'connection',
    template: 'felt grateful',
    position: 'end',
    weight: 7,
    emoji: '🙏',
  },

  // ================================================================
  // DEEP-TALK SPECIFIC
  // ================================================================
  {
    id: 'fears',
    label: 'Fears',
    type: 'topic',
    template: 'talked about fears',
    position: 'start',
    categories: ['deep-talk'],
    weight: 9,
  },
  {
    id: 'hopes',
    label: 'Hopes',
    type: 'topic',
    template: 'shared hopes',
    position: 'start',
    categories: ['deep-talk'],
    weight: 9,
  },
  {
    id: 'doubts',
    label: 'Doubts',
    type: 'topic',
    template: 'explored doubts',
    position: 'start',
    categories: ['deep-talk'],
    weight: 8,
  },
  {
    id: 'vulnerable',
    label: 'Vulnerable',
    type: 'quality',
    template: 'something vulnerable',
    position: 'middle',
    categories: ['deep-talk'],
    archetypes: ['HighPriestess', 'Empress'],
    vibes: ['FullMoon', 'WaxingGibbous'],
    weight: 10,
  },
  {
    id: 'profound',
    label: 'Profound',
    type: 'quality',
    template: 'something profound',
    position: 'middle',
    categories: ['deep-talk'],
    vibes: ['FullMoon', 'WaxingGibbous'],
    weight: 9,
  },
  {
    id: 'listened-deeply',
    label: 'Listened Deeply',
    type: 'action',
    template: 'listened deeply',
    position: 'middle',
    categories: ['deep-talk'],
    archetypes: ['HighPriestess', 'Hermit'],
    weight: 9,
  },
  {
    id: 'got-real',
    label: 'Got Real',
    type: 'action',
    template: 'got real',
    position: 'middle',
    categories: ['deep-talk'],
    weight: 8,
  },
  {
    id: 'trusted',
    label: 'Trusted',
    type: 'connection',
    template: 'felt trusted',
    position: 'end',
    categories: ['deep-talk'],
    weight: 9,
  },

  // ================================================================
  // MEAL/DRINK SPECIFIC
  // ================================================================
  {
    id: 'shared-meal',
    label: 'Shared Meal',
    type: 'action',
    template: 'shared a meal',
    position: 'start',
    categories: ['meal-drink'],
    weight: 8,
  },
  {
    id: 'tried-something-new',
    label: 'Tried New Food',
    type: 'action',
    template: 'tried something new',
    position: 'middle',
    categories: ['meal-drink'],
    weight: 7,
    emoji: '🍽️',
  },
  {
    id: 'nourishing',
    label: 'Nourishing',
    type: 'quality',
    template: 'something nourishing',
    position: 'middle',
    categories: ['meal-drink'],
    archetypes: ['Empress'],
    weight: 8,
  },
  {
    id: 'lingered',
    label: 'Lingered',
    type: 'action',
    template: 'lingered over the meal',
    position: 'middle',
    categories: ['meal-drink'],
    weight: 7,
  },
  {
    id: 'bonded',
    label: 'Bonded',
    type: 'connection',
    template: 'bonded',
    position: 'end',
    categories: ['meal-drink'],
    weight: 8,
  },

  // ================================================================
  // HANGOUT SPECIFIC
  // ================================================================
  {
    id: 'chilled',
    label: 'Chilled',
    type: 'action',
    template: 'just chilled',
    position: 'start',
    categories: ['hangout'],
    weight: 8,
  },
  {
    id: 'nothing-specific',
    label: 'Nothing Specific',
    type: 'topic',
    template: 'talked about nothing specific',
    position: 'start',
    categories: ['hangout'],
    weight: 7,
  },
  {
    id: 'easy',
    label: 'Easy',
    type: 'quality',
    template: 'it was easy',
    position: 'middle',
    categories: ['hangout'],
    weight: 8,
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    type: 'quality',
    template: 'felt comfortable',
    position: 'middle',
    categories: ['hangout'],
    weight: 8,
  },
  {
    id: 'recharged',
    label: 'Recharged',
    type: 'connection',
    template: 'felt recharged',
    position: 'end',
    categories: ['hangout'],
    weight: 7,
  },

  // ================================================================
  // EVENT/PARTY SPECIFIC
  // ================================================================
  {
    id: 'danced',
    label: 'Danced',
    type: 'action',
    template: 'danced together',
    position: 'middle',
    categories: ['event-party'],
    archetypes: ['Fool', 'Sun'],
    weight: 8,
    emoji: '💃',
  },
  {
    id: 'mingled',
    label: 'Mingled',
    type: 'action',
    template: 'mingled',
    position: 'middle',
    categories: ['event-party'],
    weight: 7,
  },
  {
    id: 'fun',
    label: 'Fun',
    type: 'quality',
    template: 'had fun',
    position: 'middle',
    categories: ['event-party'],
    weight: 8,
  },
  {
    id: 'exciting',
    label: 'Exciting',
    type: 'quality',
    template: 'exciting',
    position: 'middle',
    categories: ['event-party'],
    weight: 7,
  },

  // ================================================================
  // ACTIVITY/HOBBY SPECIFIC
  // ================================================================
  {
    id: 'learned',
    label: 'Learned',
    type: 'action',
    template: 'learned something',
    position: 'start',
    categories: ['activity-hobby'],
    weight: 8,
  },
  {
    id: 'practiced',
    label: 'Practiced',
    type: 'action',
    template: 'practiced together',
    position: 'start',
    categories: ['activity-hobby'],
    weight: 7,
  },
  {
    id: 'created',
    label: 'Created',
    type: 'action',
    template: 'created something',
    position: 'start',
    categories: ['activity-hobby'],
    archetypes: ['Magician'],
    weight: 8,
  },
  {
    id: 'challenging',
    label: 'Challenging',
    type: 'quality',
    template: 'challenging',
    position: 'middle',
    categories: ['activity-hobby'],
    weight: 7,
  },
  {
    id: 'pushed-each-other',
    label: 'Pushed Each Other',
    type: 'connection',
    template: 'pushed each other',
    position: 'end',
    categories: ['activity-hobby'],
    weight: 8,
  },

  // ================================================================
  // CELEBRATION SPECIFIC
  // ================================================================
  {
    id: 'celebrated',
    label: 'Celebrated',
    type: 'action',
    template: 'celebrated',
    position: 'start',
    categories: ['celebration'],
    weight: 9,
    emoji: '🎉',
  },
  {
    id: 'surprised',
    label: 'Surprised',
    type: 'action',
    template: 'surprised them',
    position: 'middle',
    categories: ['celebration'],
    weight: 8,
  },
  {
    id: 'toasted',
    label: 'Toasted',
    type: 'action',
    template: 'toasted',
    position: 'middle',
    categories: ['celebration'],
    weight: 7,
    emoji: '🥂',
  },
  {
    id: 'honored',
    label: 'Honored',
    type: 'action',
    template: 'honored them',
    position: 'middle',
    categories: ['celebration'],
    weight: 8,
  },
  {
    id: 'festive',
    label: 'Festive',
    type: 'quality',
    template: 'festive',
    position: 'middle',
    categories: ['celebration'],
    weight: 7,
  },
  {
    id: 'proud',
    label: 'Proud',
    type: 'connection',
    template: 'felt proud',
    position: 'end',
    categories: ['celebration'],
    weight: 8,
  },

  // ================================================================
  // TEXT/CALL SPECIFIC
  // ================================================================
  {
    id: 'quick-check-in',
    label: 'Quick Check-in',
    type: 'topic',
    template: 'had a quick check-in',
    position: 'start',
    categories: ['text-call'],
    weight: 8,
  },
  {
    id: 'made-plans',
    label: 'Made Plans',
    type: 'action',
    template: 'made plans',
    position: 'middle',
    categories: ['text-call'],
    weight: 7,
  },
  {
    id: 'stayed-connected',
    label: 'Stayed Connected',
    type: 'connection',
    template: 'stayed connected',
    position: 'end',
    categories: ['text-call'],
    weight: 8,
  },

  // ================================================================
  // ARCHETYPE-SPECIFIC QUALITY TAGS
  // ================================================================
  {
    id: 'sacred',
    label: 'Sacred',
    type: 'quality',
    template: 'something sacred',
    position: 'middle',
    archetypes: ['HighPriestess'],
    vibes: ['FullMoon', 'WaxingGibbous'],
    weight: 9,
  },
  {
    id: 'intuitive',
    label: 'Intuitive',
    type: 'quality',
    template: 'intuitive',
    position: 'middle',
    archetypes: ['HighPriestess'],
    weight: 7,
  },
  {
    id: 'warm',
    label: 'Warm',
    type: 'quality',
    template: 'warm',
    position: 'middle',
    archetypes: ['Empress'],
    weight: 8,
  },
  {
    id: 'nurtured',
    label: 'Nurtured',
    type: 'connection',
    template: 'felt nurtured',
    position: 'end',
    archetypes: ['Empress'],
    weight: 8,
  },
  {
    id: 'spontaneous',
    label: 'Spontaneous',
    type: 'quality',
    template: 'spontaneous',
    position: 'middle',
    archetypes: ['Fool'],
    weight: 8,
  },
  {
    id: 'alive',
    label: 'Alive',
    type: 'connection',
    template: 'felt alive',
    position: 'end',
    archetypes: ['Fool', 'Sun'],
    weight: 8,
  },
  {
    id: 'radiant',
    label: 'Radiant',
    type: 'quality',
    template: 'radiant',
    position: 'middle',
    archetypes: ['Sun'],
    weight: 8,
  },
  {
    id: 'contemplative',
    label: 'Contemplative',
    type: 'quality',
    template: 'contemplative',
    position: 'middle',
    archetypes: ['Hermit'],
    weight: 7,
  },
  {
    id: 'peaceful',
    label: 'Peaceful',
    type: 'connection',
    template: 'felt peaceful',
    position: 'end',
    archetypes: ['Hermit'],
    weight: 8,
  },
  {
    id: 'inspired',
    label: 'Inspired',
    type: 'connection',
    template: 'felt inspired',
    position: 'end',
    archetypes: ['Magician'],
    weight: 8,
    emoji: '✨',
  },
  {
    id: 'creative',
    label: 'Creative',
    type: 'quality',
    template: 'creative',
    position: 'middle',
    archetypes: ['Magician'],
    weight: 8,
  },
];

/**
 * Tag Selector - finds relevant tags for context
 */
export class TagSelector {
  private tags: ReflectionTag[];

  constructor(tags: ReflectionTag[] = REFLECTION_TAGS) {
    this.tags = tags.filter(t => t.enabled !== false);
  }

  /**
   * Get tags for a specific context
   * Returns top 8-12 most relevant tags
   */
  selectTags(context: TagContext, limit: number = 12): ReflectionTag[] {
    // Score each tag
    const scored = this.tags.map(tag => ({
      tag,
      score: this.scoreTag(tag, context),
    }));

    // Filter out zero scores
    const relevant = scored.filter(s => s.score > 0);

    // Sort by score (highest first)
    relevant.sort((a, b) => b.score - a.score);

    // Ensure type diversity in top results
    const selected = this.ensureTypeDiversity(
      relevant.map(s => s.tag),
      limit
    );

    return selected;
  }

  /**
   * Score how relevant a tag is for the context
   */
  private scoreTag(tag: ReflectionTag, context: TagContext): number {
    let score = tag.weight || 5;

    // Category match
    if (tag.categories) {
      if (!tag.categories.includes(context.category)) {
        return 0; // Hard filter - category doesn't match
      }
      score += 5; // Bonus for category-specific tags
    }

    // Archetype match
    if (tag.archetypes && context.archetype) {
      if (tag.archetypes.includes(context.archetype)) {
        score += 10; // Big bonus for archetype match
      }
    }

    // Vibe match
    if (tag.vibes && context.vibe) {
      if (tag.vibes.includes(context.vibe)) {
        score += 5; // Bonus for vibe match
      }
    }

    return score;
  }

  /**
   * Ensure we have a mix of tag types
   * Aim for: 3-4 topics, 3-4 qualities, 2-3 actions, 2-3 connections
   */
  private ensureTypeDiversity(tags: ReflectionTag[], limit: number): ReflectionTag[] {
    const byType: Record<TagType, ReflectionTag[]> = {
      topic: [],
      quality: [],
      action: [],
      connection: [],
    };

    // Group by type
    tags.forEach(tag => byType[tag.type].push(tag));

    // Take proportionally from each type
    const result: ReflectionTag[] = [];
    const perType = Math.floor(limit / 4);

    // Prioritize: topics, qualities, connections, actions
    result.push(...byType.topic.slice(0, perType + 1));
    result.push(...byType.quality.slice(0, perType + 1));
    result.push(...byType.connection.slice(0, perType));
    result.push(...byType.action.slice(0, perType));

    // Fill remaining slots with highest scored tags
    const remaining = tags.filter(t => !result.includes(t));
    result.push(...remaining.slice(0, limit - result.length));

    return result.slice(0, limit);
  }

  /**
   * Get tags by type (useful for grouped display)
   */
  getTagsByType(context: TagContext): Record<TagType, ReflectionTag[]> {
    const allTags = this.selectTags(context, 20);
    return {
      topic: allTags.filter(t => t.type === 'topic'),
      quality: allTags.filter(t => t.type === 'quality'),
      action: allTags.filter(t => t.type === 'action'),
      connection: allTags.filter(t => t.type === 'connection'),
    };
  }
}

/**
 * Text Assembler - builds natural sentences from selected tags
 */
export class TagAssembler {
  /**
   * Assemble selected tags into a natural sentence
   */
  assembleTags(tags: ReflectionTag[]): string {
    if (tags.length === 0) return '';

    // Group by position/type
    const byType: Record<TagType, ReflectionTag[]> = {
      topic: tags.filter(t => t.type === 'topic'),
      action: tags.filter(t => t.type === 'action'),
      quality: tags.filter(t => t.type === 'quality'),
      connection: tags.filter(t => t.type === 'connection'),
    };

    const parts: string[] = [];

    // Start: topics or actions
    const starters = [...byType.topic, ...byType.action];
    if (starters.length > 0) {
      if (starters.length === 1) {
        parts.push(this.capitalize(starters[0].template));
      } else {
        // Multiple topics: "Talked about work, relationships, and dreams"
        const templates = starters.map(t => t.template.replace(/^(talked about|discussed|shared) /, ''));
        parts.push(this.capitalize(`talked about ${this.joinList(templates)}`));
      }
    }

    // Middle: qualities
    if (byType.quality.length > 0) {
      const qualityPart = byType.quality.map(t => t.template).join(' and ');
      if (parts.length > 0) {
        parts.push(`- ${qualityPart}`);
      } else {
        parts.push(this.capitalize(qualityPart));
      }
    }

    // End: connections
    if (byType.connection.length > 0) {
      const connectionPart = byType.connection.map(t => t.template).join(' and ');
      if (parts.length > 0) {
        parts.push(`Felt ${connectionPart.replace(/^felt /, '')}`);
      } else {
        parts.push(this.capitalize(connectionPart));
      }
    }

    // Join with appropriate punctuation
    let text = '';
    if (parts.length === 1) {
      text = parts[0];
    } else if (parts.length === 2) {
      text = `${parts[0]}. ${parts[1]}`;
    } else {
      text = parts.join('. ');
    }

    // Ensure ending punctuation
    if (!text.endsWith('.') && !text.endsWith('!')) {
      text += '.';
    }

    return text;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private joinList(items: string[]): string {
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(' and ');
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }
}

// Export singletons
export const tagSelector = new TagSelector();
export const tagAssembler = new TagAssembler();

/**
 * Convenience function
 */
export function selectReflectionTags(
  category: InteractionCategory,
  archetype?: Archetype,
  vibe?: Vibe,
  limit?: number
): ReflectionTag[] {
  return tagSelector.selectTags({ category, archetype, vibe }, limit);
}

export function assembleSelectedTags(tags: ReflectionTag[]): string {
  return tagAssembler.assembleTags(tags);
}
