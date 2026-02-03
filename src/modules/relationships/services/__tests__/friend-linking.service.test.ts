import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetSupabaseClient = jest.fn() as any;
const mockGetCurrentSession = jest.fn() as any;
const mockDatabaseWrite = jest.fn(async (fn: () => Promise<void> | void) => fn()) as any;
const mockDatabaseGet = jest.fn() as any;

jest.mock('@/shared/services/supabase-client', () => ({
    getSupabaseClient: mockGetSupabaseClient,
}));

jest.mock('@/modules/auth/services/supabase-auth.service', () => ({
    getCurrentSession: mockGetCurrentSession,
}));

jest.mock('@/db', () => ({
    database: {
        write: (fn: () => Promise<void> | void) => mockDatabaseWrite(fn),
        get: (...args: unknown[]) => mockDatabaseGet(...args),
    },
}));

let acceptLinkRequest: typeof import('../friend-linking.service').acceptLinkRequest;
let getPendingIncomingRequests: typeof import('../friend-linking.service').getPendingIncomingRequests;

function createChainedQuery(finalResult: { data: any; error: any }) {
    const query: any = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => query);
    query.or = jest.fn(() => query);
    query.neq = jest.fn(() => query);
    query.update = jest.fn(() => query);
    query.single = jest.fn(async () => finalResult);
    query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(finalResult).then(resolve, reject);
    return query;
}

describe('friend-linking.service', () => {
    beforeAll(() => {
        ({ acceptLinkRequest, getPendingIncomingRequests } = require('../friend-linking.service'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('getPendingIncomingRequests resolves requester by initiated_by regardless of user_a/user_b position', async () => {
        mockGetCurrentSession.mockResolvedValue({ userId: 'me' });

        const pendingQuery = createChainedQuery({
            data: [
                {
                    id: 'link-1',
                    user_a_id: 'me',
                    user_b_id: 'other-1',
                    initiated_by: 'other-1',
                    status: 'pending',
                    created_at: '2026-01-01T00:00:00.000Z',
                    user_a_profile: { id: 'me', username: 'me', display_name: 'Me' },
                    user_b_profile: { id: 'other-1', username: 'other1', display_name: 'Other One', photo_url: 'https://x/1.png' },
                },
                {
                    id: 'link-2',
                    user_a_id: 'other-2',
                    user_b_id: 'me',
                    initiated_by: 'other-2',
                    status: 'pending',
                    created_at: '2026-01-02T00:00:00.000Z',
                    user_a_profile: { id: 'other-2', username: 'other2', display_name: 'Other Two' },
                    user_b_profile: { id: 'me', username: 'me', display_name: 'Me' },
                },
            ],
            error: null,
        });

        mockGetSupabaseClient.mockReturnValue({
            from: jest.fn(() => pendingQuery),
        });

        const results = await getPendingIncomingRequests();

        expect(results).toEqual([
            {
                id: 'link-1',
                userId: 'other-1',
                username: 'other1',
                displayName: 'Other One',
                photoUrl: 'https://x/1.png',
                status: 'pending',
                createdAt: '2026-01-01T00:00:00.000Z',
            },
            {
                id: 'link-2',
                userId: 'other-2',
                username: 'other2',
                displayName: 'Other Two',
                photoUrl: undefined,
                status: 'pending',
                createdAt: '2026-01-02T00:00:00.000Z',
            },
        ]);

        expect(pendingQuery.or).toHaveBeenCalledWith('user_a_id.eq.me,user_b_id.eq.me');
        expect(pendingQuery.neq).toHaveBeenCalledWith('initiated_by', 'me');
    });

    it('acceptLinkRequest writes user_a_friend_id when current user is user_a', async () => {
        mockGetCurrentSession.mockResolvedValue({ userId: 'me' });

        const selectQuery = createChainedQuery({
            data: {
                id: 'link-1',
                user_a_id: 'me',
                user_b_id: 'requester',
                initiated_by: 'requester',
                status: 'pending',
                user_a_profile: { id: 'me', username: 'me', display_name: 'Me' },
                user_b_profile: { id: 'requester', username: 'req', display_name: 'Requester' },
            },
            error: null,
        });
        const updateQuery = createChainedQuery({ data: null, error: null });

        mockGetSupabaseClient.mockReturnValue({
            from: jest
                .fn()
                .mockImplementationOnce(() => selectQuery)
                .mockImplementationOnce(() => updateQuery),
        });

        const friendState: Record<string, unknown> = {};
        const friendRecord = {
            id: 'friend-local-1',
            update: jest.fn(async (updater: (draft: any) => void) => {
                const draft: any = {};
                updater(draft);
                Object.assign(friendState, draft);
            }),
        };

        mockDatabaseGet.mockReturnValue({
            find: jest.fn(async () => friendRecord),
        });

        const success = await acceptLinkRequest('link-1', 'friend-local-1', 'Community');

        expect(success).toBe(true);
        expect(updateQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'accepted',
                user_a_friend_id: 'friend-local-1',
            })
        );
        expect(friendState.linkedUserId).toBe('requester');
        expect(friendState.linkStatus).toBe('linked');
    });

    it('acceptLinkRequest writes user_b_friend_id when current user is user_b', async () => {
        mockGetCurrentSession.mockResolvedValue({ userId: 'me' });

        const selectQuery = createChainedQuery({
            data: {
                id: 'link-2',
                user_a_id: 'requester',
                user_b_id: 'me',
                initiated_by: 'requester',
                status: 'pending',
                user_a_profile: { id: 'requester', username: 'req', display_name: 'Requester' },
                user_b_profile: { id: 'me', username: 'me', display_name: 'Me' },
            },
            error: null,
        });
        const updateQuery = createChainedQuery({ data: null, error: null });

        mockGetSupabaseClient.mockReturnValue({
            from: jest
                .fn()
                .mockImplementationOnce(() => selectQuery)
                .mockImplementationOnce(() => updateQuery),
        });

        const friendRecord = {
            id: 'friend-local-2',
            update: jest.fn(async (updater: (draft: any) => void) => {
                const draft: any = {};
                updater(draft);
            }),
        };

        mockDatabaseGet.mockReturnValue({
            find: jest.fn(async () => friendRecord),
        });

        const success = await acceptLinkRequest('link-2', 'friend-local-2', 'Community');

        expect(success).toBe(true);
        expect(updateQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'accepted',
                user_b_friend_id: 'friend-local-2',
            })
        );
    });
});
