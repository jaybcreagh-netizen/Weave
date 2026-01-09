import { useMemo } from 'react';
import { isFuture, isToday } from 'date-fns';
import { InteractionShape } from '@/shared/types/derived';

export function useFriendTimeline(interactions: InteractionShape[] | undefined) {
    const sortedInteractions = useMemo(() =>
        [...(interactions || [])].sort((a, b) => {
            const dateA = new Date(a.interactionDate).getTime();
            const dateB = new Date(b.interactionDate).getTime();
            // Handle invalid dates by pushing them to the end
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;
            return dateB - dateA;
        }), [interactions]);

    const timelineSections = useMemo(() => {
        const sections: { [key: string]: InteractionShape[] } = {
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
