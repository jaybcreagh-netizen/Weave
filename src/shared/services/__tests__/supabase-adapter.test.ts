import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetSupabaseClient = jest.fn() as any;
const mockIsSupabaseConfigured = jest.fn() as any;

jest.mock('@/shared/services/supabase-client', () => ({
    getSupabaseClient: mockGetSupabaseClient,
    isSupabaseConfigured: mockIsSupabaseConfigured,
}));

let SupabaseCloudAdapter: typeof import('../supabase-adapter').SupabaseCloudAdapter;

function createFluentQuery(finalResult: { data: any; error: any }) {
    const query: any = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => query);
    query.or = jest.fn(() => query);
    query.neq = jest.fn(() => query);
    query.in = jest.fn(() => query);
    query.insert = jest.fn(() => query);
    query.update = jest.fn(() => query);
    query.upsert = jest.fn(() => query);
    query.single = jest.fn(async () => finalResult);
    query.maybeSingle = jest.fn(async () => finalResult);
    query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(finalResult).then(resolve, reject);
    return query;
}

describe('SupabaseCloudAdapter', () => {
    beforeAll(() => {
        ({ SupabaseCloudAdapter } = require('../supabase-adapter'));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsSupabaseConfigured.mockReturnValue(true);
    });

    it('sendLinkRequest sorts participant IDs and upserts pending link', async () => {
        const existingQuery = createFluentQuery({ data: null, error: null });
        const upsertQuery = createFluentQuery({ data: { id: 'link-1' }, error: null });

        const mockClient = {
            auth: {
                getUser: jest.fn(async () => ({ data: { user: { id: 'z-user' } } })),
            },
            from: jest
                .fn()
                .mockImplementationOnce(() => existingQuery)
                .mockImplementationOnce(() => upsertQuery),
        };
        mockGetSupabaseClient.mockReturnValue(mockClient);

        const adapter = new SupabaseCloudAdapter();
        const result = await adapter.sendLinkRequest({ targetUserId: 'a-user' });

        expect(result).toEqual({ success: true, serverId: 'link-1' });
        expect(existingQuery.eq).toHaveBeenNthCalledWith(1, 'user_a_id', 'a-user');
        expect(existingQuery.eq).toHaveBeenNthCalledWith(2, 'user_b_id', 'z-user');
        expect(upsertQuery.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_a_id: 'a-user',
                user_b_id: 'z-user',
                initiated_by: 'z-user',
                status: 'pending',
            }),
            expect.objectContaining({ onConflict: 'user_a_id,user_b_id' })
        );
    });

    it('fetchPendingLinkRequests filters by participant side and initiated_by', async () => {
        const linksQuery = createFluentQuery({
            data: [
                {
                    id: 'link-1',
                    user_a_id: 'a-user',
                    user_b_id: 'z-user',
                    initiated_by: 'a-user',
                    created_at: '2026-01-01T00:00:00.000Z',
                },
            ],
            error: null,
        });
        const profilesQuery = createFluentQuery({
            data: [
                {
                    id: 'a-user',
                    username: 'alice',
                    display_name: 'Alice',
                    photo_url: null,
                },
            ],
            error: null,
        });

        const mockClient = {
            auth: {
                getUser: jest.fn(async () => ({ data: { user: { id: 'z-user' } } })),
            },
            from: jest.fn((table: string) => {
                if (table === 'friend_links') return linksQuery;
                return profilesQuery;
            }),
        };
        mockGetSupabaseClient.mockReturnValue(mockClient);

        const adapter = new SupabaseCloudAdapter();
        const requests = await adapter.fetchPendingLinkRequests();

        expect(linksQuery.or).toHaveBeenCalledWith('user_a_id.eq.z-user,user_b_id.eq.z-user');
        expect(linksQuery.neq).toHaveBeenCalledWith('initiated_by', 'z-user');
        expect(requests).toEqual([
            {
                requestId: 'link-1',
                fromUserId: 'a-user',
                fromUsername: 'alice',
                fromDisplayName: 'Alice',
                fromPhotoUrl: undefined,
                createdAt: '2026-01-01T00:00:00.000Z',
            },
        ]);
    });

    it('isLinkedFriend checks accepted status and sorted user pair', async () => {
        const linkQuery = createFluentQuery({ data: { id: 'link-1' }, error: null });

        const mockClient = {
            auth: {
                getUser: jest.fn(async () => ({ data: { user: { id: 'z-user' } } })),
            },
            from: jest.fn(() => linkQuery),
        };
        mockGetSupabaseClient.mockReturnValue(mockClient);

        const adapter = new SupabaseCloudAdapter();
        const linked = await adapter.isLinkedFriend('a-user');

        expect(linked).toBe(true);
        expect(linkQuery.eq).toHaveBeenNthCalledWith(1, 'status', 'accepted');
        expect(linkQuery.eq).toHaveBeenNthCalledWith(2, 'user_a_id', 'a-user');
        expect(linkQuery.eq).toHaveBeenNthCalledWith(3, 'user_b_id', 'z-user');
    });
});
