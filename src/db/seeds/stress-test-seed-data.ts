import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Archetype, Tier } from '@/components/types';

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

/**
 * Generate stress test seed data for testing app performance
 */
export async function generateStressTestData(
  friendsCount: number = 100,
  interactionsPerFriend: number = 5
): Promise<void> {
  console.log(`[StressTest] Generating ${friendsCount} friends with ${interactionsPerFriend} interactions each...`);

  try {
    await database.write(async () => {
      const friends: FriendModel[] = [];

      // Create friends
      for (let i = 0; i < friendsCount; i++) {
        const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
        const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
        const weaveScore = Math.floor(Math.random() * 100);

        const friend = await database.get<FriendModel>('friends').create((f) => {
          f.name = `Test Friend ${i + 1}`;
          f.dunbarTier = tier;
          f.archetype = archetype;
          f.photoUrl = '';
          f.notes = `This is a stress test friend #${i + 1}`;
          f.weaveScore = weaveScore;
          f.lastUpdated = new Date();
          f.resilience = 0.8 + Math.random() * 0.7; // Random between 0.8 and 1.5
          f.ratedWeavesCount = Math.floor(Math.random() * 20);
          f.momentumScore = Math.random() > 0.5 ? 15 : 0;
          f.momentumLastUpdated = new Date();
          f.isDormant = Math.random() > 0.8; // 20% chance of being dormant
          f.dormantSince = f.isDormant ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;
          f.birthday = Math.random() > 0.7 ? new Date(1990, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)) : null;
          f.anniversary = null;
          f.relationshipType = null;
        });

        friends.push(friend);
      }

      console.log(`[StressTest] Created ${friends.length} friends`);

      // Create interactions
      let totalInteractions = 0;
      for (const friend of friends) {
        for (let j = 0; j < interactionsPerFriend; j++) {
          const activity = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
          const duration = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
          const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
          const mode = MODES[Math.floor(Math.random() * MODES.length)];
          const status = Math.random() > 0.2 ? 'completed' : 'planned';

          // Random date within the last 6 months
          const randomDaysAgo = Math.floor(Math.random() * 180);
          const interactionDate = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000);

          const interaction = await database.get<InteractionModel>('interactions').create((i) => {
            i.interactionDate = interactionDate;
            i.interactionType = status === 'completed' ? 'log' : 'plan';
            i.activity = activity;
            i.status = status;
            i.mode = mode;
            i.note = `Stress test interaction ${j + 1} for ${friend.name}`;
            i.vibe = vibe;
            i.duration = duration;
            i.title = `${activity} with ${friend.name}`;
            i.location = Math.random() > 0.5 ? 'Test Location' : null;
            i.eventImportance = null;
            i.initiator = Math.random() > 0.5 ? 'me' : 'them';
          });

          // Create join table entry
          await database.get<InteractionFriend>('interaction_friends').create((ifriend) => {
            ifriend.interactionId = interaction.id;
            ifriend.friendId = friend.id;
          });

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
      // Get all friends
      const allFriends = await database.get<FriendModel>('friends').query().fetch();

      // Delete all stress test friends (those with "Test Friend" in the name)
      for (const friend of allFriends) {
        if (friend.name.startsWith('Test Friend')) {
          // Get all interactions for this friend
          const interactionFriends = await database
            .get<InteractionFriend>('interaction_friends')
            .query()
            .fetch();

          const friendInteractionFriends = interactionFriends.filter(
            (if_) => if_.friendId === friend.id
          );

          // Delete join table entries
          for (const ifriend of friendInteractionFriends) {
            await ifriend.destroyPermanently();
          }

          // Delete the friend
          await friend.destroyPermanently();
        }
      }

      // Delete orphaned interactions (those with no friends)
      const allInteractions = await database.get<InteractionModel>('interactions').query().fetch();
      const allInteractionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query()
        .fetch();

      for (const interaction of allInteractions) {
        const hasLinks = allInteractionFriends.some((if_) => if_.interactionId === interaction.id);
        if (!hasLinks) {
          await interaction.destroyPermanently();
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
}> {
  const allFriends = await database.get<FriendModel>('friends').query().fetch();
  const allInteractions = await database.get<InteractionModel>('interactions').query().fetch();
  const stressTestFriends = allFriends.filter((f) => f.name.startsWith('Test Friend'));

  return {
    totalFriends: allFriends.length,
    totalInteractions: allInteractions.length,
    stressTestFriends: stressTestFriends.length,
    averageInteractionsPerFriend:
      allFriends.length > 0 ? allInteractions.length / allFriends.length : 0,
  };
}
