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
    insightContext?: {
        analysis: string
        pattern: string
        clarifyingQuestion: string
        userAnswer?: string
    }
}

import { OracleLensMode } from '../services/types'

interface OracleSheetState {
    isOpen: boolean
    activeMode: OracleLensMode | null
    params: OracleSheetParams
    open: (params?: OracleSheetParams) => void
    close: () => void
    setMode: (mode: OracleLensMode | null) => void
}

export const useOracleSheet = create<OracleSheetState>((set) => ({
    isOpen: false,
    activeMode: null,
    params: {},
    open: (params = {}) => set({
        isOpen: true,
        params,
        // If context is NOT 'journal', default to 'consultation' (standard chat)
        // If context IS 'journal', default to null (show Mode Selector)
        activeMode: params.context === 'journal' ? null : 'consultation'
    }),
    close: () => set({ isOpen: false, params: {}, activeMode: null }),
    setMode: (mode) => set({ activeMode: mode }),
}))
