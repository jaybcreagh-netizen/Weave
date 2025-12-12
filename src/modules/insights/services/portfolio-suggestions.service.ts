import { Suggestion } from '@/shared/types/common';
import { type FriendshipPortfolio, type PortfolioImbalance, type FlexibilityMode } from '../types';

/**
 * Generates portfolio-level suggestions based on network-wide imbalances
 * These are shown alongside individual friend suggestions to provide holistic guidance
 */
export function generatePortfolioSuggestions(portfolio: FriendshipPortfolio): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Process each imbalance
    portfolio.imbalances.forEach(imbalance => {
        const suggestion = convertImbalanceToSuggestion(imbalance, portfolio);
        if (suggestion) {
            suggestions.push(suggestion);
        }
    });

    return suggestions;
}

/**
 * Converts a portfolio imbalance into an actionable suggestion
 */
function convertImbalanceToSuggestion(
    imbalance: PortfolioImbalance,
    portfolio: FriendshipPortfolio
): Suggestion | null {
    const baseId = `portfolio-${imbalance.type}`;

    switch (imbalance.type) {
        case 'inner-circle-drift':
            const urgency = imbalance.severity === 'critical' ? 'critical' : 'high';
            return {
                id: `${baseId}-inner-circle`,
                friendId: '', // Portfolio suggestions aren't tied to a specific friend
                friendName: '',
                urgency: urgency,
                category: 'portfolio',
                title: imbalance.title,
                subtitle: imbalance.description,
                actionLabel: 'View Inner Circle',
                icon: '⚠️',
                action: { type: 'plan' }, // Could navigate to Inner Circle view
                dismissible: urgency !== 'critical',
                createdAt: new Date(),
                type: 'reconnect',
            };

        case 'tier-neglect':
            return {
                id: `${baseId}-${imbalance.affectedTier}`,
                friendId: '',
                friendName: '',
                urgency: imbalance.severity === 'high' ? 'high' : 'medium',
                category: 'portfolio',
                title: imbalance.title,
                subtitle: imbalance.recommendedAction,
                actionLabel: `View ${imbalance.affectedTier}`,
                icon: '📊',
                action: { type: 'plan' },
                dismissible: true,
                createdAt: new Date(),
                type: 'connect',
            };

        case 'overcommitment':
            return {
                id: baseId,
                friendId: '',
                friendName: '',
                urgency: 'medium',
                category: 'portfolio',
                title: imbalance.title,
                subtitle: imbalance.recommendedAction,
                actionLabel: 'Review Network',
                icon: '🧘',
                action: { type: 'plan' },
                dismissible: true,
                createdAt: new Date(),
                type: 'connect',
            };

        case 'monotony':
            return {
                id: baseId,
                friendId: '',
                friendName: '',
                urgency: 'low',
                category: 'portfolio',
                title: imbalance.title,
                subtitle: imbalance.recommendedAction,
                actionLabel: 'Explore Ideas',
                icon: '🎨',
                action: { type: 'plan' },
                dismissible: true,
                createdAt: new Date(),
                type: 'deepen',
            };

        case 'lack-diversity':
            return {
                id: baseId,
                friendId: '',
                friendName: '',
                urgency: 'low',
                category: 'portfolio',
                title: imbalance.title,
                subtitle: imbalance.recommendedAction,
                actionLabel: 'Try Something New',
                icon: '🌈',
                action: { type: 'plan' },
                dismissible: true,
                createdAt: new Date(),
                type: 'deepen',
            };

        default:
            return null;
    }
}
