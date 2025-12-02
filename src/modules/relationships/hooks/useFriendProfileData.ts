import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRelationshipsStore } from '@/modules/relationships';
import { useInteractions, usePlans } from '@/modules/interactions';
import { LifeEventRepository } from '@/repositories/LifeEventRepository';
import LifeEventModel from '@/db/models/LifeEvent';
import { Friend, Interaction, LifeEvent, Intention } from '@/components/types';

export function useFriendProfileData(friendId: string | undefined) {
    const {
        activeFriend: friendModel,
        activeFriendInteractions: interactionsModels,
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

    const friendIntentionsModels = getFriendIntentions(typeof friendId === 'string' ? friendId : '');

    // Map Intention Models to DTOs
    const friendIntentions: Intention[] = useMemo(() => {
        return (friendIntentionsModels || []).map(model => ({
            id: model.id,
            description: model.description,
            interactionCategory: model.interactionCategory,
            status: model.status,
            createdAt: model.createdAt,
            updatedAt: model.updatedAt,
            lastRemindedAt: model.lastRemindedAt,
            linkedInteractionId: model.linkedInteractionId,
            fulfilledAt: model.fulfilledAt,
            daysToFulfillment: model.daysToFulfillment,
            friendIds: [friendId || ''], // Default to current friend
        }));
    }, [friendIntentionsModels, friendId]);

    // Map Friend Model to DTO
    const friend: Friend | null = useMemo(() => {
        if (!friendModel) return null;
        return {
            id: friendModel.id,
            name: friendModel.name,
            createdAt: friendModel.createdAt,
            dunbarTier: friendModel.dunbarTier as any, // Cast to Tier
            archetype: friendModel.archetype as any, // Cast to Archetype
            weaveScore: friendModel.weaveScore,
            lastUpdated: friendModel.lastUpdated,
            photoUrl: friendModel.photoUrl,
            notes: friendModel.notes,
            isDormant: friendModel.isDormant,
            birthday: friendModel.birthday,
            anniversary: friendModel.anniversary,
            relationshipType: friendModel.relationshipType as any,
            toleranceWindowDays: friendModel.toleranceWindowDays,
            resilience: friendModel.resilience,
            typicalIntervalDays: friendModel.typicalIntervalDays,
        };
    }, [friendModel]);

    // Map Interaction Models to DTOs
    const interactions: Interaction[] = useMemo(() => {
        return (interactionsModels || []).map(model => ({
            id: model.id,
            friendIds: [friendId || ''], // Default to current friend
            createdAt: model.createdAt,
            interactionDate: model.interactionDate,
            category: model.interactionCategory as any,
            interactionType: model.interactionType as any,
            duration: model.duration as any,
            vibe: model.vibe as any,
            note: model.note || null,
            source: undefined, // Not on model
            photos: undefined, // Not on model
            reflection: model.reflection,
            activity: model.activity,
            status: model.status,
            mode: model.mode,
            title: model.title,
            location: model.location,
            eventImportance: model.eventImportance,
            initiator: model.initiator,
            updatedAt: model.updatedAt,
            interactionCategory: model.interactionCategory as any,
        }));
    }, [interactionsModels, friendId]);

    const loadLifeEvents = useCallback(async (id: string) => {
        try {
            const events = await LifeEventRepository.getActiveEventsForFriend(id);
            // Map LifeEvent Models to DTOs
            const eventDTOs: LifeEvent[] = events.map(event => ({
                id: event.id,
                friendId: event.friendId,
                title: event.title,
                date: event.eventDate,
                eventType: event.eventType,
                description: event.notes, // Map notes to description
                importance: event.importance,
                isRecurring: event.isRecurring,
                source: event.source,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
            }));
            setActiveLifeEvents(eventDTOs);
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
        if (friendModel && friendModel.id === friendId && interactionsModels !== undefined) {
            const timer = setTimeout(() => {
                setIsDataLoaded(true);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [friendModel, interactionsModels, friendId]);

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
        refreshLifeEvents: async () => {
            if (friendId && typeof friendId === 'string') {
                await loadLifeEvents(friendId);
            }
        }
    };
}
