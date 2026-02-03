// import { database } from '@/db'; // Don't import real database
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '@/db/schema';

// Import all models required for the DB
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

// Mock conflicting modules
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('@nozbe/watermelondb/utils/common/randomId', () => ({
    __esModule: true,
    default: () => 'mock-id-' + Math.random(),
    setGenerator: jest.fn(),
}));

// Setup LokiJS Database
const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
});

const mockDatabase = new Database({
    adapter,
    modelClasses: [
        Friend,
        Interaction,
        InteractionFriend,
        SuggestionEvent,
        Intention,
        IntentionFriend,
        UserProfile,
        PracticeLog,
        LifeEvent,
        UserProgress,
        FriendBadge,
        AchievementUnlock,
        WeeklyReflection,
        PortfolioSnapshot,
        JournalEntry,
        CustomChip,
        ChipUsage,
        InteractionOutcome,
        EventSuggestionFeedback,
        SocialSeasonLog,
        SocialBatteryLog,
        JournalEntryFriend,
        Group,
        GroupMember,
        OracleInsight,
        OracleUsage,
        NetworkHealthLog,
        EveningDigest,
    ],
});

// Mock the @/db module to return our testDatabase
jest.mock('@/db', () => ({
    database: mockDatabase,
}));



describe('Data Import', () => {
    it('should import the provided test export file without errors', async () => {
        const { importData } = require('../data-import');

        // Read the latest fixture in test_data/
        const fixtureDir = path.resolve(process.cwd(), 'test_data');
        const fixtureFiles = fs
            .readdirSync(fixtureDir)
            .filter((name) => /^weave-export-.*\.json$/.test(name))
            .sort();

        expect(fixtureFiles.length).toBeGreaterThan(0);
        const testFilePath = path.join(fixtureDir, fixtureFiles[fixtureFiles.length - 1]);
        const jsonString = fs.readFileSync(testFilePath, 'utf8');

        // Attempt import
        const result = await importData(jsonString, true);

        // Check for errors
        if (result.errors.length > 0) {
            console.error('Import Errors:', JSON.stringify(result.errors, null, 2));
        }

        console.log('Import Stats:', {
            friends: result.friendsImported,
            interactions: result.interactionsImported,
            success: result.success
        });

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.friendsImported).toBeGreaterThan(0);
        expect(result.interactionsImported).toBeGreaterThan(0);
    });
});
