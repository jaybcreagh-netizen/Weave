import { create } from 'zustand';
import { type Archetype, type Interaction } from '../components/types';
import { type Milestone } from '../lib/milestone-tracker';

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
  justNurturedFriendId: string | null;
  toastData: ToastData | null;
  microReflectionData: MicroReflectionData | null;
  milestoneCelebrationData: Milestone | null;
  isDarkMode: boolean;

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
  openQuickWeave: (friendId: string, centerPoint: { x: number; y: number }) => void;
  closeQuickWeave: () => void; // Added this
  _finishClosingQuickWeave: () => void;
  setJustNurturedFriendId: (id: string | null) => void;
  showToast: (message: string, friendName: string) => void;
  hideToast: () => void;
  showMicroReflectionSheet: (data: MicroReflectionData) => void;
  hideMicroReflectionSheet: () => void;
  showMilestoneCelebration: (milestone: Milestone) => void;
  hideMilestoneCelebration: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
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
  justNurturedFriendId: null,
  toastData: null,
  microReflectionData: null,
  milestoneCelebrationData: null,
  isDarkMode: false,
  
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
  
  openQuickWeave: (friendId, centerPoint) => set({ 
    isQuickWeaveOpen: true, 
    isQuickWeaveClosing: false,
    quickWeaveFriendId: friendId, 
    quickWeaveCenterPoint: centerPoint 
  }),
  
  // This just starts the closing animation
  closeQuickWeave: () => set({ isQuickWeaveClosing: true }),

  // This is called by the overlay after the animation finishes
  _finishClosingQuickWeave: () => set({
    isQuickWeaveOpen: false,
    quickWeaveFriendId: null,
    quickWeaveCenterPoint: null,
    isQuickWeaveClosing: false,
  }),
  
  setJustNurturedFriendId: (id) => set({ justNurturedFriendId: id }),
  
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

  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setDarkMode: (isDark) => set({ isDarkMode: isDark }),
}));