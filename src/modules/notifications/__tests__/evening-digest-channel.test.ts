import { EveningDigestChannel } from '../services/channels/evening-digest';

jest.mock('@/shared/utils/Logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(),
    },
}));

jest.mock('../services/notification-analytics', () => ({
    notificationAnalytics: {
        trackScheduled: jest.fn(),
        trackActionCompleted: jest.fn(),
    },
}));

jest.mock('../services/notification-store', () => ({
    notificationStore: {
        getPreferences: jest.fn(),
    },
}));

jest.mock('@/modules/intelligence/services/focus-generator', () => ({
    FocusGenerator: {
        generateFocusData: jest.fn(),
    },
}));

const { FocusGenerator } = jest.requireMock('@/modules/intelligence/services/focus-generator') as {
    FocusGenerator: { generateFocusData: jest.Mock };
};

describe('EveningDigestChannel.generateContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('handles upcoming holiday items with no friend', async () => {
        (FocusGenerator.generateFocusData as jest.Mock).mockResolvedValue({
            plans: [],
            pendingConfirmations: [],
            suggestions: [],
            upcomingDates: [
                {
                    type: 'holiday',
                    daysUntil: 5,
                    title: "St. Patrick's Day",
                    importance: 'medium',
                },
            ],
        });

        const content = await EveningDigestChannel.generateContent();

        expect(content.items).toHaveLength(1);
        expect(content.items[0]).toMatchObject({
            type: 'life_event',
            title: "St. Patrick's Day",
            friendId: undefined,
            friendName: undefined,
        });
    });
});
