// src/modules/relationships/store.ts
import { create } from 'zustand';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Q } from '@nozbe/watermelondb';
import { appStateManager } from '@/shared/services/app-state-manager.service';
import {
  createFriend,
  updateFriend,
  deleteFriend,
  batchAddFriends,
} from './services/friend.service';
import { FriendFormData, Tier } from './types';

interface RelationshipsStore {
  friends: Friend[];
  activeFriend: Friend | null;
  activeFriendInteractions: Interaction[];
  friendsSubscription: Subscription | null;
  friendSubscription: Subscription | null;
  interactionSubscription: Subscription | null;
  appStateSubscription: (() => void) | null;
  isSleeping: boolean;
  pendingFriendId: string | null;
  interactionsPageSize: number;
  loadedInteractionsCount: number;
  totalInteractionsCount: number;
  hasMoreInteractions: boolean;
  observeFriends: () => void;
  unobserveFriends: () => void;
  observeFriend: (friendId: string, initialPageSize?: number) => void;
  unobserveFriend: () => void;
  loadMoreInteractions: () => Promise<void>;
  pauseObservers: () => void;
  resumeObservers: () => void;
  initializeAppStateListener: () => void;
  cleanupAppStateListener: () => void;
  addFriend: (data: FriendFormData) => Promise<void>;
  batchAddFriends: (contacts: Array<{ name: string; photoUrl?: string }>, tier: Tier) => Promise<void>;
  updateFriend: (id: string, data: FriendFormData) => Promise<void>;
  deleteFriend: (id: string) => Promise<void>;
  batchDeleteFriends: (ids: string[]) => Promise<void>;
}

export const useRelationshipsStore = create<RelationshipsStore>((set, get) => ({
  friends: [],
  activeFriend: null,
  activeFriendInteractions: [],
  friendsSubscription: null,
  friendSubscription: null,
  interactionSubscription: null,
  appStateSubscription: null,
  isSleeping: false,
  pendingFriendId: null,
  interactionsPageSize: 50,
  loadedInteractionsCount: 0,
  totalInteractionsCount: 0,
  hasMoreInteractions: false,

  observeFriends: () => {
    const currentSubscription = get().friendsSubscription;
    if (currentSubscription) return;

    const newSubscription = database.get<Friend>('friends').query().observe().subscribe(friends => {
      set({ friends });
    });

    set({ friendsSubscription: newSubscription });
  },

  unobserveFriends: () => {
    get().friendsSubscription?.unsubscribe();
    set({ friendsSubscription: null });
  },

  observeFriend: (friendId: string, initialPageSize: number = 50) => {
    get().unobserveFriend();

    set({
      interactionsPageSize: initialPageSize,
      loadedInteractionsCount: 0,
      totalInteractionsCount: 0,
      hasMoreInteractions: false,
    });

    const friendSub = database.get<Friend>('friends').findAndObserve(friendId).subscribe(friend => {
      set({ activeFriend: friend });

      if (friend) {
        const interactionFriendsSub = database.get<InteractionFriend>('interaction_friends')
          .query(Q.where('friend_id', friend.id))
          .observe();

        const interactionSub = interactionFriendsSub.pipe(
          switchMap(async (interactionFriends) => {
            const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);
            const totalCount = interactionIds.length;

            if (totalCount === 0) {
              set({
                totalInteractionsCount: 0,
                loadedInteractionsCount: 0,
                hasMoreInteractions: false,
              });
              return of([]);
            }

            const interactions = await database.get<Interaction>('interactions').query(
              Q.where('id', Q.oneOf(interactionIds)),
              Q.sortBy('interaction_date', Q.desc),
              Q.take(initialPageSize)
            ).fetch();

            set({
              totalInteractionsCount: totalCount,
              loadedInteractionsCount: interactions.length,
              hasMoreInteractions: interactions.length < totalCount,
            });

            return of(interactions);
          }),
          switchMap(obs => obs)
        ).subscribe(interactions => {
          set({ activeFriendInteractions: interactions });
        });

        set({ interactionSubscription: interactionSub });
      } else {
        set({
          activeFriendInteractions: [],
          interactionSubscription: null,
          totalInteractionsCount: 0,
          loadedInteractionsCount: 0,
          hasMoreInteractions: false,
        });
      }
    });

    set({ friendSubscription: friendSub });
  },

  unobserveFriend: () => {
    get().friendSubscription?.unsubscribe();
    get().interactionSubscription?.unsubscribe();
    set({
      friendSubscription: null,
      interactionSubscription: null,
      activeFriend: null,
      activeFriendInteractions: [],
      loadedInteractionsCount: 0,
      totalInteractionsCount: 0,
      hasMoreInteractions: false,
    });
  },

  loadMoreInteractions: async () => {
    const {
      activeFriend,
      activeFriendInteractions,
      loadedInteractionsCount,
      hasMoreInteractions,
      interactionsPageSize,
    } = get();

    if (!hasMoreInteractions || !activeFriend) return;

    try {
      const interactionFriends = await database.get<InteractionFriend>('interaction_friends')
        .query(Q.where('friend_id', activeFriend.id))
        .fetch();

      const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);
      if (interactionIds.length === 0) return;

      const nextBatch = await database.get<Interaction>('interactions').query(
        Q.where('id', Q.oneOf(interactionIds)),
        Q.sortBy('interaction_date', Q.desc),
        Q.skip(loadedInteractionsCount),
        Q.take(interactionsPageSize)
      ).fetch();

      const updatedInteractions = [...activeFriendInteractions, ...nextBatch];
      const newLoadedCount = updatedInteractions.length;

      set({
        activeFriendInteractions: updatedInteractions,
        loadedInteractionsCount: newLoadedCount,
        hasMoreInteractions: newLoadedCount < get().totalInteractionsCount,
      });
    } catch (error) {
      console.error('[loadMoreInteractions] Error:', error);
    }
  },

  addFriend: async (data: FriendFormData) => {
    await createFriend(data);
  },

  batchAddFriends: async (contacts: Array<{ name: string; photoUrl?: string }>, tier: Tier) => {
    await batchAddFriends(contacts, tier);
  },

  updateFriend: async (id: string, data: FriendFormData) => {
    await updateFriend(id, data);
  },

  deleteFriend: async (id: string) => {
    await deleteFriend(id);
  },

  batchDeleteFriends: async (ids: string[]) => {
    for (const id of ids) {
      await deleteFriend(id);
    }
  },

  pauseObservers: () => {
    const { friendsSubscription, friendSubscription, interactionSubscription, pendingFriendId } = get();
    const currentFriendId = get().activeFriend?.id || pendingFriendId;

    friendsSubscription?.unsubscribe();
    friendSubscription?.unsubscribe();
    interactionSubscription?.unsubscribe();

    set({
      friendsSubscription: null,
      friendSubscription: null,
      interactionSubscription: null,
      pendingFriendId: currentFriendId,
      isSleeping: true,
    });
  },

  resumeObservers: () => {
    const { pendingFriendId } = get();
    set({ isSleeping: false });
    get().observeFriends();
    if (pendingFriendId) {
      get().observeFriend(pendingFriendId);
      set({ pendingFriendId: null });
    }
  },

  initializeAppStateListener: () => {
    const handleSleepStateChange = () => {
      const shouldSleep = appStateManager.shouldSleep();
      const { isSleeping } = get();
      if (shouldSleep && !isSleeping) {
        get().pauseObservers();
      } else if (!shouldSleep && isSleeping) {
        get().resumeObservers();
      }
    };

    const appStateUnsub = appStateManager.subscribe(handleSleepStateChange);
    const idleStateUnsub = appStateManager.subscribeToIdle(handleSleepStateChange);

    set({ appStateSubscription: () => { appStateUnsub(); idleStateUnsub(); } });
  },

  cleanupAppStateListener: () => {
    get().appStateSubscription?.();
    set({ appStateSubscription: null });
  },
}));
