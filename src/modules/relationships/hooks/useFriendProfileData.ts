import { useState, useEffect, useCallback } from 'react';
import { useRelationshipsStore } from '@/modules/relationships';
import { useInteractions, usePlans } from '@/modules/interactions';
import { LifeEventRepository } from '@/repositories/LifeEventRepository';
import LifeEvent from '@/db/models/LifeEvent';

export function useFriendProfileData(friendId: string | undefined) {
    const {
        activeFriend: friend,
        activeFriendInteractions: interactions,
        observeFriend,
        unobserveFriend,
        loadMoreInteractions,
        hasMoreInteractions,
        deleteFriend
    } = useRelationshipsStore();

    const { deleteWeave, updateReflection, updateInteraction } = useInteractions();
    const { createIntention, dismissIntention, getFriendIntentions } = usePlans();

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [activeLifeEvents, setActiveLifeEvents] = useState<LifeEvent[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const friendIntentions = getFriendIntentions(typeof friendId === 'string' ? friendId : '');

    const loadLifeEvents = useCallback(async (id: string) => {
        try {
            const events = await LifeEventRepository.getActiveEventsForFriend(id);
            setActiveLifeEvents(events);
        } catch (error) {
            console.error('Error loading life events:', error);
        }
    }, []);

    useEffect(() => {
        if (friendId && typeof friendId === 'string') {
            setIsDataLoaded(false);
            observeFriend(friendId);
            loadLifeEvents(friendId);
        }
        return () => {
            unobserveFriend();
        };
    }, [friendId, observeFriend, unobserveFriend, loadLifeEvents]);

    useEffect(() => {
        if (friend && friend.id === friendId && interactions !== undefined) {
            const timer = setTimeout(() => {
                setIsDataLoaded(true);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [friend, interactions, friendId]);

    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || !hasMoreInteractions) return;
        setIsLoadingMore(true);
        try {
            await loadMoreInteractions();
        } catch (error) {
            console.error('Error loading more interactions:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMoreInteractions, loadMoreInteractions]);

    return {
        friend,
        interactions,
        friendIntentions,
        activeLifeEvents,
        isDataLoaded,
        hasMoreInteractions,
        isLoadingMore,
        handleLoadMore,
        deleteFriend,
        deleteWeave,
        updateReflection,
        updateInteraction,
        createIntention,
        dismissIntention,
        refreshLifeEvents: () => friendId && typeof friendId === 'string' && loadLifeEvents(friendId)
    };
}
