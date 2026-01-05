/**
 * useOracleSheet
 * 
 * Global Zustand store for controlling the Oracle sheet visibility and context.
 */

import { create } from 'zustand'

export type OracleContext = 'insights' | 'circle' | 'journal' | 'friend' | 'interaction' | 'default'

export interface OracleSheetParams {
    context?: OracleContext
    friendId?: string
    friendName?: string
    interactionId?: string
}

interface OracleSheetState {
    isOpen: boolean
    params: OracleSheetParams
    open: (params?: OracleSheetParams) => void
    close: () => void
}

export const useOracleSheet = create<OracleSheetState>((set) => ({
    isOpen: false,
    params: {},
    open: (params = {}) => set({ isOpen: true, params }),
    close: () => set({ isOpen: false, params: {} }),
}))
