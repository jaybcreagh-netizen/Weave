import * as Notifications from 'expo-notifications';

export const BATTERY_CHECKIN_CATEGORY_ID = 'battery-checkin-quick-actions';

export const BATTERY_CHECKIN_ACTION_LOW = 'battery-checkin-quick-low';
export const BATTERY_CHECKIN_ACTION_OKAY = 'battery-checkin-quick-okay';
export const BATTERY_CHECKIN_ACTION_HIGH = 'battery-checkin-quick-high';

const BATTERY_ACTION_VALUE_MAP: Record<string, number> = {
    [BATTERY_CHECKIN_ACTION_LOW]: 20,
    [BATTERY_CHECKIN_ACTION_OKAY]: 50,
    [BATTERY_CHECKIN_ACTION_HIGH]: 80,
};

export function getBatteryValueForQuickAction(actionId: string): number | null {
    return BATTERY_ACTION_VALUE_MAP[actionId] ?? null;
}

export async function registerNotificationCategories(): Promise<void> {
    // Some test environments provide partial notification mocks.
    if (typeof Notifications.setNotificationCategoryAsync !== 'function') {
        return;
    }

    await Notifications.setNotificationCategoryAsync(BATTERY_CHECKIN_CATEGORY_ID, [
        {
            identifier: BATTERY_CHECKIN_ACTION_LOW,
            buttonTitle: 'Low',
        },
        {
            identifier: BATTERY_CHECKIN_ACTION_OKAY,
            buttonTitle: 'Okay',
        },
        {
            identifier: BATTERY_CHECKIN_ACTION_HIGH,
            buttonTitle: 'High',
        },
    ]);
}
