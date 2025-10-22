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

interface FriendStore {
  friends: FriendModel[];
  activeFriend: FriendModel | null;
  activeFriendInteractions: InteractionModel[];
  friendsSubscription: Subscription | null;
  friendSubscription: Subscription | null;
  interactionSubscription: Subscription | null;
  observeFriends: () => void;
  unobserveFriends: () => void;
  observeFriend: (friendId: string) => void;
  unobserveFriend: () => void;
  addFriend: (data: FriendFormData) => Promise<void>;
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

  observeFriends: () => {
    const currentSubscription = get().friendsSubscription;
    if (currentSubscription) return;

    const newSubscription = database.get<FriendModel>('friends').query().observe().subscribe(friends => {
      set({ friends });
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
    await database.write(async () => {
        await database.get('friends').create(friend => {
            friend.name = data.name;
            friend.dunbarTier = tierMap[data.tier] || 'Community';
            friend.archetype = data.archetype;
            friend.photoUrl = data.photoUrl;
            friend.notes = data.notes;
            friend.weaveScore = 50; // Start with a neutral score
            friend.lastUpdated = new Date();

            // Initialize intelligence engine fields
            friend.resilience = 1.0;
            friend.ratedWeavesCount = 0;
            friend.momentumScore = 0;
            friend.momentumLastUpdated = new Date();
            friend.isDormant = false;
            friend.dormantSince = null;
        });
    });
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
        });
    });
  },
  
  deleteFriend: async (id: string) => {
    await database.write(async () => {
        const friend = await database.get<FriendModel>('friends').find(id);
        await friend.destroyPermanently();
    });
  },
}));