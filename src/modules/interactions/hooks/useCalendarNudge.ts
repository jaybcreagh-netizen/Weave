import { useState, useEffect } from 'react';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { getCalendarSettings, checkCalendarPermissions } from '../services/calendar.service';

export function useCalendarNudge() {
    const [shouldShow, setShouldShow] = useState(false);
    const { hasSeenCalendarNudge, markCalendarNudgeSeen, hasCompletedOnboarding } = useTutorialStore();

    useEffect(() => {
        async function check() {
            // Don't show during onboarding
            if (!hasCompletedOnboarding) return;

            // Don't show if already seen
            if (hasSeenCalendarNudge) return;

            const settings = await getCalendarSettings();
            const { granted } = await checkCalendarPermissions();

            // If already working, plain mark as seen without showing
            if (settings.enabled && granted) {
                markCalendarNudgeSeen();
                return;
            }

            // Otherwise, show nudge
            // Add a small delay so it doesn't pop up INSTANTLY on screen mount
            setTimeout(() => {
                setShouldShow(true);
            }, 2000);
        }

        check();
    }, [hasSeenCalendarNudge, hasCompletedOnboarding]);

    const dismiss = () => {
        setShouldShow(false);
        markCalendarNudgeSeen();
    };

    const onConnected = () => {
        setShouldShow(false);
        markCalendarNudgeSeen();
    };

    return { shouldShow, dismiss, onConnected };
}
