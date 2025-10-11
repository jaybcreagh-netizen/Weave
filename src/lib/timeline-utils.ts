import { addDays } from 'date-fns';
import { type Interaction } from '../components/types';
import { type Tier, type Status } from '../components/types';

export interface ConnectionStatus {
  status: Status;
  statusText: string;
}

// Define the rules for each tier in days
const tierRules = {
  InnerCircle: 7,   // Weekly interaction
  CloseFriends: 30, // Monthly interaction
  Community: 90,    // Quarterly interaction
};

export function calculateNextConnectionDate(lastInteractionDate: Date, tier: Tier): Date {
    const daysToAdd = tierRules[tier];
    return addDays(lastInteractionDate, daysToAdd);
}

export function calculateOverallStatus(interactions: Interaction[], tier: Tier): ConnectionStatus {
  if (!interactions || interactions.length === 0) {
    return {
      status: 'Red',
      statusText: 'No connection yet. Time to reach out!',
    };
  }

  // Find the most recent interaction
  const mostRecentInteraction = interactions.reduce((latest, current) => {
    const latestDate = new Date(latest.date);
    const currentDate = new Date(current.date);
    return currentDate > latestDate ? current : latest;
  });

  const lastInteractionDate = new Date(mostRecentInteraction.date);
  const now = new Date();
  const daysSinceLastInteraction = Math.floor((now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24));

  const rule = tierRules[tier];
  const yellowThreshold = rule * 0.75;

  if (daysSinceLastInteraction < yellowThreshold) {
    return {
      status: 'Green',
      statusText: `Connected ${daysSinceLastInteraction}d ago. Strong! `,
    };
  } else if (daysSinceLastInteraction < rule) {
    return {
      status: 'Yellow',
      statusText: `Connected ${daysSinceLastInteraction}d ago. Needs a refresh.`,
    };
  } else {
    return {
      status: 'Red',
      statusText: `Last connected ${daysSinceLastInteraction}d ago. Time to reconnect!`,
    };
  }
}
