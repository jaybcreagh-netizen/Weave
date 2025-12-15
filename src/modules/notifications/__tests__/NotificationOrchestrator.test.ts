
import { NotificationOrchestrator } from '../services/notification-orchestrator';
import { SmartSuggestionsChannel } from '../services/channels/smart-suggestions';
import { WeeklyReflectionChannel } from '../services/channels/weekly-reflection';
import { EveningDigestChannel } from '../services/channels/evening-digest';

// Mock dependencies
jest.mock('@/shared/utils/Logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
    },
}));

jest.mock('../services/channels/smart-suggestions', () => ({
    SmartSuggestionsChannel: {
        evaluateAndSchedule: jest.fn(),
    },
}));

jest.mock('../services/channels/weekly-reflection', () => ({
    WeeklyReflectionChannel: {
        ensureScheduled: jest.fn(),
        schedule: jest.fn(),
    },
}));

jest.mock('../services/channels/evening-digest', () => ({
    EveningDigestChannel: {
        schedule: jest.fn(),
    },
}));

// Mock other channels to prevent database/uuid imports
jest.mock('../services/channels/battery-checkin', () => ({
    BatteryCheckinChannel: { checkAndExtendBatch: jest.fn() },
}));
jest.mock('../services/channels/memory-nudge', () => ({
    MemoryNudgeChannel: { schedule: jest.fn() },
}));
jest.mock('../services/channels/event-reminder', () => ({
    EventReminderChannel: { scheduleAll: jest.fn(), schedule: jest.fn(), cancel: jest.fn() },
}));
jest.mock('../services/channels/deepening-nudge', () => ({
    DeepeningNudgeChannel: {},
}));
jest.mock('../services/channels/event-suggestion', () => ({
    EventSuggestionChannel: {},
}));


jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
}));

jest.mock('../services/permission.service', () => ({
    checkNotificationPermissions: jest.fn().mockResolvedValue(true),
}));

describe('NotificationOrchestrator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('runBackgroundChecks', () => {
        it('should call evaluateAndSchedule on SmartSuggestionsChannel', async () => {
            await NotificationOrchestrator.runBackgroundChecks();
            expect(SmartSuggestionsChannel.evaluateAndSchedule).toHaveBeenCalled();
        });

        it('should call ensureScheduled on WeeklyReflectionChannel', async () => {
            await NotificationOrchestrator.runBackgroundChecks();
            expect(WeeklyReflectionChannel.ensureScheduled).toHaveBeenCalled();
        });

        it('should call schedule on EveningDigestChannel', async () => {
            await NotificationOrchestrator.runBackgroundChecks();
            expect(EveningDigestChannel.schedule).toHaveBeenCalled();
        });
    });
});
