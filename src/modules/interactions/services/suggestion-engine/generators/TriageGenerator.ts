import { Suggestion } from '@/shared/types/common';

/**
 * TriageGenerator
 * Not a standard generator, but a post-processor that handles "Dormant" or "Overwhelmed" states.
 * If too many critical drift suggestions exist, it filters them and adds a system "Triage" suggestion.
 */
export class TriageGenerator {
    static async apply(suggestions: Suggestion[]): Promise<Suggestion[]> {
        const criticalDriftsCount = suggestions.filter(s => s.urgency === 'critical' && (s.category === 'drift' || s.category === 'critical-drift')).length;
        const isOverwhelmed = criticalDriftsCount > 5;

        if (isOverwhelmed) {
            const criticals = suggestions.filter(s => s.urgency === 'critical' && (s.category === 'drift' || s.category === 'critical-drift'));
            const others = suggestions.filter(s => !(s.urgency === 'critical' && (s.category === 'drift' || s.category === 'critical-drift')));

            // Limit criticals to 3 to avoid overwhelming
            const visibleCriticals = criticals.slice(0, 3);

            // Filter out normal drifts from the rest to reduce noise
            const nonDriftOthers = others.filter(s => s.category !== 'drift' && s.category !== 'high-drift' && s.category !== 'community-checkin');

            let finalPool = [...visibleCriticals, ...nonDriftOthers];

            // Add Triage System Suggestion if not present
            if (!finalPool.find(s => s.id === 'dormant-triage-info')) {
                finalPool.unshift({
                    id: 'dormant-triage-info',
                    friendId: 'system',
                    friendName: 'Weave',
                    urgency: 'high',
                    category: 'gentle-nudge',
                    title: 'Welcome back',
                    subtitle: 'Focus on these few connections to get back into the flow.',
                    actionLabel: 'Okay',
                    icon: 'Sun',
                    action: { type: 'connect' },
                    dismissible: true,
                    createdAt: new Date(),
                    type: 'connect'
                });
            }
            return finalPool;
        }

        return suggestions;
    }
}
