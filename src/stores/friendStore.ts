import { create } from 'zustand';
import { database } from '../db';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import { type Archetype, type Tier, type Status } from '../components/types';
import { Subscription } from 'rxjs';
import { Q } from '@nozbe/watermelondb';

export interface FriendFormData {
  name: string;
  tier: string;
  archetype: Archetype;
  notes?: string;
  photoUrl?: string;
}

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

const tierMap: Record<string, Tier> = {
  inner: "InnerCircle",
  close: "CloseFriends",
  community: "Community",
};

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
    });

    const interactionSub = database.get<InteractionModel>('interactions').query(Q.where('friend_ids', friendId)).observe().subscribe(interactions => {
        set({ activeFriendInteractions: interactions });
    });

    set({ friendSubscription: friendSub, interactionSubscription: interactionSub });
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
            friend.status = 'Green';
            friend.statusText = 'Just added to your network';
            friend.archetype = data.archetype;
            friend.tier = tierMap[data.tier] || 'Community';
            friend.photoUrl = data.photoUrl;
            friend.notes = data.notes;
        });
    });
  },
  
  updateFriend: async (id: string, data: FriendFormData) => {
    await database.write(async () => {
        const friend = await database.get<FriendModel>('friends').find(id);
        await friend.update(record => {
            record.name = data.name;
            record.archetype = data.archetype;
            record.tier = tierMap[data.tier] || 'Community';
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