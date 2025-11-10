import { create } from 'zustand';
import { database } from '../db';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { type Archetype, type Tier, type Status, type FriendFormData } from '../components/types';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Q } from '@nozbe/watermelondb';
import { tierMap } from '../lib/constants';
import { appStateManager } from '../lib/app-state-manager';

interface FriendStore {
  friends: FriendModel[];
  activeFriend: FriendModel | null;
  activeFriendInteractions: InteractionModel[];
  friendsSubscription: Subscription | null;
  friendSubscription: Subscription | null;
  interactionSubscription: Subscription | null;
  appStateSubscription: (() => void) | null;
  isSleeping: boolean;
  pendingFriendId: string | null; // Track friend to observe when app wakes
  observeFriends: () => void;
  unobserveFriends: () => void;
  observeFriend: (friendId: string) => void;
  unobserveFriend: () => void;
  pauseObservers: () => void;
  resumeObservers: () => void;
  initializeAppStateListener: () => void;
  cleanupAppStateListener: () => void;
  addFriend: (data: FriendFormData) => Promise<void>;
  batchAddFriends: (contacts: Array<{ name: string; photoUrl?: string }>, tier: Tier) => Promise<void>;
  updateFriend: (id: string, data: FriendFormData) => Promise<void>;
  deleteFriend: (id: string) => Promise<void>;
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  activeFriend: null,
  activeFriendInteractions: [],
  friendsSubscription: null,
  friendSubscription: null,
  interactionSubscription: null,
  appStateSubscription: null,
  isSleeping: false,
  pendingFriendId: null,

  observeFriends: () => {
    const currentSubscription = get().friendsSubscription;
    if (currentSubscription) return;

    const newSubscription = database.get<FriendModel>('friends').query().observe().subscribe(friends => {
      const currentFriends = get().friends;

      // Only update if the friend IDs or count has actually changed
      // This prevents unnecessary re-renders when WatermelonDB emits same data
      const currentIds = currentFriends.map(f => f.id).sort().join(',');
      const newIds = friends.map(f => f.id).sort().join(',');

      if (currentIds !== newIds) {
        set({ friends });
      } else {
        // IDs are the same, but properties might have changed
        // Update the array reference only if we detect actual changes
        const hasChanges = friends.some((newFriend, idx) => {
          const oldFriend = currentFriends.find(f => f.id === newFriend.id);
          return !oldFriend ||
                 oldFriend.name !== newFriend.name ||
                 oldFriend.weaveScore !== newFriend.weaveScore ||
                 oldFriend.dunbarTier !== newFriend.dunbarTier ||
                 oldFriend.archetype !== newFriend.archetype ||
                 oldFriend.isDormant !== newFriend.isDormant;
        });

        if (hasChanges) {
          set({ friends });
        }
      }
    });

    set({ friendsSubscription: newSubscription });
  },

  unobserveFriends: () => {
    const currentSubscription = get().friendsSubscription;
    if (currentSubscription) {
      currentSubscription.unsubscribe();
      set({ friendsSubscription: null });
    }
  },

  observeFriend: (friendId: string) => {
    get().unobserveFriend(); // Unsubscribe from previous friend

    const friendSub = database.get<FriendModel>('friends').findAndObserve(friendId).subscribe(friend => {
      set({ activeFriend: friend });

      if (friend) {
        // Manually and correctly fetch interactions for the friend
        const interactionFriendsSub = database.get<InteractionFriend>('interaction_friends')
          .query(Q.where('friend_id', friend.id))
          .observe();
        
        const interactionSub = interactionFriendsSub.pipe(
          switchMap(interactionFriends => {
            const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);
            if (interactionIds.length === 0) {
              return of([]); // Return an empty observable if no interactions
            }
            return database.get<InteractionModel>('interactions').query(
              Q.where('id', Q.oneOf(interactionIds))
            ).observe();
          })
        ).subscribe(interactions => {
          set({ activeFriendInteractions: interactions });
        });

        set({ interactionSubscription: interactionSub });
      } else {
        // If friend is not found or null, clear interactions
        set({ activeFriendInteractions: [], interactionSubscription: null });
      }
    });

    set({ friendSubscription: friendSub });
  },

  unobserveFriend: () => {
    const { friendSubscription, interactionSubscription } = get();
    if (friendSubscription) {
      friendSubscription.unsubscribe();
    }
    if (interactionSubscription) {
      interactionSubscription.unsubscribe();
    }
    set({ friendSubscription: null, interactionSubscription: null, activeFriend: null, activeFriendInteractions: [] });
  },

  addFriend: async (data: FriendFormData) => {
    console.log('[addFriend] Attempting to add friend with data:', data);
    try {
      await database.write(async () => {
          const newFriend = await database.get('friends').create(friend => {
              console.log('[addFriend] Inside create block');
              friend.name = data.name;
              friend.dunbarTier = tierMap[data.tier] || 'Community';
              friend.archetype = data.archetype;
              friend.photoUrl = data.photoUrl;
              friend.notes = data.notes;
              friend.weaveScore = 50; // Start with a neutral score
              friend.lastUpdated = new Date();

              // Life events and relationship context
              friend.birthday = data.birthday || null;
              friend.anniversary = data.anniversary || null;
              friend.relationshipType = data.relationshipType || null;

              // Initialize intelligence engine fields
              friend.resilience = 1.0;
              friend.ratedWeavesCount = 0;
              friend.momentumScore = 0;
              friend.momentumLastUpdated = new Date();
              friend.isDormant = false;
              friend.dormantSince = null;
          });

          const allFriends = await database.get<FriendModel>('friends').query().fetch();
          const archetypes = new Set(allFriends.map(f => f.archetype));

          const userProgress = await database.get('user_progress').query().fetch();
          const progress = userProgress[0];
          await progress.update(p => {
            p.curatorProgress = archetypes.size;
          });
      });
      console.log('[addFriend] SUCCESS: Friend should be created.');
    } catch (error) {
      console.error('[addFriend] ERROR: Failed to create friend.', error);
    }
  },

  batchAddFriends: async (contacts: Array<{ name: string; photoUrl?: string }>, tier: Tier) => {
    console.log('[batchAddFriends] Attempting to batch add friends:', contacts.length);
    try {
      await database.write(async () => {
        // Create all friends in a single transaction
        for (const contact of contacts) {
          await database.get('friends').create(friend => {
            friend.name = contact.name;
            friend.dunbarTier = tier;
            friend.archetype = 'Unknown'; // Use Unknown archetype for batch adds
            friend.photoUrl = contact.photoUrl || '';
            friend.notes = '';
            friend.weaveScore = 50; // Start with a neutral score
            friend.lastUpdated = new Date();

            // Initialize with no life events
            friend.birthday = null;
            friend.anniversary = null;
            friend.relationshipType = null;

            // Initialize intelligence engine fields
            friend.resilience = 1.0;
            friend.ratedWeavesCount = 0;
            friend.momentumScore = 0;
            friend.momentumLastUpdated = new Date();
            friend.isDormant = false;
            friend.dormantSince = null;
          });
        }

        // Update curator progress (Unknown archetype doesn't count toward unique archetypes)
        const allFriends = await database.get<FriendModel>('friends').query().fetch();
        const archetypes = new Set(allFriends.filter(f => f.archetype !== 'Unknown').map(f => f.archetype));

        const userProgress = await database.get('user_progress').query().fetch();
        const progress = userProgress[0];
        await progress.update(p => {
          p.curatorProgress = archetypes.size;
        });
      });
      console.log('[batchAddFriends] SUCCESS: Created', contacts.length, 'friends.');
    } catch (error) {
      console.error('[batchAddFriends] ERROR: Failed to create friends.', error);
    }
  },

  updateFriend: async (id: string, data: FriendFormData) => {
    await database.write(async () => {
        const friend = await database.get<FriendModel>('friends').find(id);
        await friend.update(record => {
            record.name = data.name;
            record.dunbarTier = tierMap[data.tier] || 'Community';
            record.archetype = data.archetype;
            record.photoUrl = data.photoUrl;
            record.notes = data.notes;

            // Life events and relationship context
            record.birthday = data.birthday || null;
            record.anniversary = data.anniversary || null;
            record.relationshipType = data.relationshipType || null;
        });
    });
  },
  
  deleteFriend: async (id: string) => {
    await database.write(async () => {
        const friend = await database.get<FriendModel>('friends').find(id);
        await friend.destroyPermanently();
    });
  },

  pauseObservers: () => {
    console.log('[FriendStore] Pausing observers (app sleeping)');
    const { friendsSubscription, friendSubscription, interactionSubscription, pendingFriendId } = get();

    // Store the current friend ID so we can resume later
    const currentFriendId = get().activeFriend?.id || pendingFriendId;

    // Unsubscribe from all observers
    if (friendsSubscription) {
      friendsSubscription.unsubscribe();
    }
    if (friendSubscription) {
      friendSubscription.unsubscribe();
    }
    if (interactionSubscription) {
      interactionSubscription.unsubscribe();
    }

    set({
      friendsSubscription: null,
      friendSubscription: null,
      interactionSubscription: null,
      pendingFriendId: currentFriendId,
      isSleeping: true,
    });
  },

  resumeObservers: () => {
    console.log('[FriendStore] Resuming observers (app awake)');
    const { pendingFriendId } = get();

    set({ isSleeping: false });

    // Resume friends list observer
    get().observeFriends();

    // Resume friend detail observer if there was one active
    if (pendingFriendId) {
      get().observeFriend(pendingFriendId);
      set({ pendingFriendId: null });
    }
  },

  initializeAppStateListener: () => {
    const currentSubscription = get().appStateSubscription;
    if (currentSubscription) {
      console.log('[FriendStore] App state listener already initialized');
      return;
    }

    console.log('[FriendStore] Initializing app state listener');

    // Subscribe to app state changes (both app state and idle state)
    const handleSleepStateChange = () => {
      const shouldSleep = appStateManager.shouldSleep();
      const { isSleeping } = get();

      if (shouldSleep && !isSleeping) {
        // App is now sleeping (backgrounded or idle)
        get().pauseObservers();
      } else if (!shouldSleep && isSleeping) {
        // App is now awake
        get().resumeObservers();
      }
    };

    // Subscribe to both state changes
    const appStateUnsub = appStateManager.subscribe(() => {
      handleSleepStateChange();
    });

    const idleStateUnsub = appStateManager.subscribeToIdle(() => {
      handleSleepStateChange();
    });

    // Combine unsubscribe functions
    const combinedUnsub = () => {
      appStateUnsub();
      idleStateUnsub();
    };

    set({ appStateSubscription: combinedUnsub });
  },

  cleanupAppStateListener: () => {
    const { appStateSubscription } = get();
    if (appStateSubscription) {
      console.log('[FriendStore] Cleaning up app state listener');
      appStateSubscription();
      set({ appStateSubscription: null });
    }
  },
}));