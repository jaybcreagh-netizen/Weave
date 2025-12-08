import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import LifeEvent from '@/db/models/LifeEvent';
import Group from '@/db/models/Group';
import GroupMember from '@/db/models/GroupMember';
import { Archetype, Tier } from '@/components/types';
import { Q } from '@nozbe/watermelondb';

const ARCHETYPES: Archetype[] = [
  'Emperor',
  'Empress',
  'HighPriestess',
  'Fool',
  'Sun',
  'Hermit',
  'Magician',
];

const TIERS: Tier[] = ['InnerCircle', 'CloseFriends', 'Community'];

const ACTIVITY_TYPES = [
  'Call',
  'Text',
  'Chat',
  'Video Call',
  'Dinner',
  'Lunch',
  'Coffee',
  'Walk',
  'Event',
  'Party',
  'Game Night',
  'Movie',
  'Concert',
  'Adventure',
  'Tea Time',
];

const DURATIONS = ['Quick', 'Standard', 'Extended'];
const VIBES = ['NewMoon', 'WaxingCrescent', 'FirstQuarter', 'WaxingGibbous', 'FullMoon', 'WaningGibbous', 'LastQuarter', 'WaningCrescent'];
const MODES = ['solo', 'group'];

const REAL_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Isabella", "Elijah", "Sophia", "James",
  "Charlotte", "William", "Amelia", "Benjamin", "Mia", "Lucas", "Harper", "Henry", "Evelyn", "Theodore",
  "Alice", "Bob", "Charlie", "David", "Eva", "Frank", "Grace", "Hannah", "Ivy", "Jack",
  "Kara", "Leo", "Mona", "Nina", "Oscar", "Paul", "Quinn", "Rose", "Sam", "Tara",
  "Uma", "Victor", "Wendy", "Xander", "Yara", "Zane", "Arthur", "Beatrice", "Caleb", "Diana",
  "Edward", "Fiona", "George", "Hazel", "Isaac", "Julia", "Kevin", "Luna", "Max", "Nora",
  "Owen", "Penelope", "Quentin", "Rachel", "Simon", "Tessa", "Ulysses", "Violet", "Walter", "Xena",
  "Yusuf", "Zara", "Adam", "Bella", "Connor", "Daisy", "Ethan", "Flora", "Gavin", "Holly",
  "Ian", "Jenny", "Kyle", "Lily", "Mason", "Natalie", "Peter", "Queen", "Ryan", "Sarah",
  "Thomas", "Ursula", "Vincent", "Willow", "Xavier", "Yasmine", "Zachary", "Abigail", "Brian", "Chloe"
];

const GROUP_NAMES = ["College Friends", "Work Colleagues", "Family", "Book Club", "Gym Buddies", "High School Crew"];

/**
 * Generate stress test seed data for testing app performance
 */
export async function generateStressTestData(
  friendsCount: number = 100, // This parameter is kept for signature compatibility but we'll use REAL_NAMES.length
  interactionsPerFriend: number = 10
): Promise<void> {
  const count = Math.min(friendsCount, REAL_NAMES.length);
  console.log(`[StressTest] Generating ${count} friends with ${interactionsPerFriend} interactions each...`);

  try {
    await database.write(async () => {
      const friends: FriendModel[] = [];
      const createdGroups: Group[] = [];

      // Create Groups
      for (const groupName of GROUP_NAMES) {
        const group = await database.get<Group>('groups').create((g) => {
          g.name = groupName;
          g.type = 'manual';
        });
        createdGroups.push(group);
      }

      // Create friends
      for (let i = 0; i < count; i++) {
        // Distribute tiers: 5 Inner Circle, 15 Close Friends, Rest Community
        let tier: Tier = 'Community';
        if (i < 5) tier = 'InnerCircle';
        else if (i < 20) tier = 'CloseFriends';

        const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
        const weaveScore = Math.floor(Math.random() * 100);

        const friend = await database.get<FriendModel>('friends').create((f) => {
          f.name = REAL_NAMES[i];
          f.dunbarTier = tier;
          f.archetype = archetype;
          f.photoUrl = ''; // Could add placeholder URLs if needed
          f.notes = `Generated friend from stress test. Tier: ${tier}, Archetype: ${archetype}.`;
          f.weaveScore = weaveScore;
          f.lastUpdated = new Date();
          f.resilience = 0.8 + (Math.random() * 0.7); // 0.8 to 1.5
          f.ratedWeavesCount = Math.floor(Math.random() * 50);
          f.momentumScore = Math.random() > 0.6 ? Math.floor(Math.random() * 30) : 0;
          f.momentumLastUpdated = new Date();
          f.isDormant = Math.random() > 0.9;
          f.dormantSince = f.isDormant ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) : undefined;

          // Random birthday
          const month = Math.floor(Math.random() * 12) + 1; // 1-12
          const day = Math.floor(Math.random() * 28) + 1; // 1-28 safe
          const monthStr = month.toString().padStart(2, '0');
          const dayStr = day.toString().padStart(2, '0');
          f.birthday = `${monthStr}-${dayStr}`;

          f.anniversary = Math.random() > 0.8 ? `${monthStr}-${dayStr}` : undefined;
          f.relationshipType = undefined;
        });

        friends.push(friend);

        // Add to a random group (50% chance)
        if (Math.random() > 0.5) {
          const randomGroup = createdGroups[Math.floor(Math.random() * createdGroups.length)];
          await database.get<GroupMember>('group_members').create((gm) => {
            gm.groupId = randomGroup.id;
            gm.friendId = friend.id;
          });
        }

        // Create Life Events
        if (Math.random() > 0.3) {
          await database.get<LifeEvent>('life_events').create((le) => {
            le.friendId = friend.id;
            le.eventType = 'other';
            le.title = 'Met at coffee shop';
            le.eventDate = new Date(Date.now() - Math.floor(Math.random() * 365 * 2) * 24 * 60 * 60 * 1000);
            le.importance = 'medium';
            le.source = 'manual';
            le.isRecurring = false;
            le.reminded = false;
          });
        }
      }

      console.log(`[StressTest] Created ${friends.length} friends`);

      // Create interactions and journal entries
      let totalInteractions = 0;
      for (const friend of friends) {
        for (let j = 0; j < interactionsPerFriend; j++) {
          const activity = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
          const duration = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
          const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
          const mode = MODES[Math.floor(Math.random() * MODES.length)];
          const status = Math.random() > 0.1 ? 'completed' : 'planned'; // Mostly completed

          // Random date within the last year
          const randomDaysAgo = Math.floor(Math.random() * 365);
          const interactionDate = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000);

          const interaction = await database.get<InteractionModel>('interactions').create((i) => {
            i.interactionDate = interactionDate;
            i.interactionType = status === 'completed' ? 'log' : 'plan';
            i.activity = activity;
            i.status = status;
            i.mode = mode;
            i.note = `Interaction ${j + 1} with ${friend.name}. It was ${vibe}.`;
            i.vibe = vibe;
            i.duration = duration;
            i.title = `${activity} with ${friend.name}`;
            i.location = Math.random() > 0.5 ? 'Local Cafe' : 'Park';
            i.eventImportance = undefined;
            i.initiator = Math.random() > 0.5 ? 'me' : 'them';
          });

          // Create join table entry
          await database.get<InteractionFriend>('interaction_friends').create((ifriend) => {
            ifriend.interactionId = interaction.id;
            ifriend.friendId = friend.id;
          });

          // 20% chance to create a journal entry for this interaction
          if (Math.random() < 0.2) {
            const entry = await database.get<JournalEntry>('journal_entries').create((je) => {
              je.entryDate = interactionDate.getTime();
              je.title = `Reflecting on ${activity}`;
              je.content = `Had a great time with ${friend.name} doing ${activity}. We talked about life and the future.`;
              je.isDraft = false;
              je.storyChipsRaw = JSON.stringify([{ chipId: 'joy', customText: 'Fun' }, { chipId: 'connection', customText: 'Deep' }]);
            });

            await database.get<JournalEntryFriend>('journal_entry_friends').create((jef) => {
              jef.journalEntryId = entry.id;
              jef.friendId = friend.id;
            });
          }

          totalInteractions++;
        }
      }

      console.log(`[StressTest] Created ${totalInteractions} interactions`);
    });

    console.log(`[StressTest] Stress test data generation complete!`);
  } catch (error) {
    console.error('[StressTest] Failed to generate stress test data:', error);
    throw error;
  }
}

/**
 * Clear all stress test data (useful for cleanup)
 */
export async function clearStressTestData(): Promise<void> {
  console.log('[StressTest] Clearing stress test data...');

  try {
    await database.write(async () => {
      // 1. Find all friends created by stress test
      const allFriends = await database.get<FriendModel>('friends').query().fetch();
      const stressTestFriends = allFriends.filter(f => f.notes && f.notes.includes('Generated friend from stress test'));

      console.log(`[StressTest] Found ${stressTestFriends.length} stress test friends to delete.`);

      const friendIds = stressTestFriends.map(f => f.id);

      // Delete Friends and related data
      for (const friend of stressTestFriends) {
        // Delete Interaction Links
        const interactionFriends = await database.get<InteractionFriend>('interaction_friends').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const if_ of interactionFriends) {
          await if_.destroyPermanently();
        }

        // Delete Group Memberships
        const groupMembers = await database.get<GroupMember>('group_members').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const gm of groupMembers) {
          await gm.destroyPermanently();
        }

        // Delete Journal Entry Links
        const journalEntryFriends = await database.get<JournalEntryFriend>('journal_entry_friends').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const jef of journalEntryFriends) {
          await jef.destroyPermanently();
        }

        // Delete Life Events
        const lifeEvents = await database.get<LifeEvent>('life_events').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const le of lifeEvents) {
          await le.destroyPermanently();
        }

        // Delete Suggestion Events
        const suggestionEvents = await database.get('suggestion_events').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const se of suggestionEvents) {
          await se.destroyPermanently();
        }

        // Delete Intention Friends
        const intentionFriends = await database.get('intention_friends').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const if_ of intentionFriends) {
          await if_.destroyPermanently();
        }

        // Delete Friend Badges
        const friendBadges = await database.get('friend_badges').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const fb of friendBadges) {
          await fb.destroyPermanently();
        }

        // Delete Achievement Unlocks (related to friend)
        const achievementUnlocks = await database.get('achievement_unlocks').query(
          Q.where('related_friend_id', friend.id)
        ).fetch();
        for (const au of achievementUnlocks) {
          await au.destroyPermanently();
        }

        // Delete Chip Usage (related to friend)
        const chipUsage = await database.get('chip_usage').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const cu of chipUsage) {
          await cu.destroyPermanently();
        }

        // Delete Interaction Outcomes
        const interactionOutcomes = await database.get('interaction_outcomes').query(
          Q.where('friend_id', friend.id)
        ).fetch();
        for (const io of interactionOutcomes) {
          await io.destroyPermanently();
        }

        await friend.destroyPermanently();
      }

      // Cleanup orphaned interactions
      const allInteractions = await database.get<InteractionModel>('interactions').query().fetch();
      const allInteractionFriends = await database.get<InteractionFriend>('interaction_friends').query().fetch();
      const linkedInteractionIds = new Set(allInteractionFriends.map(if_ => if_.interactionId));

      let deletedInteractions = 0;
      for (const interaction of allInteractions) {
        if (!linkedInteractionIds.has(interaction.id)) {
          // Also delete chip usage for this interaction
          const interactionChipUsage = await database.get('chip_usage').query(
            Q.where('interaction_id', interaction.id)
          ).fetch();
          for (const cu of interactionChipUsage) {
            await cu.destroyPermanently();
          }

          // Also delete interaction outcomes for this interaction
          const interactionOutcomes = await database.get('interaction_outcomes').query(
            Q.where('interaction_id', interaction.id)
          ).fetch();
          for (const io of interactionOutcomes) {
            await io.destroyPermanently();
          }

          await interaction.destroyPermanently();
          deletedInteractions++;
        }
      }
      console.log(`[StressTest] Deleted ${deletedInteractions} orphaned interactions.`);

      // Cleanup orphaned Journal Entries
      const allJournalEntries = await database.get<JournalEntry>('journal_entries').query().fetch();
      const allJournalEntryFriends = await database.get<JournalEntryFriend>('journal_entry_friends').query().fetch();
      const linkedJournalEntryIds = new Set(allJournalEntryFriends.map(jef => jef.journalEntryId));

      let deletedJournalEntries = 0;
      for (const entry of allJournalEntries) {
        if (!linkedJournalEntryIds.has(entry.id)) {
          await entry.destroyPermanently();
          deletedJournalEntries++;
        }
      }
      console.log(`[StressTest] Deleted ${deletedJournalEntries} orphaned journal entries.`);

      // Cleanup Groups created by stress test
      const groups = await database.get<Group>('groups').query(
        Q.where('name', Q.oneOf(GROUP_NAMES))
      ).fetch();

      for (const group of groups) {
        // Only delete if empty
        const members = await database.get<GroupMember>('group_members').query(
          Q.where('group_id', group.id)
        ).fetch();
        if (members.length === 0) {
          await group.destroyPermanently();
        }
      }

    });

    console.log('[StressTest] Stress test data cleared!');
  } catch (error) {
    console.error('[StressTest] Failed to clear stress test data:', error);
    throw error;
  }
}

/**
 * Get stats about current data
 */
export async function getDataStats(): Promise<{
  totalFriends: number;
  totalInteractions: number;
  stressTestFriends: number;
  averageInteractionsPerFriend: number;
  totalJournalEntries: number;
  totalGroups: number;
}> {
  const allFriends = await database.get<FriendModel>('friends').query().fetch();
  const allInteractions = await database.get<InteractionModel>('interactions').query().fetch();
  const allJournalEntries = await database.get<JournalEntry>('journal_entries').query().fetch();
  const allGroups = await database.get<Group>('groups').query().fetch();

  const stressTestFriends = allFriends.filter((f) => f.notes && f.notes.includes('Generated friend from stress test'));

  return {
    totalFriends: allFriends.length,
    totalInteractions: allInteractions.length,
    stressTestFriends: stressTestFriends.length,
    averageInteractionsPerFriend:
      allFriends.length > 0 ? allInteractions.length / allFriends.length : 0,
    totalJournalEntries: allJournalEntries.length,
    totalGroups: allGroups.length
  };
}
