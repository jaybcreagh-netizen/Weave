import React, { useEffect, useState, useRef } from 'react';

import { HomeWidgetGrid, WidgetGridItem } from '@/modules/home/components/widgets/HomeWidgetGrid';
import { SocialSeasonWidgetV2 } from '@/modules/home/components/widgets/widgets/SocialSeasonWidgetV2';
import { YourEnergyWidget } from '@/modules/home/components/widgets/widgets/YourEnergyWidget';
import { TodaysFocusWidgetV2 } from '@/modules/home/components/widgets/widgets/TodaysFocusWidgetV2';
import { ReflectionReadyWidget } from '@/modules/home/components/widgets/widgets/ReflectionReadyWidget';
import { useTheme } from '@/shared/hooks/useTheme';
import { ReflectionReadyPrompt } from '@/modules/reflection/components/WeeklyReflection/ReflectionReadyPrompt';
import { YearInMoonsModal } from '@/modules/intelligence';
import { useUserProfile } from '@/modules/auth';
import { notificationStore } from '@/modules/notifications';
import { getUserAccountAge } from '@/modules/notifications';
import { useTutorial } from '@/shared/context/TutorialContext';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import { isSameWeek } from 'date-fns';

/**
 * The home tab component.
 * Displays a grid of widgets and handles modals for social battery check-ins and weekly reflections.
 */
export function HomeTab() {
    const { profile, updateProfile } = useUserProfile();
    const {
        openWeeklyReflection,
        isReflectionPromptOpen,
        openReflectionPrompt,
        closeReflectionPrompt,
        isSocialBatterySheetOpen,
        openSocialBatterySheet
    } = useGlobalUI();
    const theme = useTheme();
    // const colors = theme?.colors || {}; // Unused
    const [showYearInMoons, setShowYearInMoons] = useState(false);
    const [isWidgetVisible, setIsWidgetVisible] = useState(false);

    // Mounted state and timeout refs to prevent race conditions
    const isMountedRef = useRef(true);
    const batteryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const reflectionPromptTimerRef = useRef<NodeJS.Timeout | null>(null);
    const moonsTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Tutorial state - check if QuickWeave tutorial is done
    const { hasPerformedQuickWeave } = useTutorial();

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (batteryTimerRef.current) clearTimeout(batteryTimerRef.current);
            if (reflectionPromptTimerRef.current) clearTimeout(reflectionPromptTimerRef.current);
            if (moonsTimerRef.current) clearTimeout(moonsTimerRef.current);
        };
    }, []);

    // Check if user should be prompted for battery check-in
    useEffect(() => {
        if (!profile) return;
        const isEnabled = profile.batteryCheckinEnabled ?? true;
        if (!isEnabled) return;

        const checkEligibility = async () => {
            if (hasPerformedQuickWeave) return true;
            const age = await getUserAccountAge();
            return age !== null && age >= 3;
        };

        checkEligibility().then(isEligible => {
            if (!isEligible) return;

            const lastCheckin = profile.socialBatteryLastCheckin;
            if (!lastCheckin) {
                console.log('[Home] No last check-in found, showing battery sheet');
                batteryTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        openSocialBatterySheet();
                    }
                }, 600);
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const lastCheckinDate = new Date(lastCheckin);
            lastCheckinDate.setHours(0, 0, 0, 0);

            const needsCheckin = lastCheckinDate < today;
            console.log(`[Home] Battery Check-in Status: Last=${lastCheckinDate.toDateString()}, Today=${today.toDateString()}, Needs=${needsCheckin}`);

            if (needsCheckin) {
                batteryTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        openSocialBatterySheet();
                    }
                }, 600);
            }
        });
    }, [profile, hasPerformedQuickWeave]);

    // Check if weekly reflection should be shown
    useEffect(() => {
        const checkWeeklyReflection = async () => {
            if (!profile) return;

            const lastDate = await notificationStore.getLastReflectionDate();
            const isDue = !lastDate || !isSameWeek(lastDate, new Date(), { weekStartsOn: 0 });

            const accountAge = await getUserAccountAge();
            const meetsGracePeriod = accountAge !== null && accountAge >= 3;

            const today = new Date();
            const currentDay = today.getDay();
            const isSunday = currentDay === 0;
            const isMonday = currentDay === 1;

            const widgetVisible = isDue && meetsGracePeriod && (isSunday || isMonday);
            setIsWidgetVisible(widgetVisible);

            if (!isDue || !meetsGracePeriod || !isSunday) return;

            const reflectionDay = profile.reflectionDay ?? 0;
            const autoShow = profile.reflectionAutoShow ?? true;
            const lastSnoozed = profile.reflectionLastSnoozed;

            let isSnoozed = false;
            if (lastSnoozed) {
                const snoozeUntil = new Date(lastSnoozed);
                snoozeUntil.setDate(snoozeUntil.getDate() + 1);
                snoozeUntil.setHours(9, 0, 0, 0);
                isSnoozed = today < snoozeUntil;
            }

            if (currentDay === reflectionDay && autoShow && !isSnoozed) {
                reflectionPromptTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current && !isSocialBatterySheetOpen && !isReflectionPromptOpen) {
                        openReflectionPrompt();
                    }
                }, 2000);
            }
        };

        checkWeeklyReflection();
    }, [profile, isSocialBatterySheetOpen]);

    const handleReflectionStart = () => {
        closeReflectionPrompt();
        setTimeout(() => {
            openWeeklyReflection();
        }, 500);
    };

    const handleReflectionRemindLater = async () => {
        closeReflectionPrompt();
        if (profile) {
            await updateProfile({
                reflectionLastSnoozed: Date.now(),
            });
        }
    };

    const widgets: WidgetGridItem[] = [
        {
            id: 'todays-focus',
            component: TodaysFocusWidgetV2,
            config: {
                id: 'todays-focus',
                type: 'todays-focus',
                fullWidth: true,
            },
            position: 0,
            visible: true,
        },
        {
            id: 'social-season',
            component: SocialSeasonWidgetV2,
            config: {
                id: 'social-season',
                type: 'social-season',
                fullWidth: true,
            },
            position: 1,
            visible: true,
        },
        {
            id: 'your-energy',
            component: YourEnergyWidget,
            config: {
                id: 'your-energy',
                type: 'your-energy',
                fullWidth: true,
            },
            position: 2,
            visible: true,
        },
        {
            id: 'reflection-ready',
            component: ReflectionReadyWidget,
            config: {
                id: 'reflection-ready',
                type: 'reflection-ready',
                fullWidth: true,
            },
            props: {
                onPress: openReflectionPrompt,
            },
            position: 3,
            visible: isWidgetVisible,
        },
    ];

    return (
        <>
            <HomeWidgetGrid widgets={widgets} />

            <ReflectionReadyPrompt
                isVisible={isReflectionPromptOpen}
                onStart={handleReflectionStart}
                onRemindLater={handleReflectionRemindLater}
                onDismiss={closeReflectionPrompt}
            />

            <YearInMoonsModal
                isOpen={showYearInMoons}
                onClose={() => setShowYearInMoons(false)}
            />
        </>
    );
}
