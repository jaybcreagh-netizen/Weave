import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/shared/services/logger.service';
import { useInteractions, usePlans } from '@/modules/interactions';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import IntentionModel from '@/db/models/Intention';
import { LifeEventRepository } from '@/modules/relationships/repositories/life-event.repository';
import LifeEventModel from '@/db/models/LifeEvent';
import { Friend, Interaction, LifeEvent, Intention } from '@/shared/types/legacy-types';
import { FriendShape, InteractionShape } from '@/shared/types/derived';
import { switchMap } from 'rxjs/operators';
import { of, combineLatest } from 'rxjs';
import IntentionFriend from '@/db/models/IntentionFriend';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import { useRouter } from 'expo-router';
import { useInteractionShareStatus, type ShareInfoMap } from '@/modules/sync';

export function useFriendProfileData(friendId: string | undefined) {
    const router = useRouter();
    const { deleteWeave, updateReflection, updateInteraction } = useInteractions();
    const { createIntention, dismissIntention } = usePlans();

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [activeLifeEvents, setActiveLifeEvents] = useState<LifeEvent[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [interactionsLimit, setInteractionsLimit] = useState(20);
    const [version, setVersion] = useState(0);
    const [error, setError] = useState<Error | null>(null); // Added error state

    const [friendModel, setFriendModel] = useState<FriendModel | null>(null);
    const [interactionsModels, setInteractionsModels] = useState<InteractionModel[]>([]);
    const [friendIntentionsModels, setFriendIntentionsModels] = useState<IntentionModel[]>([]);
    const [hasMoreInteractions, setHasMoreInteractions] = useState(false);

    // Observe Friend
    useEffect(() => {
        if (!friendId || typeof friendId !== 'string') {
            setFriendModel(null);
            return;
        }

        const subscription = database.get<FriendModel>('friends')
            .findAndObserve(friendId)
            .subscribe({
                next: (friend) => {
                    setFriendModel(friend);
                    setVersion(v => v + 1);
                    setIsDataLoaded(true);
                },
                error: (error) => {
                    // If friend is deleted or not found
                    if (error.name === 'NotFoundError') {
                        logger.warn('FriendProfileData', `Friend with ID ${friendId} not found`);
                    } else {
                        logger.error('FriendProfileData', 'Error observing friend:', error);
                    }
                    setFriendModel(null);
                }
            });

        return () => subscription.unsubscribe();
    }, [friendId]);

    // Observe Interactions
    useEffect(() => {
        if (!friendId || typeof friendId !== 'string') return;

        // Manual many-to-many query to avoid Q.on issues with WatermelonDB
        // Step 1: Observe the join table for this friend
        const subscription = database.get('interaction_friends')
            .query(Q.where('friend_id', friendId))
            .observe()
            .pipe(
                switchMap(interactionFriends => {
                    // Step 2: Extract IDs
                    // @ts-ignore - raw access if needed, but the model should have interactionId
                    const interactionIds = interactionFriends.map(join => join.interactionId);

                    if (interactionIds.length === 0) {
                        return of([]);
                    }

                    // Step 3: Query the actual interactions with those IDs
                    return database.get<InteractionModel>('interactions')
                        .query(
                            Q.where('id', Q.oneOf(interactionIds)),
                            Q.sortBy('interaction_date', Q.desc),
                            Q.take(interactionsLimit)
                        )
                        .observe();
                }),
                switchMap(interactions => {
                    if (interactions.length === 0) {
                        return of([]);
                    }
                    // Observe each interaction model for changes individually
                    return combineLatest(interactions.map(i => i.observe()));
                })
            )
            .subscribe({
                next: (interactions) => {
                    setInteractionsModels(interactions);
                    setHasMoreInteractions(interactions.length >= interactionsLimit);
                },
                error: (err) => {
                    logger.error('FriendProfileData', 'Error observing interactions:', err);
                    setError(err instanceof Error ? err : new Error('Unknown error observing interactions'));
                }
            });

        return () => subscription.unsubscribe();
    }, [friendId, interactionsLimit]);

    // Observe Intentions
    useEffect(() => {
        if (!friendId || typeof friendId !== 'string') {
            setFriendIntentionsModels([]);
            return;
        }

        // Manual many-to-many query to ensure reactivity
        const subscription = database.get<IntentionFriend>('intention_friends')
            .query(Q.where('friend_id', friendId))
            .observe()
            .pipe(
                switchMap(intentionFriends => {
                    const intentionIds = intentionFriends.map(ifriend => ifriend.intentionId);

                    if (intentionIds.length === 0) {
                        return of([]);
                    }

                    return database.get<IntentionModel>('intentions')
                        .query(
                            Q.where('id', Q.oneOf(intentionIds)),
                            Q.where('status', 'active')
                        )
                        .observe();
                })
            )
            .subscribe(intentions => {
                setFriendIntentionsModels(intentions);
            });

        return () => subscription.unsubscribe();
    }, [friendId]);

    // Map Intention Models to DTOs
    const friendIntentions: Intention[] = useMemo(() => {
        return friendIntentionsModels.map(model => ({
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
    const friend: FriendShape | null = friendModel;

    // Map Interaction Models to DTOs
    const interactions: InteractionShape[] = interactionsModels;

    // Get share status for all interactions
    const interactionIds = useMemo(() => interactionsModels.map(i => i.id), [interactionsModels]);
    const { shareInfoMap, isLoading: isShareInfoLoading } = useInteractionShareStatus(interactionIds);

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
            logger.error('FriendProfileData', 'Error loading life events:', error);
            setError(error instanceof Error ? error : new Error('Unknown error loading life events'));
        }
    }, []);

    useEffect(() => {
        if (friendId && typeof friendId === 'string') {
            loadLifeEvents(friendId);
        }
    }, [friendId, loadLifeEvents]);


    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || !hasMoreInteractions) return;
        setIsLoadingMore(true);
        // Just increase the limit to fetch more
        setInteractionsLimit(prev => prev + 20);
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMoreInteractions]);

    const deleteFriend = useCallback(async (id: string) => {
        try {
            if (friendModel && friendModel.id === id) {
                await database.write(async () => {
                    await friendModel.destroyPermanently();
                });
                // Navigation back is handled by the caller or simple reactivity will show "Friend deleted"
            }
        } catch (err) {
            logger.error('FriendProfileData', 'Error deleting friend:', err);
            setError(err instanceof Error ? err : new Error('Unknown error deleting friend'));
            throw err;
        }
    }, [friendModel]);


    return {
        friend,
        friendModel, // Expose the raw model for reactive components
        interactions,
        interactionsModels, // Expose models for modals that need them
        shareInfoMap, // Map of interactionId -> ShareInfo for timeline styling
        isShareInfoLoading,
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
