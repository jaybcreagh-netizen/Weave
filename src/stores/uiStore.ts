import { create } from 'zustand';
import { type Archetype, type Interaction } from '../components/types';

interface InteractionModal {
  isOpen: boolean;
  mode: 'log' | 'plan' | null;
}

interface UIStore {
  selectedFriendId: string | null;
  interactionModal: InteractionModal;
  archetypeModal: Archetype | null;
  timelineViewOpen: boolean;
  timelineInteractions: Interaction[];
  timelinePage: number;
  timelineHasMore: boolean;
  timelineFriendId: string | null;
  calendarViewOpen: boolean;
  calendarSelectedFriendId: string | null;
  calendarSelectedDate: Date | null;
  
  setSelectedFriendId: (id: string | null) => void;
  openInteractionModal: (mode: 'log' | 'plan') => void;
  closeInteractionModal: () => void;
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
}

export const useUIStore = create<UIStore>((set, get) => ({
  selectedFriendId: null,
  interactionModal: { isOpen: false, mode: null },
  archetypeModal: null,
  timelineViewOpen: false,
  timelineInteractions: [],
  timelinePage: 0,
  timelineHasMore: true,
  timelineFriendId: null,
  calendarViewOpen: false,
  calendarSelectedFriendId: null,
  calendarSelectedDate: null,
  
  setSelectedFriendId: (id) => set({ selectedFriendId: id }),
  openInteractionModal: (mode) => set({ interactionModal: { isOpen: true, mode } }),
  closeInteractionModal: () => set({ interactionModal: { isOpen: false, mode: null } }),
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
}));