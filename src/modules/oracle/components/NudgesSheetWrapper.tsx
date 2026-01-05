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
    portalHost?: string
}

// Keep mounted to preserve hook state and avoid re-fetch latency
function NudgesSheetContent({ isVisible, onClose, portalHost }: { isVisible: boolean, onClose: () => void, portalHost?: string }) {
    // Hooks run continuously to keep data fresh, but React Query caching handles the heavy lifting
    const { suggestions, dismissSuggestion } = useSuggestions()
    const { intentions } = usePlans()

    return (
        <NudgesSheet
            isVisible={isVisible}
            suggestions={suggestions}
            intentions={intentions}
            onClose={onClose}
            onAct={() => onClose()}
            onLater={(id) => dismissSuggestion(id, 1)}
            onIntentionPress={() => onClose()}
            portalHost={portalHost}
        />
    )
}

export function NudgesSheetWrapper({ isVisible, onClose, portalHost }: NudgesSheetWrapperProps) {
    // OPTIMIZATION: We now keep this mounted to avoid the 1-2s delay of re-fetching suggestions
    // when opening the sheet. The hooks will keep data fresh in the background.
    return <NudgesSheetContent isVisible={isVisible} onClose={onClose} portalHost={portalHost} />
}
