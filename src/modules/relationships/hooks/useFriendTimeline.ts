import { useMemo } from 'react';
import { isFuture, isToday } from 'date-fns';
import { type Interaction } from '@/components/types';

export function useFriendTimeline(interactions: Interaction[] | undefined) {
    const sortedInteractions = useMemo(() =>
        [...(interactions || [])].sort((a, b) => {
            const dateA = typeof a.interactionDate === 'string' ? new Date(a.interactionDate) : a.interactionDate;
            const dateB = typeof b.interactionDate === 'string' ? new Date(b.interactionDate) : b.interactionDate;
            return dateB.getTime() - dateA.getTime();
        }), [interactions]);

    const timelineSections = useMemo(() => {
        const sections: { [key: string]: Interaction[] } = {
            Seeds: [], // Future
            Today: [],
            'Woven Memories': [], // Past
        };

        sortedInteractions.forEach(interaction => {
            const date = new Date(interaction.interactionDate);
            if (isFuture(date)) sections.Seeds.push(interaction);
            else if (isToday(date)) sections.Today.push(interaction);
            else sections['Woven Memories'].push(interaction);
        });

        return Object.entries(sections)
            .map(([title, data]) => ({ title, data }))
            .filter(section => section.data.length > 0);

    }, [sortedInteractions]);

    return { timelineSections };
}
