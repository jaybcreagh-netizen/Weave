import { create } from 'zustand';
import { type Archetype, type Interaction, type InteractionCategory } from '@/shared/types/legacy-types';
import { type Milestone } from '@/modules/gamification';
import { type BadgeUnlock } from '@/modules/gamification';
import { type AchievementUnlockData } from '@/modules/gamification';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { type Memory } from '@/modules/journal';
import { type DigestItem } from '@/modules/notifications';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

interface MemoryMomentData {
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

interface UIStore {
  selectedFriendId: string | null;
  archetypeModal: Archetype | null;
  timelineViewOpen: boolean;
  timelineInteractions: Interaction[];
  timelinePage: number;
  timelineHasMore: boolean;
  timelineFriendId: string | null;
  calendarViewOpen: boolean;
  calendarSelectedFriendId: string | null;
  calendarSelectedDate: Date | null;
  showDebugScore: boolean;
  isQuickWeaveOpen: boolean;
  isQuickWeaveClosing: boolean; // Added this
  quickWeaveFriendId: string | null;
  quickWeaveCenterPoint: { x: number; y: number } | null;
  quickWeaveActivities: InteractionCategory[]; // Smart-ordered activities
  justNurturedFriendId: string | null;
  justLoggedInteractionId: string | null;
  toastData: ToastData | null;
  microReflectionData: MicroReflectionData | null;
  milestoneCelebrationData: Milestone | null;
  badgeUnlockQueue: BadgeUnlock[];
  achievementUnlockQueue: AchievementUnlockData[];
  isDarkMode: boolean;
  isTrophyCabinetOpen: boolean;
  memoryMomentData: MemoryMomentData | null;
  lastReflectionPromptDate: number | null;
  markReflectionPromptShown: () => void;

  isWeeklyReflectionOpen: boolean;
  isWeeklyReflectionPending: boolean;
  isSocialBatterySheetOpen: boolean;
  openSocialBatterySheet: () => void;
  openWeeklyReflection: () => void;
  closeWeeklyReflection: () => void;
  setWeeklyReflectionPending: (pending: boolean) => void;

  closeSocialBatterySheet: () => void;

  isReflectionPromptOpen: boolean;
  openReflectionPrompt: () => void;
  closeReflectionPrompt: () => void;

  isPostWeaveRatingOpen: boolean;
  postWeaveRatingTargetId: string | null;
  openPostWeaveRating: (interactionId?: string) => void;
  closePostWeaveRating: () => void;


  setSelectedFriendId: (id: string | null) => void;
  setArchetypeModal: (archetype: Archetype | null) => void;
  openTimelineView: () => void;
  closeTimelineView: () => void;
  setTimelineInteractions: (interactions: Interaction[]) => void;
  addTimelineInteractions: (interactions: Interaction[]) => void;
  setTimelinePage: (page: number) => void;
  setTimelineHasMore: (hasMore: boolean) => void;
  resetTimeline: () => void;
  openCalendarView: (friendId?: string | null) => void;
  closeCalendarView: () => void;
  setCalendarSelectedDate: (date: Date | null) => void;
  toggleShowDebugScore: () => void;
  openQuickWeave: (friendId: string, centerPoint: { x: number; y: number }, activities: InteractionCategory[]) => void;
  closeQuickWeave: () => void; // Added this
  _finishClosingQuickWeave: () => void;
  setJustNurturedFriendId: (id: string | null) => void;
  setJustLoggedInteractionId: (id: string | null) => void;
  showToast: (message: string, friendName: string) => void;
  hideToast: () => void;
  showMicroReflectionSheet: (data: MicroReflectionData) => void;
  hideMicroReflectionSheet: () => void;
  showMilestoneCelebration: (milestone: Milestone) => void;
  hideMilestoneCelebration: () => void;
  queueBadgeUnlocks: (unlocks: BadgeUnlock[]) => void;
  queueAchievementUnlocks: (unlocks: AchievementUnlockData[]) => void;
  dismissBadgeUnlock: () => void;
  dismissAchievementUnlock: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  openTrophyCabinet: () => void;
  closeTrophyCabinet: () => void;
  openMemoryMoment: (data: MemoryMomentData) => void;
  closeMemoryMoment: () => void;

  digestSheetVisible: boolean;
  digestItems: DigestItem[];
  openDigestSheet: (items: DigestItem[]) => void;
  closeDigestSheet: () => void;

  // Popup Coordinator
  activePopup: 'social-battery' | 'weekly-reflection' | null;
  popupQueue: ('social-battery' | 'weekly-reflection')[];
  requestPopup: (type: 'social-battery' | 'weekly-reflection') => void;
  closePopup: (type: 'social-battery' | 'weekly-reflection') => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  selectedFriendId: null,
  archetypeModal: null,
  timelineViewOpen: false,
  timelineInteractions: [],
  timelinePage: 0,
  timelineHasMore: true,
  timelineFriendId: null,
  calendarViewOpen: false,
  calendarSelectedFriendId: null,
  calendarSelectedDate: null,
  showDebugScore: false,
  isQuickWeaveOpen: false,
  isQuickWeaveClosing: false, // Added this
  quickWeaveFriendId: null,
  quickWeaveCenterPoint: null,
  quickWeaveActivities: [],
  justNurturedFriendId: null,
  justLoggedInteractionId: null,
  toastData: null,
  microReflectionData: null,
  milestoneCelebrationData: null,
  badgeUnlockQueue: [],
  achievementUnlockQueue: [],
  isDarkMode: false,
  isTrophyCabinetOpen: false,
  isWeeklyReflectionOpen: false,
  isWeeklyReflectionPending: false,
  isReflectionPromptOpen: false,
  isSocialBatterySheetOpen: false,
  memoryMomentData: null, // Moved here for consistency

  lastReflectionPromptDate: null,
  markReflectionPromptShown: () => set({ lastReflectionPromptDate: Date.now() }),

  openReflectionPrompt: () => set({ isReflectionPromptOpen: true }),
  closeReflectionPrompt: () => set({ isReflectionPromptOpen: false }),

  isPostWeaveRatingOpen: false,
  postWeaveRatingTargetId: null,
  openPostWeaveRating: (interactionId) => set({
    isPostWeaveRatingOpen: true,
    postWeaveRatingTargetId: interactionId || null
  }),
  closePostWeaveRating: () => set({
    isPostWeaveRatingOpen: false,
    postWeaveRatingTargetId: null
  }),

  // Popup Coordinator State
  activePopup: null,
  popupQueue: [],

  requestPopup: (type) => {
    const state = get();

    // If no popup is active, open immediately
    if (!state.activePopup) {
      if (type === 'social-battery') {
        set({
          activePopup: 'social-battery',
          isSocialBatterySheetOpen: true
        });
      } else if (type === 'weekly-reflection') {
        set({
          activePopup: 'weekly-reflection',
          isWeeklyReflectionOpen: true
        });
      }
      return;
    }

    // If a popup is already active
    if (state.activePopup === type) return; // Already open

    // Logic: Social Battery takes priority over Weekly Reflection
    // If Social Battery is requested but Weekly Reflection is open:
    // We queue Social Battery? Or do we force it? 
    // The requirement is "prevent springing on user". 
    // Queuing is safer.

    // Check if already in queue
    if (state.popupQueue.includes(type)) return;

    // Special Case: If Social Battery is requested and Weekly Reflection is the active one,
    // we could potentially close Reflection and show Battery, but that's aggressive.
    // Better to just queue it.

    // However, if we want strict ordering on launch (Battery FIRST), 
    // and both are requested almost simultaneously:
    // 1. requestPopup('weekly-reflection') -> opens
    // 2. requestPopup('social-battery') -> current logic would queue it.

    // To fix the "Sunday Launch" issue where we want Battery THEN Reflection:
    // If we are currently showing Reflection, and Battery comes in...
    // ideally we shouldn't have shown Reflection yet. But we can't control the order of calls easily.

    // If 'social-battery' is requested and 'weekly-reflection' is active:
    // Close Reflection (temporarily), show Battery, queue Reflection?
    // That seems too complex/glitchy.

    // Simple Queue:
    set((state) => ({
      popupQueue: [...state.popupQueue, type]
    }));
  },

  closePopup: (type) => {
    // Close the specific popup UI
    if (type === 'social-battery') {
      set({ isSocialBatterySheetOpen: false });
    } else if (type === 'weekly-reflection') {
      set({ isWeeklyReflectionOpen: false });
    }

    // If this was the active popup, clear it and check queue
    const state = get();
    if (state.activePopup === type) {
      set({ activePopup: null });

      // Check queue after a small delay to allow animation
      if (state.popupQueue.length > 0) {
        setTimeout(() => {
          const next = state.popupQueue[0];
          const remaining = state.popupQueue.slice(1);

          set({ popupQueue: remaining });
          get().requestPopup(next); // Re-trigger open logic
        }, 500);
      }
    }
  },

  openSocialBatterySheet: () => get().requestPopup('social-battery'),

  closeSocialBatterySheet: () => get().closePopup('social-battery'),

  setWeeklyReflectionPending: (pending) => set({ isWeeklyReflectionPending: pending }),

  openWeeklyReflection: () => get().requestPopup('weekly-reflection'),

  closeWeeklyReflection: () => get().closePopup('weekly-reflection'),

  setSelectedFriendId: (id) => set({ selectedFriendId: id }),
  setArchetypeModal: (archetype) => set({ archetypeModal: archetype }),
  openTimelineView: () => set({ timelineViewOpen: true }),
  closeTimelineView: () => set({ timelineViewOpen: false }),
  setTimelineInteractions: (interactions) => set({ timelineInteractions: interactions }),
  addTimelineInteractions: (interactions) => set((state) => ({
    timelineInteractions: [...state.timelineInteractions, ...interactions]
  })),
  setTimelinePage: (page) => set({ timelinePage: page }),
  setTimelineHasMore: (hasMore) => set({ timelineHasMore: hasMore }),
  resetTimeline: () => set((state) => ({
    timelineInteractions: [],
    timelinePage: 0,
    timelineHasMore: true,
    timelineFriendId: state.selectedFriendId
  })),
  openCalendarView: (friendId = null) => set({ calendarViewOpen: true, calendarSelectedFriendId: friendId }),
  closeCalendarView: () => set({ calendarViewOpen: false, calendarSelectedFriendId: null, calendarSelectedDate: null }),
  setCalendarSelectedDate: (date) => set({ calendarSelectedDate: date }),
  toggleShowDebugScore: () => set((state) => ({ showDebugScore: !state.showDebugScore })),
  openQuickWeave: (friendId, centerPoint, activities) => {
    set({
      isQuickWeaveOpen: true,
      isQuickWeaveClosing: false,
      quickWeaveFriendId: friendId,
      quickWeaveCenterPoint: centerPoint,
      quickWeaveActivities: activities
    });
    trackEvent(AnalyticsEvents.QUICK_WEAVE_OPENED, {
      friendId,
      activity_count: activities.length
    });
  },

  // This just starts the closing animation
  closeQuickWeave: () => set({ isQuickWeaveClosing: true }),

  // This is called by the overlay after the animation finishes
  _finishClosingQuickWeave: () => set({
    isQuickWeaveOpen: false,
    quickWeaveFriendId: null,
    quickWeaveCenterPoint: null,
    quickWeaveActivities: [],
    isQuickWeaveClosing: false,
  }),

  setJustNurturedFriendId: (id) => set({ justNurturedFriendId: id }),
  setJustLoggedInteractionId: (id) => set({ justLoggedInteractionId: id }),

  showToast: (message, friendName) => {
    set({ toastData: { message, friendName } });
    setTimeout(() => {
      get().hideToast();
    }, 3500);
  },
  hideToast: () => set({ toastData: null }),

  showMicroReflectionSheet: (data) => set({
    microReflectionData: data,
    // Force close Quick Weave overlay to prevent "double modal" visual
    isQuickWeaveOpen: false,
    isQuickWeaveClosing: false,
  }),
  hideMicroReflectionSheet: () => set({ microReflectionData: null }),

  showMilestoneCelebration: (milestone) => set({ milestoneCelebrationData: milestone }),
  hideMilestoneCelebration: () => set({ milestoneCelebrationData: null }),

  queueBadgeUnlocks: (unlocks) => set((state) => ({
    badgeUnlockQueue: [...state.badgeUnlockQueue, ...unlocks],
  })),

  queueAchievementUnlocks: (unlocks) => set((state) => ({
    achievementUnlockQueue: [...state.achievementUnlockQueue, ...unlocks],
  })),

  dismissBadgeUnlock: () => set((state) => ({
    badgeUnlockQueue: state.badgeUnlockQueue.slice(1),
  })),

  dismissAchievementUnlock: () => set((state) => ({
    achievementUnlockQueue: state.achievementUnlockQueue.slice(1),
  })),

  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setDarkMode: (isDark) => set({ isDarkMode: isDark }),
  openTrophyCabinet: () => set({ isTrophyCabinetOpen: true }),
  closeTrophyCabinet: () => set({ isTrophyCabinetOpen: false }),

  openMemoryMoment: (data) => set({ memoryMomentData: data }),
  closeMemoryMoment: () => set({ memoryMomentData: null }),

  digestSheetVisible: false,
  digestItems: [],
  openDigestSheet: (items) => set({ digestSheetVisible: true, digestItems: items }),
  closeDigestSheet: () => set({ digestSheetVisible: false, digestItems: [] }),
}));