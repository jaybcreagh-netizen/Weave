import { InteractionCategory, Archetype, Vibe } from '../components/types';

/**
 * Reflection Prompt System
 *
 * Architecture:
 * - Data-driven: All prompts in structured format
 * - Hierarchical fallback: Specific → General
 * - Easy to extend: Add new prompts without code changes
 * - A/B testable: Multiple prompts with weights
 * - Future-proof: Support for conditions, templates, i18n
 */

export interface ReflectionPrompt {
  id: string;
  category: InteractionCategory;
  archetypes?: Archetype[];     // If undefined, applies to all archetypes
  vibes?: Vibe[];               // If undefined, applies to all vibes
  prompt: string;               // The question shown to user
  placeholder?: string;         // Optional placeholder text
  weight?: number;              // For weighted random selection (default: 1)
  tags?: string[];              // For categorization/filtering
  enabled?: boolean;            // Easy way to disable prompts (default: true)
}

/**
 * Prompt Selection Context
 * Used to find the most relevant prompt
 */
export interface PromptContext {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe;
}

/**
 * PROMPT LIBRARY
 *
 * Guidelines for writing prompts:
 * - Keep questions open-ended and inviting
 * - Use "you" to make it personal
 * - Avoid yes/no questions
 * - Match the archetype's communication style
 * - Consider the category context
 *
 * Naming convention: {category}_{archetype}_{vibe}_{variant}
 */
export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  // ====================================================================
  // TEXT/CALL - Quick digital connections
  // ====================================================================
  {
    id: 'text-call_universal',
    category: 'text-call',
    prompt: 'What did you connect about?',
    placeholder: 'Share what made this exchange meaningful...',
    tags: ['universal', 'simple'],
  },
  {
    id: 'text-call_highpriestess',
    category: 'text-call',
    archetypes: ['HighPriestess'],
    prompt: 'What unspoken truth came through in your exchange?',
    placeholder: 'Reflect on what was said between the lines...',
    tags: ['depth', 'intuition'],
  },
  {
    id: 'text-call_empress',
    category: 'text-call',
    archetypes: ['Empress'],
    prompt: 'How did you nurture each other through words?',
    placeholder: 'Share how you cared for each other...',
    tags: ['care', 'warmth'],
  },
  {
    id: 'text-call_fool',
    category: 'text-call',
    archetypes: ['Fool'],
    prompt: 'What made you smile or laugh?',
    placeholder: 'Capture the joy of your exchange...',
    tags: ['joy', 'spontaneous'],
  },

  // ====================================================================
  // MEAL/DRINK - Quality time over food
  // ====================================================================
  {
    id: 'meal-drink_universal',
    category: 'meal-drink',
    prompt: 'What did you talk about over your meal?',
    placeholder: 'Share the conversation and connection...',
    tags: ['universal', 'conversation'],
  },
  {
    id: 'meal-drink_highpriestess',
    category: 'meal-drink',
    archetypes: ['HighPriestess'],
    prompt: 'What truth emerged between you?',
    placeholder: 'Reflect on the wisdom shared over your meal...',
    tags: ['depth', 'wisdom'],
  },
  {
    id: 'meal-drink_empress',
    category: 'meal-drink',
    archetypes: ['Empress'],
    prompt: 'What nourished you beyond the food?',
    placeholder: 'Share the warmth and comfort you felt...',
    tags: ['nourishment', 'comfort'],
  },
  {
    id: 'meal-drink_emperor',
    category: 'meal-drink',
    archetypes: ['Emperor'],
    prompt: 'What did you accomplish or plan together?',
    placeholder: 'Note the goals or decisions made...',
    tags: ['achievement', 'planning'],
  },
  {
    id: 'meal-drink_sun',
    category: 'meal-drink',
    archetypes: ['Sun'],
    prompt: 'What made this meal feel celebratory?',
    placeholder: 'Capture the joy and radiance of your time together...',
    tags: ['celebration', 'joy'],
  },
  {
    id: 'meal-drink_fullmoon',
    category: 'meal-drink',
    vibes: ['FullMoon', 'WaxingGibbous'],
    prompt: 'What made this meal so special?',
    placeholder: 'This was a peak moment - what made it memorable?',
    tags: ['peak', 'memorable'],
  },

  // ====================================================================
  // HANGOUT - Casual in-person time
  // ====================================================================
  {
    id: 'hangout_universal',
    category: 'hangout',
    prompt: 'What did you enjoy about spending time together?',
    placeholder: 'Share what made this time special...',
    tags: ['universal', 'enjoyment'],
  },
  {
    id: 'hangout_fool',
    category: 'hangout',
    archetypes: ['Fool'],
    prompt: 'What spontaneous moments happened?',
    placeholder: 'Capture the fun and unexpected...',
    tags: ['spontaneous', 'adventure'],
  },
  {
    id: 'hangout_empress',
    category: 'hangout',
    archetypes: ['Empress'],
    prompt: 'What made this time feel cozy and comfortable?',
    placeholder: 'Reflect on the ease and warmth...',
    tags: ['comfort', 'ease'],
  },

  // ====================================================================
  // DEEP TALK - Meaningful conversations
  // ====================================================================
  {
    id: 'deep-talk_universal',
    category: 'deep-talk',
    prompt: 'What did you dive into together?',
    placeholder: 'Share the meaningful topics you explored...',
    tags: ['universal', 'depth'],
  },
  {
    id: 'deep-talk_highpriestess',
    category: 'deep-talk',
    archetypes: ['HighPriestess'],
    prompt: 'What sacred truth was revealed?',
    placeholder: 'Reflect on the wisdom and insight that emerged...',
    tags: ['wisdom', 'sacred'],
  },
  {
    id: 'deep-talk_hermit',
    category: 'deep-talk',
    archetypes: ['Hermit'],
    prompt: 'What wisdom did you discover in the quiet between words?',
    placeholder: 'Share the contemplative insights...',
    tags: ['contemplation', 'wisdom'],
  },
  {
    id: 'deep-talk_magician',
    category: 'deep-talk',
    archetypes: ['Magician'],
    prompt: 'What ideas sparked between you?',
    placeholder: 'Capture the creative insights and possibilities...',
    tags: ['creativity', 'ideas'],
  },
  {
    id: 'deep-talk_fullmoon',
    category: 'deep-talk',
    vibes: ['FullMoon', 'WaxingGibbous'],
    prompt: 'What vulnerable truth did you share?',
    placeholder: 'This was profound - what opened up between you?',
    tags: ['vulnerability', 'profound'],
  },

  // ====================================================================
  // EVENT/PARTY - Social gatherings
  // ====================================================================
  {
    id: 'event-party_universal',
    category: 'event-party',
    prompt: 'What stood out about this gathering?',
    placeholder: 'Share your favorite moment or connection...',
    tags: ['universal', 'social'],
  },
  {
    id: 'event-party_sun',
    category: 'event-party',
    archetypes: ['Sun'],
    prompt: 'How did you shine and celebrate together?',
    placeholder: 'Capture the radiant energy and joy...',
    tags: ['celebration', 'radiance'],
  },
  {
    id: 'event-party_fool',
    category: 'event-party',
    archetypes: ['Fool'],
    prompt: 'What unexpected delight happened?',
    placeholder: 'Share the spontaneous fun and surprises...',
    tags: ['spontaneous', 'delight'],
  },

  // ====================================================================
  // ACTIVITY/HOBBY - Shared activities
  // ====================================================================
  {
    id: 'activity-hobby_universal',
    category: 'activity-hobby',
    prompt: 'What did you do together?',
    placeholder: 'Share the experience and what you enjoyed...',
    tags: ['universal', 'experience'],
  },
  {
    id: 'activity-hobby_magician',
    category: 'activity-hobby',
    archetypes: ['Magician'],
    prompt: 'What did you create or discover together?',
    placeholder: 'Capture the creative magic and insights...',
    tags: ['creativity', 'discovery'],
  },
  {
    id: 'activity-hobby_fool',
    category: 'activity-hobby',
    archetypes: ['Fool'],
    prompt: 'What adventure did you have?',
    placeholder: 'Share the journey and excitement...',
    tags: ['adventure', 'excitement'],
  },
  {
    id: 'activity-hobby_emperor',
    category: 'activity-hobby',
    archetypes: ['Emperor'],
    prompt: 'What did you achieve or accomplish?',
    placeholder: 'Note the goals met and progress made...',
    tags: ['achievement', 'goals'],
  },

  // ====================================================================
  // CELEBRATION - Milestones and special occasions
  // ====================================================================
  {
    id: 'celebration_universal',
    category: 'celebration',
    prompt: 'What are you celebrating?',
    placeholder: 'Share why this moment matters...',
    tags: ['universal', 'milestone'],
  },
  {
    id: 'celebration_sun',
    category: 'celebration',
    archetypes: ['Sun'],
    prompt: 'How did you honor this special moment?',
    placeholder: 'Capture the radiance and joy of celebration...',
    tags: ['honor', 'radiance'],
  },
  {
    id: 'celebration_empress',
    category: 'celebration',
    archetypes: ['Empress'],
    prompt: 'How did you make them feel cherished?',
    placeholder: 'Share the love and care you expressed...',
    tags: ['cherish', 'love'],
  },

  // ====================================================================
  // VOICE NOTE - Async voice messages
  // ====================================================================
  {
    id: 'voice-note_universal',
    category: 'voice-note',
    prompt: 'What did you share with each other?',
    placeholder: 'Capture the essence of your exchange...',
    tags: ['universal', 'voice'],
  },
  {
    id: 'voice-note_empress',
    category: 'voice-note',
    archetypes: ['Empress'],
    prompt: 'What warmth came through in their voice?',
    placeholder: 'Reflect on the care and connection...',
    tags: ['warmth', 'care'],
  },

  // ====================================================================
  // FALLBACK PROMPTS (when no specific match found)
  // ====================================================================
  {
    id: 'fallback_general',
    category: 'text-call', // Will be used as universal fallback
    prompt: 'What made this moment meaningful?',
    placeholder: 'Share what you want to remember...',
    tags: ['fallback', 'universal'],
    weight: 0.1, // Low weight so specific prompts are preferred
  },
];

/**
 * Smart Prompt Selector
 *
 * Selection Strategy:
 * 1. Find all matching prompts (by category)
 * 2. Score by specificity (archetype + vibe match = highest)
 * 3. Filter by enabled status
 * 4. Weighted random selection from top matches
 * 5. Fallback to universal if no match
 */
export class PromptSelector {
  private prompts: ReflectionPrompt[];

  constructor(prompts: ReflectionPrompt[] = REFLECTION_PROMPTS) {
    this.prompts = prompts.filter(p => p.enabled !== false);
  }

  /**
   * Select the best prompt for given context
   */
  selectPrompt(context: PromptContext): ReflectionPrompt {
    // Find all prompts for this category
    const categoryMatches = this.prompts.filter(
      p => p.category === context.category
    );

    if (categoryMatches.length === 0) {
      return this.getFallbackPrompt();
    }

    // Score each prompt by specificity
    const scoredPrompts = categoryMatches.map(prompt => ({
      prompt,
      score: this.calculateSpecificityScore(prompt, context),
    }));

    // Sort by score (highest first)
    scoredPrompts.sort((a, b) => b.score - a.score);

    // Get top matches (all with highest score)
    const topScore = scoredPrompts[0].score;
    const topMatches = scoredPrompts.filter(p => p.score === topScore);

    // Weighted random selection from top matches
    return this.weightedRandomSelect(topMatches.map(p => p.prompt));
  }

  /**
   * Calculate how specific a prompt is for the context
   * Higher score = more specific match
   */
  private calculateSpecificityScore(
    prompt: ReflectionPrompt,
    context: PromptContext
  ): number {
    let score = 0;

    // Base score for category match (already filtered)
    score += 1;

    // Archetype match
    if (prompt.archetypes) {
      if (context.archetype && prompt.archetypes.includes(context.archetype)) {
        score += 10; // High value for archetype match
      } else {
        // Archetype specified but doesn't match - penalize
        score -= 5;
      }
    }

    // Vibe match
    if (prompt.vibes) {
      if (context.vibe && prompt.vibes.includes(context.vibe)) {
        score += 5; // Medium value for vibe match
      } else {
        // Vibe specified but doesn't match - penalize
        score -= 2;
      }
    }

    return score;
  }

  /**
   * Weighted random selection
   */
  private weightedRandomSelect(prompts: ReflectionPrompt[]): ReflectionPrompt {
    const totalWeight = prompts.reduce((sum, p) => sum + (p.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const prompt of prompts) {
      random -= prompt.weight || 1;
      if (random <= 0) {
        return prompt;
      }
    }

    // Fallback to first (shouldn't reach here)
    return prompts[0];
  }

  /**
   * Get universal fallback prompt
   */
  private getFallbackPrompt(): ReflectionPrompt {
    const fallback = this.prompts.find(p => p.tags?.includes('fallback'));
    return (
      fallback || {
        id: 'emergency_fallback',
        category: 'text-call',
        prompt: 'What happened?',
        placeholder: 'Share your thoughts...',
      }
    );
  }

  /**
   * Get all prompts for a category (useful for testing/debugging)
   */
  getPromptsForCategory(category: InteractionCategory): ReflectionPrompt[] {
    return this.prompts.filter(p => p.category === category);
  }

  /**
   * Add custom prompt (for user customization in future)
   */
  addPrompt(prompt: ReflectionPrompt): void {
    this.prompts.push(prompt);
  }
}

// Export singleton instance for convenience
export const promptSelector = new PromptSelector();

/**
 * Convenience function for selecting a prompt
 */
export function selectReflectionPrompt(
  category: InteractionCategory,
  archetype?: Archetype,
  vibe?: Vibe
): ReflectionPrompt {
  return promptSelector.selectPrompt({ category, archetype, vibe });
}
