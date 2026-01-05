/**
 * NudgesSheetWrapper
 * 
 * Wrapper component that only initializes the heavy useSuggestions/usePlans hooks
 * when the sheet is visible. This prevents the hooks from running (and triggering
 * DB writes for tracking) when the sheet is closed.
 */

import React from 'react'
import { NudgesSheet } from '@/modules/insights'
import { useSuggestions, usePlans } from '@/modules/interactions'

interface NudgesSheetWrapperProps {
    isVisible: boolean
    onClose: () => void
}

function NudgesSheetContent({ onClose }: { onClose: () => void }) {
    const { suggestions, dismissSuggestion } = useSuggestions()
    const { intentions } = usePlans()

    return (
        <NudgesSheet
            isVisible={true}
            suggestions={suggestions}
            intentions={intentions}
            onClose={onClose}
            onAct={() => onClose()}
            onLater={(id) => dismissSuggestion(id, 1)}
            onIntentionPress={() => onClose()}
        />
    )
}

export function NudgesSheetWrapper({ isVisible, onClose }: NudgesSheetWrapperProps) {
    // Only mount the content (and its hooks) when visible
    if (!isVisible) return null

    return <NudgesSheetContent onClose={onClose} />
}
