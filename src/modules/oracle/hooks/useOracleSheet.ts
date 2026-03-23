/**
 * useOracleSheet
 * 
 * Global Zustand store for controlling the Oracle sheet visibility and context.
 */

import { useCallback } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { create } from 'zustand'
import { useUserProfile } from '@/modules/auth'
import type { RemoteAIUnavailableReason } from '@/modules/intelligence/services/intelligence-capabilities.service'

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

interface UseOracleSheetResult extends Omit<OracleSheetState, 'open'> {
    open: (params?: OracleSheetParams) => void
    canOpen: boolean
    remoteUnavailableReason?: RemoteAIUnavailableReason
}

export const useOracleSheetStore = create<OracleSheetState>((set) => ({
    isOpen: false,
    activeMode: null,
    params: {},
    open: (params = {}) => set({
        isOpen: true,
        params,
        // If context is NOT 'journal' or 'friend', default to 'consultation' (standard chat)
        // If context IS 'journal' or 'friend', default to null (show Mode Selector)
        activeMode: (params.context === 'journal' || params.context === 'friend') ? null : 'consultation'
    }),
    close: () => set({ isOpen: false, params: {}, activeMode: null }),
    setMode: (mode) => set({ activeMode: mode }),
}))

export function useOracleSheet(): UseOracleSheetResult {
    const { intelligenceCapabilities } = useUserProfile()
    const sheetState = useOracleSheetStore()

    const canOpen = intelligenceCapabilities.showOracleEntryPoints
    const remoteUnavailableReason = intelligenceCapabilities.remoteUnavailableReason

    const promptUnavailable = useCallback(() => {
        switch (remoteUnavailableReason) {
            case 'offline':
                Alert.alert(
                    'Oracle is offline',
                    'You are offline right now. Weave will keep working locally, and Oracle will be available again when you reconnect.'
                )
                return
            case 'provider_unavailable':
                Alert.alert(
                    'Oracle is unavailable',
                    'Remote AI is temporarily unavailable. You can keep using Weave normally and try Oracle again later.'
                )
                return
            case 'disclosure_required':
                Alert.alert(
                    'Enable AI Features',
                    'Read the AI disclosure in Settings to turn Oracle back on.',
                    [
                        { text: 'Not now', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => router.push('/ai-settings') },
                    ]
                )
                return
            case 'disabled_by_user':
            default:
                Alert.alert(
                    'Oracle is turned off',
                    'You can keep using Weave without AI, or re-enable Oracle in AI Settings whenever you want.',
                    [
                        { text: 'Not now', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => router.push('/ai-settings') },
                    ]
                )
        }
    }, [remoteUnavailableReason])

    const open = useCallback((params: OracleSheetParams = {}) => {
        if (!canOpen) {
            promptUnavailable()
            return
        }

        sheetState.open(params)
    }, [canOpen, promptUnavailable, sheetState])

    return {
        ...sheetState,
        open,
        canOpen,
        remoteUnavailableReason,
    }
}
