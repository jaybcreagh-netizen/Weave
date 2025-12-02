import { useRelationshipsStore } from './store';
import { database } from '@/db';
import { of, Subject } from 'rxjs';

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
        skip: jest.fn(),
        desc: 'desc',
    },
}));

describe('RelationshipsStore Subscription Leak Reproduction', () => {
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
            interactionsPageSize: 50,
            loadedInteractionsCount: 0,
            totalInteractionsCount: 0,
            hasMoreInteractions: false,
        });
        store = useRelationshipsStore.getState();
    });

    it('should not leak subscriptions when synchronous re-entry occurs', async () => {
        // Setup mocks
        const unsubscribeA = jest.fn();
        const unsubscribeB = jest.fn();

        const friendSubjectA = new Subject<any>();
        // We need to simulate synchronous emission upon subscription
        // We can do this by using a custom observable or just `of` if we want simple sync
        // But we want to trigger re-entry.

        // Use Subjects to simulate observables with pipe support
        const subjectA = new Subject<any>();
        const subjectB = new Subject<any>();

        // Mock subscribe to capture unsubscribes
        const originalSubscribeA = subjectA.subscribe.bind(subjectA);
        const originalSubscribeB = subjectB.subscribe.bind(subjectB);

        jest.spyOn(subjectA, 'subscribe').mockImplementation((...args) => {
            const sub = originalSubscribeA(...args);
            sub.add(unsubscribeA);
            return sub;
        });

        jest.spyOn(subjectB, 'subscribe').mockImplementation((...args) => {
            const sub = originalSubscribeB(...args);
            sub.add(unsubscribeB);
            return sub;
        });

        // Mock interaction observer
        const interactionSubject = new Subject<any>();

        (database.get as jest.Mock).mockImplementation((table) => {
            if (table === 'friends') {
                return {
                    findAndObserve: jest.fn((id) => {
                        if (id === 'friend-A') return subjectA;
                        if (id === 'friend-B') return subjectB;
                        return new Subject();
                    }),
                };
            }
            if (table === 'interaction_friends') {
                return {
                    query: jest.fn().mockReturnValue({
                        observe: () => interactionSubject
                    }),
                };
            }
            return {};
        });

        // We need to trigger observeFriend('B') inside the callback of observeFriend('A')
        // But we can't easily inject code into the store's callback.
        // However, the store calls `set({ activeFriend: friend })`.
        // We can spy on `set`? No, zustand `set` is internal.
        // But we can subscribe to the store!

        let reEntryTriggered = false;
        const unsubStore = useRelationshipsStore.subscribe((state: any) => {
            if (state.activeFriend?.id === 'friend-A' && !reEntryTriggered) {
                reEntryTriggered = true;
                console.log('Triggering re-entry observeFriend(B)');
                useRelationshipsStore.getState().observeFriend('friend-B');
            }
        });

        // Start the chain
        console.log('Calling observeFriend(A)');
        useRelationshipsStore.getState().observeFriend('friend-A');

        // Emit A synchronously (if observeOn is not present) or it will be scheduled
        subjectA.next({ id: 'friend-A' });

        // If observeOn(asyncScheduler) is used, the callback hasn't run yet.
        // We need to wait for the async scheduler.
        // In Jest, we can use jest.runAllTimers() if we use fake timers, or just wait.
        // But asyncScheduler uses setInterval/setTimeout usually.

        // Let's assume we need to wait a tick.
        await new Promise(resolve => setTimeout(resolve, 0));

        // Now B should have been triggered if logic works
        if (reEntryTriggered) {
            subjectB.next({ id: 'friend-B' });
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        unsubStore();

        // Analysis of what happened:
        // 1. observeFriend('A') called.
        // 2. Subscribes to A.
        // 3. Mock A emits sync.
        // 4. Store updates activeFriend to A.
        // 5. Store listener fires. Calls observeFriend('B').
        //    a. unobserveFriend() called. friendSubscription is null (A not set yet).
        //    b. Subscribes to B.
        //    c. Mock B emits sync.
        //    d. Store updates activeFriend to B.
        //    e. Sets friendSubscription to B's sub.
        // 6. observeFriend('A') continues.
        // 7. Sets friendSubscription to A's sub. (OVERWRITES B!)

        // Now we check the state
        const finalState = useRelationshipsStore.getState();
        console.log('Final friendSubscription is for:', finalState.activeFriend?.id);

        // If the bug exists:
        // - friendSubscription should be A's subscription (because it overwrote B's).
        // - But activeFriend is B (or A? depends on order of set).
        //   - Step 4 set A. Step 5d set B. Step 7 set subscription A.
        //   - activeFriend should be B.
        // - So we have activeFriend B, but subscription A.
        // - And subscription B is lost (orphaned).

        // Let's verify:
        // If we call unobserveFriend(), it should unsubscribe the CURRENT subscription.
        useRelationshipsStore.getState().unobserveFriend();

        // If A's sub was in the store, A is unsubscribed.
        // B's sub was overwritten, so it is NEVER unsubscribed.

        expect(unsubscribeA).toHaveBeenCalled(); // It is unsubscribed because it was in the store.
        expect(unsubscribeB).toHaveBeenCalled(); // IT SHOULD BE called if we fixed it. But with bug, it won't be.

    });
});
