/**
 * Contextual Gratitude Prompts
 * Generates personalized prompts based on user's weekly activity
 */

import { WeeklySummary } from './weekly-stats';

export interface ContextualPrompt {
  prompt: string;
  context: string; // Short description of why this prompt was chosen
}

/**
 * Generate contextual gratitude prompts based on weekly summary
 */
export function generateContextualPrompts(summary: WeeklySummary): ContextualPrompt[] {
  const prompts: ContextualPrompt[] = [];

  // Prompts for active weeks (5+ weaves)
  if (summary.totalWeaves >= 5) {
    prompts.push({
      prompt: `You logged ${summary.totalWeaves} weaves this week. Which connection brought you the most joy?`,
      context: 'Active week reflection',
    });

    if (summary.friendsContacted >= 3) {
      prompts.push({
        prompt: `You connected with ${summary.friendsContacted} different friends. What pattern do you notice in your best moments with them?`,
        context: 'Multiple connections',
      });
    }

    if (summary.topActivityCount >= 3) {
      prompts.push({
        prompt: `${summary.topActivity} was your go-to this week (${summary.topActivityCount}×). What does that tell you about how you like to connect?`,
        context: 'Activity pattern',
      });
    }

    // If they have a specific friend they contacted multiple times
    const randomContactedIndex = Math.floor(Math.random() * Math.min(summary.friendsContacted, 3));
    prompts.push({
      prompt: `What made your time connecting this week feel meaningful?`,
      context: 'General reflection',
    });
  }

  // Prompts for moderate weeks (1-4 weaves)
  else if (summary.totalWeaves > 0 && summary.totalWeaves < 5) {
    prompts.push({
      prompt: `Even small connections matter. What stood out about the time you made for relationships this week?`,
      context: 'Gentle week',
    });

    prompts.push({
      prompt: `Quality over quantity. What made your ${summary.totalWeaves === 1 ? 'connection' : 'connections'} this week special?`,
      context: 'Intentional connection',
    });
  }

  // Prompts for quiet weeks (0 weaves)
  else {
    prompts.push({
      prompt: `This was a quiet week. What would help you feel more connected in the week ahead?`,
      context: 'Restful week',
    });

    prompts.push({
      prompt: `Sometimes we need time for ourselves. What relationships are you grateful for, even when you haven't connected recently?`,
      context: 'Appreciation',
    });

    if (summary.missedFriends.length > 0) {
      const randomMissed = summary.missedFriends[Math.floor(Math.random() * summary.missedFriends.length)];
      prompts.push({
        prompt: `${randomMissed.friend.name} came to mind this week. What do you appreciate most about your friendship with them?`,
        context: 'Missed connection',
      });
    }
  }

  // Prompts for when there are missed friends (regardless of activity level)
  if (summary.missedFriends.length > 0 && summary.totalWeaves > 0) {
    const randomMissed = summary.missedFriends[Math.floor(Math.random() * Math.min(summary.missedFriends.length, 2))];
    prompts.push({
      prompt: `You haven't connected with ${randomMissed.friend.name} recently. What memory with them makes you smile?`,
      context: 'Drifting friend',
    });

    if (summary.missedFriends.length >= 3) {
      prompts.push({
        prompt: `A few close friends need attention. What's one small step you could take to reach out this week?`,
        context: 'Multiple missed',
      });
    }
  }

  // Growth/momentum prompts
  if (summary.totalWeaves >= 10) {
    prompts.push({
      prompt: `You're building incredible momentum. How does it feel to prioritize your relationships this way?`,
      context: 'Strong momentum',
    });
  }

  // Balance prompts
  if (summary.friendsContacted >= 5 && summary.missedFriends.length === 0) {
    prompts.push({
      prompt: `Your important relationships are thriving. What practices or habits are helping you stay connected?`,
      context: 'Balanced weave',
    });
  }

  // Variety prompts
  if (summary.topActivityCount > 0 && summary.totalWeaves > summary.topActivityCount + 2) {
    prompts.push({
      prompt: `You mixed it up this week with different ways of connecting. Which style felt most natural?`,
      context: 'Variety',
    });
  }

  // Always include a few universal fallbacks
  prompts.push({
    prompt: `What unexpected moment of connection surprised you this week?`,
    context: 'Universal',
  });

  prompts.push({
    prompt: `When you think about your friendships, what fills your heart with gratitude?`,
    context: 'Universal',
  });

  prompts.push({
    prompt: `If you could send a thank-you message to one friend right now, who would it be and why?`,
    context: 'Universal',
  });

  return prompts;
}

/**
 * Select the best prompt from generated options
 * Prioritizes context-specific over universal
 */
export function selectBestPrompt(prompts: ContextualPrompt[]): ContextualPrompt {
  // Filter out universal prompts first
  const specificPrompts = prompts.filter(p => p.context !== 'Universal');

  // If we have specific prompts, randomly pick one
  if (specificPrompts.length > 0) {
    return specificPrompts[Math.floor(Math.random() * specificPrompts.length)];
  }

  // Otherwise use a universal prompt
  const universalPrompts = prompts.filter(p => p.context === 'Universal');
  return universalPrompts[Math.floor(Math.random() * universalPrompts.length)];
}
