import { intelligenceCapabilitiesService } from '../intelligence-capabilities.service'

describe('intelligenceCapabilitiesService', () => {
    const acknowledgedProfile = {
        aiFeaturesEnabled: true,
        aiJournalAnalysisEnabled: true,
        aiOracleEnabled: true,
        aiDisclosureAcknowledgedAt: Date.now(),
        proactiveInsightsEnabled: true,
        insightFrequency: 'biweekly' as const,
    }

    it('keeps local intelligence on when AI is fully disabled', () => {
        const capabilities = intelligenceCapabilitiesService.resolveCapabilities({
            profile: {
                ...acknowledgedProfile,
                aiFeaturesEnabled: false,
            },
            isOnline: false,
            hasRemoteProvider: true,
        })

        expect(capabilities.localIntelligenceEnabled).toBe(true)
        expect(capabilities.remoteEnrichmentEnabled).toBe(false)
        expect(capabilities.remoteUnavailableReason).toBe('disabled_by_user')
        expect(capabilities.actionExtractionEnabled).toBe(false)
        expect(capabilities.localProactiveInsightsEnabled).toBe(true)
        expect(capabilities.remoteInsightPolishEnabled).toBe(false)
    })

    it('enables remote journal and oracle features when opted in and available', () => {
        const capabilities = intelligenceCapabilitiesService.resolveCapabilities({
            profile: acknowledgedProfile,
            isOnline: true,
            hasRemoteProvider: true,
        })

        expect(capabilities.remoteEnrichmentEnabled).toBe(true)
        expect(capabilities.remoteJournalAnalysisEnabled).toBe(true)
        expect(capabilities.oracleChatEnabled).toBe(true)
        expect(capabilities.showOracleEntryPoints).toBe(true)
        expect(capabilities.remoteInsightPolishEnabled).toBe(true)
    })

    it('turns remote features off while offline without disabling local intelligence', () => {
        const capabilities = intelligenceCapabilitiesService.resolveCapabilities({
            profile: acknowledgedProfile,
            isOnline: false,
            hasRemoteProvider: true,
        })

        expect(capabilities.localIntelligenceEnabled).toBe(true)
        expect(capabilities.remoteEnrichmentEnabled).toBe(false)
        expect(capabilities.remoteUnavailableReason).toBe('offline')
        expect(capabilities.threadExtractionEnabled).toBe(false)
        expect(capabilities.oracleChatEnabled).toBe(false)
        expect(capabilities.remoteInsightPolishEnabled).toBe(false)
    })

    it('keeps remote AI user-controlled even if a free entitlement is passed during beta', () => {
        const capabilities = intelligenceCapabilitiesService.resolveCapabilities({
            profile: acknowledgedProfile,
            entitlement: 'free',
            isOnline: true,
            hasRemoteProvider: true,
        })

        expect(capabilities.localIntelligenceEnabled).toBe(true)
        expect(capabilities.remoteEnrichmentEnabled).toBe(true)
        expect(capabilities.remoteUnavailableReason).toBeUndefined()
        expect(capabilities.proactiveInsightsEnabled).toBe(true)
        expect(capabilities.localProactiveInsightsEnabled).toBe(true)
    })

    it('requires disclosure acknowledgement before remote AI is allowed', () => {
        const capabilities = intelligenceCapabilitiesService.resolveCapabilities({
            profile: {
                ...acknowledgedProfile,
                aiDisclosureAcknowledgedAt: undefined,
            },
            isOnline: true,
            hasRemoteProvider: true,
        })

        expect(capabilities.masterAIOptInEnabled).toBe(false)
        expect(capabilities.remoteEnrichmentEnabled).toBe(false)
        expect(capabilities.remoteUnavailableReason).toBe('disclosure_required')
    })

    it('keeps local proactive insights on when frequency is on-demand but disables background runs', () => {
        const capabilities = intelligenceCapabilitiesService.resolveCapabilities({
            profile: {
                ...acknowledgedProfile,
                insightFrequency: 'on_demand',
            },
            isOnline: true,
            hasRemoteProvider: true,
        })

        expect(capabilities.localProactiveInsightsEnabled).toBe(true)
        expect(capabilities.proactiveInsightsEnabled).toBe(false)
        expect(capabilities.remoteInsightPolishEnabled).toBe(true)
    })
})
