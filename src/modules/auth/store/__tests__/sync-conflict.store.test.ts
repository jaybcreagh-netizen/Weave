import type { Model } from '@nozbe/watermelondb';
import { useSyncConflictStore, type ConflictData } from '../sync-conflict.store';

const mockModel = {} as Model;

function makeConflict(id: string, tableName: string): ConflictData {
    return {
        id,
        tableName,
        localRecord: mockModel,
        serverRecord: { id, table_name: tableName },
        resolve: jest.fn(async () => undefined),
    };
}

describe('sync-conflict.store', () => {
    beforeEach(() => {
        useSyncConflictStore.setState({ conflicts: [], isModalOpen: false });
    });

    it('stores conflicts with same id when tableName differs', () => {
        const store = useSyncConflictStore.getState();
        store.addConflict(makeConflict('123', 'friends'));
        store.addConflict(makeConflict('123', 'interactions'));

        const state = useSyncConflictStore.getState();
        expect(state.conflicts).toHaveLength(2);
        expect(state.isModalOpen).toBe(true);
    });

    it('dedupes conflicts with same id and tableName', () => {
        const store = useSyncConflictStore.getState();
        store.addConflict(makeConflict('123', 'friends'));
        store.addConflict(makeConflict('123', 'friends'));

        const state = useSyncConflictStore.getState();
        expect(state.conflicts).toHaveLength(1);
    });

    it('resolves only targeted conflict when id and tableName are provided', () => {
        const store = useSyncConflictStore.getState();
        store.addConflict(makeConflict('123', 'friends'));
        store.addConflict(makeConflict('123', 'interactions'));
        store.addConflict(makeConflict('456', 'friends'));

        store.resolveConflict('123', 'friends');

        const state = useSyncConflictStore.getState();
        expect(state.conflicts.map((c) => `${c.tableName}:${c.id}`)).toEqual([
            'interactions:123',
            'friends:456',
        ]);
        expect(state.isModalOpen).toBe(true);
    });
});
