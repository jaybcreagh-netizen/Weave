import type { SuggestionFrequency } from '@/db/models/UserProfile';
import type { LegacyNotificationFrequency } from '@/modules/notifications/types';

export const DEFAULT_SUGGESTION_FREQUENCY: SuggestionFrequency = 'balanced';

export function mapLegacyNotificationFrequencyToSuggestionFrequency(
    frequency?: LegacyNotificationFrequency | null
): SuggestionFrequency {
    switch (frequency) {
        case 'light':
            return 'quiet';
        case 'proactive':
            return 'proactive';
        default:
            return DEFAULT_SUGGESTION_FREQUENCY;
    }
}

export function resolveSuggestionFrequency(
    profileFrequency?: SuggestionFrequency | null,
    legacyFrequency?: LegacyNotificationFrequency | null
): SuggestionFrequency {
    if (profileFrequency) {
        return profileFrequency;
    }

    return mapLegacyNotificationFrequencyToSuggestionFrequency(legacyFrequency);
}

export function getSmartSuggestionDailyLimit(
    frequency?: SuggestionFrequency | null
): number {
    switch (frequency || DEFAULT_SUGGESTION_FREQUENCY) {
        case 'quiet':
            return 1;
        case 'proactive':
            return 4;
        default:
            return 2;
    }
}
