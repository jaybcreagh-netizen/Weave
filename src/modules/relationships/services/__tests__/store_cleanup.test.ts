import { useRelationshipsStore } from '../../store';
import { database } from '@/db';
import { of, throwError, Subject } from 'rxjs';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
    },
}));

jest.mock('@/shared/services/app-state-manager.service', () => ({
    appStateManager: {
        shouldSleep: jest.fn(),
        subscribe: jest.fn(),
        subscribeToIdle: jest.fn(),
    },
}));

jest.mock('@nozbe/watermelondb', () => ({
    Q: {
        where: jest.fn(),
        sortBy: jest.fn(),
        take: jest.fn(),
        oneOf: jest.fn(),
        desc: 'desc',
    },
}));

describe('RelationshipsStore Cleanup', () => {
    let store: any;

    beforeEach(() => {
        jest.clearAllMocks();
        useRelationshipsStore.setState({
            friends: [],
            activeFriend: null,
            activeFriendInteractions: [],
            friendsSubscription: null,
            friendSubscription: null,
            interactionSubscription: null,
            appStateSubscription: null,
            isSleeping: false,
            pendingFriendId: null,
        });
        store = useRelationshipsStore.getState();
    });

    it('should cleanup existing subscriptions before observing a new friend', () => {
        const unsubscribeMock = jest.fn();
        useRelationshipsStore.setState({
            friendSubscription: { unsubscribe: unsubscribeMock } as any,
            interactionSubscription: { unsubscribe: unsubscribeMock } as any,
        });

        // Mock database calls for the new observation
        const mockFriendSub = { subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }) };
        const mockInteractionObserve = { observe: jest.fn().mockReturnValue(of([])) }; // Return observable directly

        (database.get as jest.Mock).mockImplementation((table) => {
            if (table === 'friends') {
                return {
                    findAndObserve: jest.fn().mockReturnValue({
                        pipe: jest.fn().mockReturnValue(mockFriendSub),
                    }),
                };
            }
            if (table === 'interaction_friends') {
                return {
                    query: jest.fn().mockReturnValue({
                        observe: jest.fn().mockReturnValue({
                            pipe: jest.fn().mockReturnValue(mockInteractionObserve),
                        }),
                    }),
                };
            }
            return {};
        });

        useRelationshipsStore.getState().observeFriend('friend-1');

        expect(unsubscribeMock).toHaveBeenCalledTimes(2);
    });

    it('should cleanup partial subscriptions if an error occurs during setup', () => {
        const mockFriendUnsub = jest.fn();
        const mockFriendSub = {
            subscribe: jest.fn().mockReturnValue({ unsubscribe: mockFriendUnsub }),
        };

        // Simulate error in interaction observation
        (database.get as jest.Mock).mockImplementation((table) => {
            if (table === 'friends') {
                return {
                    findAndObserve: jest.fn().mockReturnValue({
                        pipe: jest.fn().mockReturnValue(mockFriendSub),
                    }),
                };
            }
            if (table === 'interaction_friends') {
                throw new Error('Database error');
            }
            return {};
        });

        // Spy on console.error to suppress output
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        useRelationshipsStore.getState().observeFriend('friend-1');

        // Should have attempted to subscribe to friend
        expect(mockFriendSub.subscribe).toHaveBeenCalled();

        // Should have cleaned up the friend subscription because interaction failed
        expect(mockFriendUnsub).toHaveBeenCalled();

        // But because interaction failed, it should have cleaned up
        // Note: In the current implementation, if the try block fails, we call unobserveFriend()
        // However, friendSubscription is only set at the END of the try block.
        // So if it fails in the middle, friendSubscription state is null, so unobserveFriend won't unsubscribe the *just created* subscription
        // UNLESS we set it immediately.

        // Wait, looking at my implementation:
        // const friendSub = ... subscribe(...)
        // ... error ...
        // set({ friendSubscription: friendSub ... }) is at the END.
        // So if error happens in between, friendSub is NOT in the store.
        // So get().unobserveFriend() will NOT clean it up.

        // This reveals a flaw in my implementation!
        // I need to unsubscribe from the local variables if they exist.

        consoleSpy.mockRestore();
    });
});
