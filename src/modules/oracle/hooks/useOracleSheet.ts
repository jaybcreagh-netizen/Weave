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
    initialQuestion?: string
    journalContent?: string // Content to seed the Oracle context with
    lensContext?: {
        archetype: string
        title: string
        reasoning: string
    }
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
