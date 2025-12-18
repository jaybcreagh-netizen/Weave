
// Removed static imports to avoid hoisting issues with mockDatabase
// import { exportAllData } from '../data-export';
// import { importData } from '../data-import';
import { database } from '@/db';
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '@/db/schema';
import migrations from '@/db/migrations';

// Import models
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import SuggestionEvent from '@/db/models/SuggestionEvent';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import UserProfile from '@/db/models/UserProfile';
import PracticeLog from '@/db/models/PracticeLog';
import LifeEvent from '@/db/models/LifeEvent';
import UserProgress from '@/db/models/UserProgress';
import FriendBadge from '@/db/models/FriendBadge';
import AchievementUnlock from '@/db/models/AchievementUnlock';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import PortfolioSnapshot from '@/db/models/PortfolioSnapshot';
import JournalEntry from '@/db/models/JournalEntry';
import CustomChip from '@/db/models/CustomChip';
import ChipUsage from '@/db/models/ChipUsage';
import InteractionOutcome from '@/db/models/InteractionOutcome';
import EventSuggestionFeedback from '@/db/models/EventSuggestionFeedback';
import SocialSeasonLog from '@/db/models/SocialSeasonLog';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import Group from '@/db/models/Group';
import GroupMember from '@/db/models/GroupMember';
import OracleInsight from '@/db/models/OracleInsight';
import OracleUsage from '@/db/models/OracleUsage';
import NetworkHealthLog from '@/db/models/NetworkHealthLog';
import EveningDigest from '@/db/models/EveningDigest';

// Mock dependencies
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-' + Math.random() }));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('@nozbe/watermelondb/utils/common/randomId', () => ({
    __esModule: true,
    default: () => 'mock-id-' + Math.random(),
    setGenerator: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
    documentDirectory: 'file:///mock/doc/dir/',
    writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-application', () => ({
    nativeApplicationVersion: '1.0.0',
}));
jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    Alert: { alert: jest.fn() },
    Share: { share: jest.fn() },
}));

// Setup LokiJS Database
const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
});

// Rename to mockDatabase to allow use in jest.mock
const mockDatabase = new Database({
    adapter,
    modelClasses: [
        Friend, Interaction, InteractionFriend, SuggestionEvent, Intention, IntentionFriend,
        UserProfile, PracticeLog, LifeEvent, UserProgress, FriendBadge, AchievementUnlock,
        WeeklyReflection, PortfolioSnapshot, JournalEntry, CustomChip, ChipUsage,
        InteractionOutcome, EventSuggestionFeedback, SocialSeasonLog, SocialBatteryLog,
        JournalEntryFriend, Group, GroupMember, OracleInsight, OracleUsage, NetworkHealthLog, EveningDigest
    ],
});

// Mock the @/db module
jest.mock('@/db', () => ({
    database: mockDatabase,
}));

describe('Full Data Backup & Restore', () => {
    beforeEach(async () => {
        // Clear DB
        await mockDatabase.write(async () => {
            await mockDatabase.unsafeResetDatabase();
        });
    });

    it('should include social battery logs, journal entries, and reflections in export', async () => {
        // 1. Populate DB with test data
        await mockDatabase.write(async () => {
            // Friend
            const friends = mockDatabase.get<Friend>('friends');
            await friends.create(f => {
                f._raw.id = 'friend-1';
                f.name = 'Test Friend';
                f.dunbarTier = 'Inner Circle';
                f.archetype = 'The Sun' as any;
                f.weaveScore = 50;
            });

            // Social Battery Log
            const batteryLogs = mockDatabase.get<SocialBatteryLog>('social_battery_logs');
            await batteryLogs.create(log => {
                log.userId = 'user-1';
                log.value = 4;
                log.timestamp = 1625097600000; // Some timestamp
            });

            // Journal Entry
            const journalEntries = mockDatabase.get<JournalEntry>('journal_entries');
            await journalEntries.create(entry => {
                entry._raw.id = 'journal-1';
                entry.content = 'My dear diary';
                entry.entryDate = 1625097600000;
                // Readonly fields must be set via _raw
                (entry as any)._raw.created_at = 1625097600000;
                entry.updatedAt = new Date(1625097600000);
            });

            // Weekly Reflection
            const reflections = mockDatabase.get<WeeklyReflection>('weekly_reflections');
            await reflections.create(ref => {
                ref._raw.id = 'ref-1';
                ref.weekStartDate = 1625097600000;
                ref.weekEndDate = 1625702400000;
                ref.totalWeaves = 5;
                ref.friendsContacted = 3;
                ref.completedAt = new Date(1625702400000);
                // Readonly fields must be set via _raw
                (ref as any)._raw.created_at = 1625702400000;
            });
        });

        // 2. Export Data
        const { exportAllData } = require('../data-export');
        const jsonString = await exportAllData();
        const exportData = JSON.parse(jsonString);

        // 3. Verify standard data
        expect(exportData.friends).toHaveLength(1);
        expect(exportData.friends[0].name).toBe('Test Friend');

        // 4. Verify NEW data (Expect to fail currently)
        expect(exportData.socialBatteryLogs).toBeDefined();
        expect(exportData.socialBatteryLogs).toHaveLength(1);
        expect(exportData.socialBatteryLogs[0].value).toBe(4);

        expect(exportData.journalEntries).toBeDefined();
        expect(exportData.journalEntries).toHaveLength(1);
        expect(exportData.journalEntries[0].content).toBe('My dear diary');

        expect(exportData.weeklyReflections).toBeDefined();
        expect(exportData.weeklyReflections).toHaveLength(1);
        expect(exportData.weeklyReflections[0].totalWeaves).toBe(5);
    });

    it('should restore social battery logs, journal entries, and reflections from import', async () => {
        // 1. Create Mock Import Data
        const importJson = JSON.stringify({
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0',
            platform: 'ios',
            friends: [],
            interactions: [],
            socialBatteryLogs: [
                { userId: 'user-1', value: 3, timestamp: 100000 }
            ],
            journalEntries: [
                { id: 'j-2', content: 'Restored Entry', entryDate: 200000, createdAt: 200000, updatedAt: 200000 }
            ],
            weeklyReflections: [
                {
                    id: 'w-1', weekStartDate: 100, weekEndDate: 200, totalWeaves: 10, friendsContacted: 2,
                    topActivity: 'Coffee', topActivityCount: 5, missedFriendsCount: 0, completedAt: 200, createdAt: 200
                }
            ],
            stats: { totalFriends: 0, totalInteractions: 0 }
        });


        // 2. Run Import
        const { importData } = require('../data-import');
        const result = await importData(importJson, true);

        // 3. Verify Success
        expect(result.success).toBe(true);

        // 4. Verify DB Records
        const batteryLogs = await mockDatabase.get<SocialBatteryLog>('social_battery_logs').query().fetch();
        expect(batteryLogs).toHaveLength(1);
        expect(batteryLogs[0].value).toBe(3);

        const journalEntries = await mockDatabase.get<JournalEntry>('journal_entries').query().fetch();
        expect(journalEntries).toHaveLength(1);
        expect(journalEntries[0].content).toBe('Restored Entry');

        const reflections = await mockDatabase.get<WeeklyReflection>('weekly_reflections').query().fetch();
        expect(reflections).toHaveLength(1);
        expect(reflections[0].totalWeaves).toBe(10);
    });
});
