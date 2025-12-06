import { create } from 'zustand';
import { type Archetype, type Interaction, type InteractionCategory } from '@/components/types';
import { type Milestone } from '@/modules/gamification';
import { type BadgeUnlock } from '@/modules/gamification';
import { type AchievementUnlockData } from '@/modules/gamification';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { type Memory } from '@/modules/journal/services/journal-context-engine';
import { type DigestItem } from '@/modules/notifications/services/channels/evening-digest';

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

  isWeeklyReflectionOpen: boolean;
  isSocialBatterySheetOpen: boolean;
  openSocialBatterySheet: () => void;
  closeSocialBatterySheet: () => void;

  openWeeklyReflection: () => void;
  closeWeeklyReflection: () => void;

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
  isSocialBatterySheetOpen: false,

  openSocialBatterySheet: () => set({ isSocialBatterySheetOpen: true }),
  closeSocialBatterySheet: () => set({ isSocialBatterySheetOpen: false }),

  openWeeklyReflection: () => set({ isWeeklyReflectionOpen: true }),
  closeWeeklyReflection: () => set({ isWeeklyReflectionOpen: false }),

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
  openQuickWeave: (friendId, centerPoint, activities) => set({
    isQuickWeaveOpen: true,
    isQuickWeaveClosing: false,
    quickWeaveFriendId: friendId,
    quickWeaveCenterPoint: centerPoint,
    quickWeaveActivities: activities
  }),

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

  showMicroReflectionSheet: (data) => set({ microReflectionData: data }),
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

  memoryMomentData: null,
  openMemoryMoment: (data) => set({ memoryMomentData: data }),
  closeMemoryMoment: () => set({ memoryMomentData: null }),

  digestSheetVisible: false,
  digestItems: [],
  openDigestSheet: (items) => set({ digestSheetVisible: true, digestItems: items }),
  closeDigestSheet: () => set({ digestSheetVisible: false, digestItems: [] }),
}));