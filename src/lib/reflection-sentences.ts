import { InteractionCategory, Archetype, Vibe } from '../components/types';

/**
 * Complete Sentence Reflection System
 *
 * Philosophy: Quick tap & done, with optional deepening
 * - Each sentence is a complete, ready-to-save reflection
 * - Contains editable components (words/phrases user can tap to change)
 * - Context-aware based on category, archetype, vibe
 */

export interface EditableComponent {
  original: string;      // The default word/phrase
  alternatives: string[]; // Other options to swap in
}

export interface ReflectionSentence {
  id: string;
  category: InteractionCategory;
  archetypes?: Archetype[];  // If undefined, applies to all
  vibes?: Vibe[];            // If undefined, applies to all

  // The complete sentence template
  // Use {component_id} for editable parts
  template: string;

  // Editable components that user can tap to change
  components: Record<string, EditableComponent>;

  // Plain text version (for quick save without editing)
  plainText: string;

  weight?: number;  // For weighted selection
  tags?: string[];  // For categorization
}

/**
 * REFLECTION SENTENCE LIBRARY
 *
 * Guidelines:
 * - Write in first person ("We", "I felt")
 * - Keep it conversational and natural
 * - Make components swappable (similar meaning, different tone)
 * - Match archetype energy and vibe intensity
 */
export const REFLECTION_SENTENCES: ReflectionSentence[] = [
  // ====================================================================
  // TEXT/CALL - Quick digital connections
  // ====================================================================
  {
    id: 'text-call_catchup',
    category: 'text-call',
    template: 'We {action} and it felt {quality}',
    components: {
      action: {
        original: 'caught up',
        alternatives: ['checked in', 'had a quick chat', 'texted back and forth'],
      },
      quality: {
        original: 'good to connect',
        alternatives: ['nice', 'meaningful', 'like we picked up where we left off'],
      },
    },
    plainText: 'We caught up and it felt good to connect',
  },
  {
    id: 'text-call_thinking',
    category: 'text-call',
    template: 'I was {feeling} so I reached out',
    components: {
      feeling: {
        original: 'thinking of them',
        alternatives: ['missing them', 'wanting to check in', 'hoping they were doing okay'],
      },
    },
    plainText: 'I was thinking of them so I reached out',
  },

  // ====================================================================
  // MEAL/DRINK - Quality time over food
  // ====================================================================
  {
    id: 'meal-drink_nourishing',
    category: 'meal-drink',
    archetypes: ['Empress'],
    template: 'We shared a {meal_type} and it was {quality}',
    components: {
      meal_type: {
        original: 'meal',
        alternatives: ['coffee', 'drink', 'long dinner'],
      },
      quality: {
        original: 'nourishing',
        alternatives: ['cozy', 'warm', 'exactly what I needed'],
      },
    },
    plainText: 'We shared a meal and it was nourishing',
  },
  {
    id: 'meal-drink_conversation',
    category: 'meal-drink',
    template: 'We talked about {topic} over {meal_type}',
    components: {
      topic: {
        original: 'life and where we are',
        alternatives: ['work and dreams', 'everything and nothing', 'what's been on our minds', 'the big stuff'],
      },
      meal_type: {
        original: 'food',
        alternatives: ['coffee', 'drinks', 'dinner'],
      },
    },
    plainText: 'We talked about life and where we are over food',
  },
  {
    id: 'meal-drink_peak',
    category: 'meal-drink',
    vibes: ['FullMoon', 'WaxingGibbous'],
    template: 'This was {quality} — we {action} and I felt {feeling}',
    components: {
      quality: {
        original: 'special',
        alternatives: ['exactly what I needed', 'one of those perfect moments', 'really meaningful'],
      },
      action: {
        original: 'really connected',
        alternatives: ['opened up', 'went deep', 'lost track of time'],
      },
      feeling: {
        original: 'so grateful',
        alternatives: ['really seen', 'closer than ever', 'like myself again'],
      },
    },
    plainText: 'This was special — we really connected and I felt so grateful',
  },

  // ====================================================================
  // HANGOUT - Casual in-person time
  // ====================================================================
  {
    id: 'hangout_easy',
    category: 'hangout',
    template: 'We just {action} and it was {quality}',
    components: {
      action: {
        original: 'hung out',
        alternatives: ['chilled', 'spent time together', 'existed in the same space'],
      },
      quality: {
        original: 'easy',
        alternatives: ['comfortable', 'exactly what I needed', 'low-key perfect'],
      },
    },
    plainText: 'We just hung out and it was easy',
  },
  {
    id: 'hangout_fool',
    category: 'hangout',
    archetypes: ['Fool'],
    template: 'We {action} and laughed {how}',
    components: {
      action: {
        original: 'did something spontaneous',
        alternatives: ['went on an adventure', 'said yes to randomness', 'followed our whims'],
      },
      how: {
        original: 'so much',
        alternatives: ['the whole time', 'until our faces hurt', 'at absolutely nothing'],
      },
    },
    plainText: 'We did something spontaneous and laughed so much',
  },
  {
    id: 'hangout_comfortable',
    category: 'hangout',
    archetypes: ['Empress', 'Hermit'],
    template: 'We enjoyed {what} together',
    components: {
      what: {
        original: 'comfortable silence',
        alternatives: ['just being', 'each other's company', 'not needing to fill the space'],
      },
    },
    plainText: 'We enjoyed comfortable silence together',
  },

  // ====================================================================
  // DEEP TALK - Meaningful conversations
  // ====================================================================
  {
    id: 'deep-talk_opened-up',
    category: 'deep-talk',
    template: 'We talked about {topic} and I felt {feeling}',
    components: {
      topic: {
        original: 'something vulnerable',
        alternatives: ['our fears', 'what we've been holding', 'the hard stuff', 'what really matters'],
      },
      feeling: {
        original: 'really seen',
        alternatives: ['understood', 'safe', 'closer', 'less alone'],
      },
    },
    plainText: 'We talked about something vulnerable and I felt really seen',
  },
  {
    id: 'deep-talk_highpriestess',
    category: 'deep-talk',
    archetypes: ['HighPriestess'],
    template: 'We {action} and something {quality} emerged',
    components: {
      action: {
        original: 'went deep',
        alternatives: ['talked for hours', 'really listened to each other', 'held space'],
      },
      quality: {
        original: 'true',
        alternatives: ['sacred', 'profound', 'real', 'wise'],
      },
    },
    plainText: 'We went deep and something true emerged',
  },
  {
    id: 'deep-talk_breakthrough',
    category: 'deep-talk',
    vibes: ['FullMoon', 'WaxingGibbous'],
    template: 'I opened up about {topic} and it felt {feeling}',
    components: {
      topic: {
        original: 'something I've been carrying',
        alternatives: ['my fears', 'what I really need', 'the truth', 'where I'm stuck'],
      },
      feeling: {
        original: 'like a release',
        alternatives: ['transformative', 'exactly right', 'like a breakthrough', 'scary but good'],
      },
    },
    plainText: 'I opened up about something I've been carrying and it felt like a release',
  },
  {
    id: 'deep-talk_hermit',
    category: 'deep-talk',
    archetypes: ['Hermit'],
    template: 'We sat with {what} and found {discovery}',
    components: {
      what: {
        original: 'the quiet',
        alternatives: ['the questions', 'what we don't know', 'the complexity'],
      },
      discovery: {
        original: 'wisdom in the silence',
        alternatives: ['peace in not knowing', 'clarity', 'something true'],
      },
    },
    plainText: 'We sat with the quiet and found wisdom in the silence',
  },

  // ====================================================================
  // EVENT/PARTY - Social gatherings
  // ====================================================================
  {
    id: 'event-party_fun',
    category: 'event-party',
    template: 'We {action} and it was {quality}',
    components: {
      action: {
        original: 'went to a thing together',
        alternatives: ['hit the party', 'showed up', 'made an appearance'],
      },
      quality: {
        original: 'fun',
        alternatives: ['a good time', 'worth it', 'exactly the right amount of social'],
      },
    },
    plainText: 'We went to a thing together and it was fun',
  },
  {
    id: 'event-party_sun',
    category: 'event-party',
    archetypes: ['Sun'],
    template: 'We {action} and felt {feeling}',
    components: {
      action: {
        original: 'celebrated together',
        alternatives: ['danced', 'were fully present', 'shined'],
      },
      feeling: {
        original: 'radiant',
        alternatives: ['alive', 'joyful', 'like we belonged'],
      },
    },
    plainText: 'We celebrated together and felt radiant',
  },
  {
    id: 'event-party_peoplewatched',
    category: 'event-party',
    template: 'We {action} and {outcome}',
    components: {
      action: {
        original: 'people-watched',
        alternatives: ['observed the scene', 'stayed on the edges', 'found our corner'],
      },
      outcome: {
        original: 'had the best conversations',
        alternatives: ['connected in the chaos', 'made it our own', 'enjoyed the bubble'],
      },
    },
    plainText: 'We people-watched and had the best conversations',
  },

  // ====================================================================
  // ACTIVITY/HOBBY - Shared activities
  // ====================================================================
  {
    id: 'activity-hobby_did',
    category: 'activity-hobby',
    template: 'We {action} and it was {quality}',
    components: {
      action: {
        original: 'did something together',
        alternatives: ['tried something new', 'worked on a project', 'practiced'],
      },
      quality: {
        original: 'satisfying',
        alternatives: ['fun', 'challenging in a good way', 'flow state'],
      },
    },
    plainText: 'We did something together and it was satisfying',
  },
  {
    id: 'activity-hobby_magician',
    category: 'activity-hobby',
    archetypes: ['Magician'],
    template: 'We {action} and {outcome}',
    components: {
      action: {
        original: 'created something together',
        alternatives: ['brought an idea to life', 'made magic happen', 'collaborated'],
      },
      outcome: {
        original: 'sparked new ideas',
        alternatives: ['felt the creative flow', 'surprised ourselves', 'built something cool'],
      },
    },
    plainText: 'We created something together and sparked new ideas',
  },
  {
    id: 'activity-hobby_teamwork',
    category: 'activity-hobby',
    template: 'We {action} and I loved {what}',
    components: {
      action: {
        original: 'worked together',
        alternatives: ['partnered up', 'pushed each other', 'found our rhythm'],
      },
      what: {
        original: 'the teamwork',
        alternatives: ['how we complemented each other', 'the shared focus', 'being on the same wavelength'],
      },
    },
    plainText: 'We worked together and I loved the teamwork',
  },

  // ====================================================================
  // CELEBRATION - Milestones and special occasions
  // ====================================================================
  {
    id: 'celebration_honored',
    category: 'celebration',
    template: 'We celebrated {what} and it felt {feeling}',
    components: {
      what: {
        original: 'something important',
        alternatives: ['a milestone', 'this moment', 'how far we've come'],
      },
      feeling: {
        original: 'meaningful',
        alternatives: ['special', 'emotional', 'exactly right'],
      },
    },
    plainText: 'We celebrated something important and it felt meaningful',
  },
  {
    id: 'celebration_sun',
    category: 'celebration',
    archetypes: ['Sun'],
    template: 'We {action} and I felt {feeling}',
    components: {
      action: {
        original: 'honored this moment',
        alternatives: ['toasted to life', 'basked in the joy', 'let ourselves shine'],
      },
      feeling: {
        original: 'so grateful',
        alternatives: ['radiant', 'full of joy', 'blessed'],
      },
    },
    plainText: 'We honored this moment and I felt so grateful',
  },
  {
    id: 'celebration_empress',
    category: 'celebration',
    archetypes: ['Empress'],
    template: 'I wanted them to feel {feeling}, so I {action}',
    components: {
      feeling: {
        original: 'cherished',
        alternatives: ['celebrated', 'seen', 'loved'],
      },
      action: {
        original: 'made it special',
        alternatives: ['put thought into it', 'created something beautiful', 'showed up with care'],
      },
    },
    plainText: 'I wanted them to feel cherished, so I made it special',
  },

  // ====================================================================
  // VOICE NOTE - Async voice messages
  // ====================================================================
  {
    id: 'voice-note_async',
    category: 'voice-note',
    template: 'We {action} and it felt {quality}',
    components: {
      action: {
        original: 'sent voice notes back and forth',
        alternatives: ['rambled at each other', 'voice-journaled together', 'stayed connected async'],
      },
      quality: {
        original: 'intimate',
        alternatives: ['like a conversation across time', 'cozy', 'just right'],
      },
    },
    plainText: 'We sent voice notes back and forth and it felt intimate',
  },
  {
    id: 'voice-note_heard',
    category: 'voice-note',
    template: 'I {action} and felt {feeling}',
    components: {
      action: {
        original: 'heard their voice',
        alternatives: ['listened to their ramble', 'got their message', 'felt them through the audio'],
      },
      feeling: {
        original: 'connected',
        alternatives: ['close even when apart', 'like they were here', 'warm'],
      },
    },
    plainText: 'I heard their voice and felt connected',
  },

  // ====================================================================
  // UNIVERSAL FALLBACKS
  // ====================================================================
  {
    id: 'universal_good',
    category: 'text-call', // Will be used as universal
    template: 'We {action} and it was {quality}',
    components: {
      action: {
        original: 'connected',
        alternatives: ['spent time together', 'caught up', 'were together'],
      },
      quality: {
        original: 'good',
        alternatives: ['nice', 'meaningful', 'what I needed'],
      },
    },
    plainText: 'We connected and it was good',
    weight: 0.1, // Low weight so specific sentences are preferred
  },
];

/**
 * Sentence Selector
 * Finds the best complete sentence for the given context
 */
export class SentenceSelector {
  private sentences: ReflectionSentence[];

  constructor(sentences: ReflectionSentence[] = REFLECTION_SENTENCES) {
    this.sentences = sentences;
  }

  /**
   * Select top N sentences for given context
   */
  selectSentences(
    context: {
      category: InteractionCategory;
      archetype?: Archetype;
      vibe?: Vibe;
    },
    limit = 6
  ): ReflectionSentence[] {
    // Find all sentences for this category
    const categoryMatches = this.sentences.filter(
      s => s.category === context.category
    );

    if (categoryMatches.length === 0) {
      return this.getFallbackSentences(limit);
    }

    // Score each sentence by specificity
    const scoredSentences = categoryMatches.map(sentence => ({
      sentence,
      score: this.calculateSpecificityScore(sentence, context),
    }));

    // Sort by score (highest first)
    scoredSentences.sort((a, b) => b.score - a.score);

    // Return top N
    return scoredSentences.slice(0, limit).map(s => s.sentence);
  }

  /**
   * Calculate how specific a sentence is for the context
   */
  private calculateSpecificityScore(
    sentence: ReflectionSentence,
    context: { category: InteractionCategory; archetype?: Archetype; vibe?: Vibe }
  ): number {
    let score = 1; // Base score for category match

    // Archetype match
    if (sentence.archetypes) {
      if (context.archetype && sentence.archetypes.includes(context.archetype)) {
        score += 10; // High value for archetype match
      } else {
        score -= 5; // Penalize if archetype specified but doesn't match
      }
    }

    // Vibe match
    if (sentence.vibes) {
      if (context.vibe && sentence.vibes.includes(context.vibe)) {
        score += 5; // Medium value for vibe match
      } else {
        score -= 2; // Penalize if vibe specified but doesn't match
      }
    }

    return score;
  }

  /**
   * Get universal fallback sentences
   */
  private getFallbackSentences(limit: number): ReflectionSentence[] {
    const fallbacks = this.sentences.filter(s => s.weight && s.weight < 1);
    return fallbacks.slice(0, limit);
  }
}

// Export singleton instance
export const sentenceSelector = new SentenceSelector();

/**
 * Convenience function for selecting sentences
 */
export function selectReflectionSentences(
  category: InteractionCategory,
  archetype?: Archetype,
  vibe?: Vibe,
  limit = 6
): ReflectionSentence[] {
  return sentenceSelector.selectSentences({ category, archetype, vibe }, limit);
}
