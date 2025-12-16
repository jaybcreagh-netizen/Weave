import { create } from 'zustand';
import { InteractionCategory } from '@/shared/types/legacy-types';

interface QuickWeaveState {
    isOpen: boolean;
    isClosing: boolean;
    friendId: string | null;
    centerPoint: { x: number; y: number } | null;
    activities: InteractionCategory[];

    // Actions
    openQuickWeave: (friendId: string, centerPoint: { x: number; y: number }, activities: InteractionCategory[]) => void;
    closeQuickWeave: () => void;
    finishClosing: () => void;
}

export const useQuickWeaveStore = create<QuickWeaveState>((set) => ({
    isOpen: false,
    isClosing: false,
    friendId: null,
    centerPoint: null,
    activities: [],

    openQuickWeave: (friendId, centerPoint, activities) => set({
        isOpen: true,
        isClosing: false,
        friendId,
        centerPoint,
        activities,
    }),

    closeQuickWeave: () => set((state) => {
        // Only trigger close if currently open
        if (!state.isOpen) return {};
        return { isClosing: true };
    }),

    finishClosing: () => set({
        isOpen: false,
        isClosing: false,
        friendId: null,
        centerPoint: null,
        activities: [],
    }),
}));
