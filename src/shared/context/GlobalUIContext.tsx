import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { type Archetype, type Interaction, type InteractionCategory } from '@/shared/types/legacy-types';
import { type Milestone } from '@/modules/gamification';
import { type BadgeUnlock } from '@/modules/gamification';
import { type AchievementUnlockData } from '@/modules/gamification';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { type Memory } from '@/modules/journal';
import { type DigestItem } from '@/modules/notifications';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { UIEventBus } from '@/shared/services/ui-event-bus';

export interface MemoryMomentData {
    memory: Memory;
    entry: JournalEntry | WeeklyReflection;
    friendName?: string;
    friendId?: string;
}

interface ToastData {
    message: string;
    friendName: string;
}

interface MicroReflectionData {
    friendId: string;
    friendName: string;
    activityId: string;
    activityLabel: string;
    interactionId: string;
    friendArchetype?: string;
}

interface GlobalUIContextType {
    // Timeline / Friend View
    selectedFriendId: string | null;
    setSelectedFriendId: (id: string | null) => void;
    archetypeModal: Archetype | null;
    setArchetypeModal: (archetype: Archetype | null) => void;
    timelineViewOpen: boolean;
    openTimelineView: () => void;
    closeTimelineView: () => void;
    timelineInteractions: Interaction[];
    setTimelineInteractions: (interactions: Interaction[]) => void;
    addTimelineInteractions: (interactions: Interaction[]) => void;
    timelinePage: number;
    setTimelinePage: (page: number) => void;
    timelineHasMore: boolean;
    setTimelineHasMore: (hasMore: boolean) => void;
    resetTimeline: () => void;
    timelineFriendId: string | null;

    // Calendar
    calendarViewOpen: boolean;
    openCalendarView: (friendId?: string | null) => void;
    closeCalendarView: () => void;
    calendarSelectedFriendId: string | null;
    calendarSelectedDate: Date | null;
    setCalendarSelectedDate: (date: Date | null) => void;

    // Debug
    showDebugScore: boolean;
    toggleShowDebugScore: () => void;

    // Quick Weave
    isQuickWeaveOpen: boolean;
    isQuickWeaveClosing: boolean;
    quickWeaveFriendId: string | null;
    quickWeaveCenterPoint: { x: number; y: number } | null;
    quickWeaveActivities: InteractionCategory[];
    openQuickWeave: (friendId: string, centerPoint: { x: number; y: number }, activities: InteractionCategory[]) => void;
    closeQuickWeave: () => void;
    _finishClosingQuickWeave: () => void; // Internal cleanup

    // Nurture / Interaction Feedback
    justNurturedFriendId: string | null;
    setJustNurturedFriendId: (id: string | null) => void;
    justLoggedInteractionId: string | null;
    setJustLoggedInteractionId: (id: string | null) => void;

    // Toast
    toastData: ToastData | null;
    showToast: (message: string, friendName: string) => void;
    hideToast: () => void;

    // Micro Reflection
    microReflectionData: MicroReflectionData | null;
    showMicroReflectionSheet: (data: MicroReflectionData) => void;
    hideMicroReflectionSheet: () => void;

    // Gamification
    milestoneCelebrationData: Milestone | null;
    showMilestoneCelebration: (milestone: Milestone) => void;
    hideMilestoneCelebration: () => void;
    badgeUnlockQueue: BadgeUnlock[];
    queueBadgeUnlocks: (unlocks: BadgeUnlock[]) => void;
    dismissBadgeUnlock: () => void;
    achievementUnlockQueue: AchievementUnlockData[];
    queueAchievementUnlocks: (unlocks: AchievementUnlockData[]) => void;
    dismissAchievementUnlock: () => void;
    isTrophyCabinetOpen: boolean;
    openTrophyCabinet: () => void;
    closeTrophyCabinet: () => void;

    // Theme
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    setDarkMode: (isDark: boolean) => void;

    // Memory
    memoryMomentData: MemoryMomentData | null;
    openMemoryMoment: (data: MemoryMomentData) => void;
    closeMemoryMoment: () => void;

    // Digest
    digestSheetVisible: boolean;
    digestItems: DigestItem[];
    openDigestSheet: (items: DigestItem[]) => void;
    closeDigestSheet: () => void;

    // Reflection Prompt
    isReflectionPromptOpen: boolean;
    openReflectionPrompt: () => void;
    closeReflectionPrompt: () => void;
    lastReflectionPromptDate: number | null;
    markReflectionPromptShown: () => void;

    // Popups (Social Battery & Weekly Reflection)
    activePopup: 'social-battery' | 'weekly-reflection' | null;
    isSocialBatterySheetOpen: boolean;
    openSocialBatterySheet: () => void;
    closeSocialBatterySheet: () => void;
    isWeeklyReflectionOpen: boolean;
    isWeeklyReflectionPending: boolean;
    setWeeklyReflectionPending: (pending: boolean) => void;
    openWeeklyReflection: () => void;
    closeWeeklyReflection: () => void;

    // Post Weave Rating
    isPostWeaveRatingOpen: boolean;
    postWeaveRatingTargetId: string | null;
    openPostWeaveRating: (interactionId?: string) => void;
    closePostWeaveRating: () => void;
}

const GlobalUIContext = createContext<GlobalUIContextType | null>(null);

export function GlobalUIProvider({ children }: { children: ReactNode }) {
    // --- State Definitions ---

    // Timeline
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
    const [archetypeModal, setArchetypeModal] = useState<Archetype | null>(null);
    const [timelineViewOpen, setTimelineViewOpen] = useState(false);
    const [timelineInteractions, setTimelineInteractions] = useState<Interaction[]>([]);
    const [timelinePage, setTimelinePage] = useState(0);
    const [timelineHasMore, setTimelineHasMore] = useState(true);

    // Calendar
    const [calendarViewOpen, setCalendarViewOpen] = useState(false);
    const [calendarSelectedFriendId, setCalendarSelectedFriendId] = useState<string | null>(null);
    const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null);

    // Debug
    const [showDebugScore, setShowDebugScore] = useState(false);

    // Quick Weave
    const [isQuickWeaveOpen, setIsQuickWeaveOpen] = useState(false);
    const [isQuickWeaveClosing, setIsQuickWeaveClosing] = useState(false);
    const [quickWeaveFriendId, setQuickWeaveFriendId] = useState<string | null>(null);
    const [quickWeaveCenterPoint, setQuickWeaveCenterPoint] = useState<{ x: number; y: number } | null>(null);
    const [quickWeaveActivities, setQuickWeaveActivities] = useState<InteractionCategory[]>([]);

    // Nurture
    const [justNurturedFriendId, setJustNurturedFriendId] = useState<string | null>(null);
    const [justLoggedInteractionId, setJustLoggedInteractionId] = useState<string | null>(null);

    // Toast
    const [toastData, setToastData] = useState<ToastData | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout>();

    // Micro Reflection
    const [microReflectionData, setMicroReflectionData] = useState<MicroReflectionData | null>(null);

    // Gamification
    const [milestoneCelebrationData, setMilestoneCelebrationData] = useState<Milestone | null>(null);
    const [badgeUnlockQueue, setBadgeUnlockQueue] = useState<BadgeUnlock[]>([]);
    const [achievementUnlockQueue, setAchievementUnlockQueue] = useState<AchievementUnlockData[]>([]);
    const [isTrophyCabinetOpen, setIsTrophyCabinetOpen] = useState(false);

    // Theme
    const [isDarkMode, setIsDarkMode] = useState(false); // Default to light, could sync with system

    // Memory
    const [memoryMomentData, setMemoryMomentData] = useState<MemoryMomentData | null>(null);

    // Digest
    const [digestSheetVisible, setDigestSheetVisible] = useState(false);
    const [digestItems, setDigestItems] = useState<DigestItem[]>([]);

    // Reflection Prompt
    const [isReflectionPromptOpen, setIsReflectionPromptOpen] = useState(false);
    const [lastReflectionPromptDate, setLastReflectionPromptDate] = useState<number | null>(null);

    // Popups
    const [popupQueue, setPopupQueue] = useState<('social-battery' | 'weekly-reflection')[]>([]);
    const [activePopup, setActivePopup] = useState<'social-battery' | 'weekly-reflection' | null>(null);
    const [isSocialBatterySheetOpen, setIsSocialBatterySheetOpen] = useState(false);
    const [isWeeklyReflectionOpen, setIsWeeklyReflectionOpen] = useState(false);
    const [isWeeklyReflectionPending, setIsWeeklyReflectionPending] = useState(false);

    // Post Weave Rating
    const [isPostWeaveRatingOpen, setIsPostWeaveRatingOpen] = useState(false);
    const [postWeaveRatingTargetId, setPostWeaveRatingTargetId] = useState<string | null>(null);

    // --- Actions ---

    // Timeline
    const openTimelineView = useCallback(() => setTimelineViewOpen(true), []);
    const closeTimelineView = useCallback(() => setTimelineViewOpen(false), []);
    const addTimelineInteractions = useCallback((newInteractions: Interaction[]) => {
        setTimelineInteractions(prev => [...prev, ...newInteractions]);
    }, []);
    const resetTimeline = useCallback(() => {
        setTimelineInteractions([]);
        setTimelinePage(0);
        setTimelineHasMore(true);
    }, []);

    // Calendar
    const openCalendarView = useCallback((friendId: string | null = null) => {
        setCalendarViewOpen(true);
        setCalendarSelectedFriendId(friendId);
    }, []);
    const closeCalendarView = useCallback(() => {
        setCalendarViewOpen(false);
        setCalendarSelectedFriendId(null);
        setCalendarSelectedDate(null);
    }, []);

    // Debug
    const toggleShowDebugScore = useCallback(() => setShowDebugScore(prev => !prev), []);

    // Quick Weave
    const openQuickWeave = useCallback((friendId: string, centerPoint: { x: number; y: number }, activities: InteractionCategory[]) => {
        setIsQuickWeaveOpen(true);
        setIsQuickWeaveClosing(false);
        setQuickWeaveFriendId(friendId);
        setQuickWeaveCenterPoint(centerPoint);
        setQuickWeaveActivities(activities);

        trackEvent(AnalyticsEvents.QUICK_WEAVE_OPENED, {
            friendId,
            activity_count: activities.length
        });
    }, []);

    const closeQuickWeave = useCallback(() => setIsQuickWeaveClosing(true), []);

    const _finishClosingQuickWeave = useCallback(() => {
        setIsQuickWeaveOpen(false);
        setIsQuickWeaveClosing(false);
        setQuickWeaveFriendId(null);
        setQuickWeaveCenterPoint(null);
        setQuickWeaveActivities([]);
    }, []);

    // Toast
    const showToast = useCallback((message: string, friendName: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastData({ message, friendName });
        toastTimeoutRef.current = setTimeout(() => {
            setToastData(null);
        }, 3500);
    }, []);
    const hideToast = useCallback(() => setToastData(null), []);

    // Micro Reflection
    const showMicroReflectionSheet = useCallback((data: MicroReflectionData) => {
        setMicroReflectionData(data);
        // Force close Quick Weave overlay to prevent "double modal" visual
        setIsQuickWeaveOpen(false);
        setIsQuickWeaveClosing(false);
    }, []);
    const hideMicroReflectionSheet = useCallback(() => setMicroReflectionData(null), []);

    // Gamification
    const showMilestoneCelebration = useCallback((milestone: Milestone) => setMilestoneCelebrationData(milestone), []);
    const hideMilestoneCelebration = useCallback(() => setMilestoneCelebrationData(null), []);

    const queueBadgeUnlocks = useCallback((unlocks: BadgeUnlock[]) => {
        setBadgeUnlockQueue(prev => [...prev, ...unlocks]);
    }, []);
    const dismissBadgeUnlock = useCallback(() => {
        setBadgeUnlockQueue(prev => prev.slice(1));
    }, []);

    const queueAchievementUnlocks = useCallback((unlocks: AchievementUnlockData[]) => {
        setAchievementUnlockQueue(prev => [...prev, ...unlocks]);
    }, []);
    const dismissAchievementUnlock = useCallback(() => {
        setAchievementUnlockQueue(prev => prev.slice(1));
    }, []);

    const openTrophyCabinet = useCallback(() => setIsTrophyCabinetOpen(true), []);
    const closeTrophyCabinet = useCallback(() => setIsTrophyCabinetOpen(false), []);

    // Theme
    const toggleDarkMode = useCallback(() => setIsDarkMode(prev => !prev), []);
    const setDarkMode = useCallback((isDark: boolean) => setIsDarkMode(isDark), []);

    // Memory
    const openMemoryMoment = useCallback((data: MemoryMomentData) => setMemoryMomentData(data), []);
    const closeMemoryMoment = useCallback(() => setMemoryMomentData(null), []);

    // Digest
    const openDigestSheet = useCallback((items: DigestItem[]) => {
        setDigestSheetVisible(true);
        setDigestItems(items);
    }, []);
    const closeDigestSheet = useCallback(() => {
        setDigestSheetVisible(false);
        setDigestItems([]);
    }, []);

    // Reflection Prompt
    const markReflectionPromptShown = useCallback(() => setLastReflectionPromptDate(Date.now()), []);
    const openReflectionPrompt = useCallback(() => setIsReflectionPromptOpen(true), []);
    const closeReflectionPrompt = useCallback(() => setIsReflectionPromptOpen(false), []);

    // Post Weave Rating
    const openPostWeaveRating = useCallback((interactionId?: string) => {
        setIsPostWeaveRatingOpen(true);
        setPostWeaveRatingTargetId(interactionId || null);
    }, []);
    const closePostWeaveRating = useCallback(() => {
        setIsPostWeaveRatingOpen(false);
        setPostWeaveRatingTargetId(null);
    }, []);

    // --- Popup Coordinator Logic ---

    const requestPopup = useCallback((type: 'social-battery' | 'weekly-reflection') => {
        setActivePopup((currentActive) => {
            if (!currentActive) {
                // Nothing active, open immediately
                if (type === 'social-battery') setIsSocialBatterySheetOpen(true);
                if (type === 'weekly-reflection') setIsWeeklyReflectionOpen(true);
                return type;
            }

            if (currentActive === type) return currentActive; // Already open

            // If we are here, something else is open. Queue it.
            setPopupQueue(prev => prev.includes(type) ? prev : [...prev, type]);
            return currentActive;
        });
    }, []);

    const closePopup = useCallback((type: 'social-battery' | 'weekly-reflection') => {
        if (type === 'social-battery') setIsSocialBatterySheetOpen(false);
        if (type === 'weekly-reflection') setIsWeeklyReflectionOpen(false);

        setActivePopup((currentActive) => {
            if (currentActive === type) {
                // We just closed the active one. Check queue.
                // We need to use a timeout/effect to trigger the next one to allow animation to complete
                // But state updates here are batched. 
                // Let's modify queue in a useEffect? Or just use a timeout here since we are in a callback.

                // We can't access 'popupQueue' fresh state easily without ref or functional update, 
                // but we need to trigger the side effect of opening the next one.

                // Simpler: Just clear active. A `useEffect` will watch `activePopup` and `popupQueue`.
                return null;
            }
            return currentActive;
        });
    }, []);

    // Effect to process queue when activePopup becomes null
    React.useEffect(() => {
        if (activePopup === null && popupQueue.length > 0) {
            const timer = setTimeout(() => {
                const next = popupQueue[0];
                setPopupQueue(prev => prev.slice(1));

                setActivePopup(next);
                if (next === 'social-battery') setIsSocialBatterySheetOpen(true);
                if (next === 'weekly-reflection') setIsWeeklyReflectionOpen(true);
            }, 500); // Wait for close animation
            return () => clearTimeout(timer);
        }
    }, [activePopup, popupQueue]);


    const openSocialBatterySheet = useCallback(() => requestPopup('social-battery'), [requestPopup]);
    const closeSocialBatterySheet = useCallback(() => closePopup('social-battery'), [closePopup]);
    const openWeeklyReflection = useCallback(() => requestPopup('weekly-reflection'), [requestPopup]);
    const closeWeeklyReflection = useCallback(() => closePopup('weekly-reflection'), [closePopup]);

    // --- Subscribe to UIEventBus for imperative triggers from non-React code ---
    useEffect(() => {
        const unsubscribe = UIEventBus.subscribe((event) => {
            switch (event.type) {
                case 'OPEN_DIGEST_SHEET':
                    setDigestSheetVisible(true);
                    setDigestItems(event.items);
                    break;
                case 'OPEN_WEEKLY_REFLECTION':
                    requestPopup('weekly-reflection');
                    break;
                case 'OPEN_SOCIAL_BATTERY_SHEET':
                    requestPopup('social-battery');
                    break;
                case 'OPEN_MEMORY_MOMENT':
                    setMemoryMomentData(event.data);
                    break;
                case 'SHOW_TOAST':
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastData({ message: event.message, friendName: event.friendName || '' });
                    toastTimeoutRef.current = setTimeout(() => setToastData(null), 3500);
                    break;
            }
        });

        return unsubscribe;
    }, [requestPopup]);


    const value: GlobalUIContextType = {
        selectedFriendId, setSelectedFriendId,
        archetypeModal, setArchetypeModal,
        timelineViewOpen, openTimelineView, closeTimelineView,
        timelineInteractions, setTimelineInteractions, addTimelineInteractions,
        timelinePage, setTimelinePage, timelineHasMore, setTimelineHasMore, resetTimeline,
        timelineFriendId: selectedFriendId, // This was mapped in store

        calendarViewOpen, openCalendarView, closeCalendarView,
        calendarSelectedFriendId, calendarSelectedDate, setCalendarSelectedDate,

        showDebugScore, toggleShowDebugScore,

        isQuickWeaveOpen, isQuickWeaveClosing, quickWeaveFriendId, quickWeaveCenterPoint, quickWeaveActivities,
        openQuickWeave, closeQuickWeave, _finishClosingQuickWeave,

        justNurturedFriendId, setJustNurturedFriendId,
        justLoggedInteractionId, setJustLoggedInteractionId,

        toastData, showToast, hideToast,

        microReflectionData, showMicroReflectionSheet, hideMicroReflectionSheet,

        milestoneCelebrationData, showMilestoneCelebration, hideMilestoneCelebration,
        badgeUnlockQueue, queueBadgeUnlocks, dismissBadgeUnlock,
        achievementUnlockQueue, queueAchievementUnlocks, dismissAchievementUnlock,
        isTrophyCabinetOpen, openTrophyCabinet, closeTrophyCabinet,

        isDarkMode, toggleDarkMode, setDarkMode,

        memoryMomentData, openMemoryMoment, closeMemoryMoment,

        digestSheetVisible, digestItems, openDigestSheet, closeDigestSheet,

        isReflectionPromptOpen, openReflectionPrompt, closeReflectionPrompt,
        lastReflectionPromptDate, markReflectionPromptShown,

        activePopup,
        isSocialBatterySheetOpen, openSocialBatterySheet, closeSocialBatterySheet,
        isWeeklyReflectionOpen, openWeeklyReflection, closeWeeklyReflection,
        isWeeklyReflectionPending, setWeeklyReflectionPending: setIsWeeklyReflectionPending,

        isPostWeaveRatingOpen, postWeaveRatingTargetId, openPostWeaveRating, closePostWeaveRating
    };

    return (
        <GlobalUIContext.Provider value={value}>
            {children}
        </GlobalUIContext.Provider>
    );
}

export function useGlobalUI() {
    const context = useContext(GlobalUIContext);
    if (!context) {
        throw new Error('useGlobalUI must be used within a GlobalUIProvider');
    }
    return context;
}
