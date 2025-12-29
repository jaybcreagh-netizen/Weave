import { SyncEngine } from '@/modules/sync/services/data-replication.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

jest.mock('@/db', () => ({
    database: {
        write: jest.fn(),
        get: jest.fn(),
    },
}));

jest.mock('@/modules/auth/services/supabase.service', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('SyncEngine', () => {
    const userId = 'test-user-id';
    let syncEngine: SyncEngine;

    beforeEach(() => {
        jest.clearAllMocks();
        syncEngine = new SyncEngine(userId);
    });

    describe('loadLastSyncTimestamp', () => {
        it('should load timestamp from AsyncStorage', async () => {
            const timestamp = 1625097600000;
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(timestamp.toString());

            // Access private method via any cast
            await (syncEngine as any).loadLastSyncTimestamp();

            expect(AsyncStorage.getItem).toHaveBeenCalledWith(`weave:sync:lastTimestamp:${userId}`);
            expect((syncEngine as any).lastSyncTimestamp).toBe(timestamp);
        });

        it('should default to 0 if no timestamp found', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            await (syncEngine as any).loadLastSyncTimestamp();

            expect((syncEngine as any).lastSyncTimestamp).toBe(0);
        });

        it('should handle errors gracefully', async () => {
            (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

            await (syncEngine as any).loadLastSyncTimestamp();

            expect((syncEngine as any).lastSyncTimestamp).toBe(0);
        });
    });

    describe('saveLastSyncTimestamp', () => {
        it('should save timestamp to AsyncStorage', async () => {
            const timestamp = 1625097600000;
            (syncEngine as any).lastSyncTimestamp = timestamp;

            await (syncEngine as any).saveLastSyncTimestamp();

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                `weave:sync:lastTimestamp:${userId}`,
                timestamp.toString()
            );
        });

        it('should handle errors gracefully', async () => {
            (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

            // Should not throw
            await (syncEngine as any).saveLastSyncTimestamp();
        });
    });
});
