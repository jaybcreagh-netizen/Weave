import * as Network from 'expo-network'
import { Q } from '@nozbe/watermelondb'

import { database } from '@/db'
import UserProfile from '@/db/models/UserProfile'
import { llmService } from '@/shared/services/llm'

export type IntelligenceEntitlement = 'free' | 'paid'

export type RemoteAIUnavailableReason =
    | 'disabled_by_user'
    | 'disclosure_required'
    | 'offline'
    | 'provider_unavailable'

type ProfileSnapshot = Pick<
    UserProfile,
    | 'aiFeaturesEnabled'
    | 'aiJournalAnalysisEnabled'
    | 'aiOracleEnabled'
    | 'aiDisclosureAcknowledgedAt'
    | 'proactiveInsightsEnabled'
    | 'insightFrequency'
    | 'suppressedInsightRules'
>

export interface IntelligenceCapabilityInput {
    profile?: ProfileSnapshot | null
    entitlement?: IntelligenceEntitlement
    isOnline?: boolean
    hasRemoteProvider?: boolean
}

export interface IntelligenceCapabilities {
    entitlement: IntelligenceEntitlement
    isOnline: boolean
    hasRemoteProvider: boolean
    localIntelligenceEnabled: boolean
    masterAIOptInEnabled: boolean
    journalRemoteOptInEnabled: boolean
    oracleRemoteOptInEnabled: boolean
    remoteEnrichmentEnabled: boolean
    remoteJournalAnalysisEnabled: boolean
    actionExtractionEnabled: boolean
    threadExtractionEnabled: boolean
    oracleChatEnabled: boolean
    guidedReflectionEnabled: boolean
    backgroundAIEnabled: boolean
    localProactiveInsightsEnabled: boolean
    proactiveInsightsEnabled: boolean
    remoteInsightPolishEnabled: boolean
    showOracleEntryPoints: boolean
    remoteUnavailableReason?: RemoteAIUnavailableReason
}

// Subscription tier is retained for future pricing work, but AI access is user-controlled during beta.
const DEFAULT_ENTITLEMENT: IntelligenceEntitlement = 'paid'
class IntelligenceCapabilitiesService {
    async getCapabilities(
        input: IntelligenceCapabilityInput = {}
    ): Promise<IntelligenceCapabilities> {
        const isOnline = typeof input.isOnline === 'boolean'
            ? input.isOnline
            : await this.resolveOnlineState()

        return this.resolveCapabilities({
            ...input,
            isOnline,
        })
    }

    async getCapabilitiesForCurrentProfile(
        input: Omit<IntelligenceCapabilityInput, 'profile'> = {}
    ): Promise<IntelligenceCapabilities> {
        const profile = await this.getCurrentProfile()
        return this.getCapabilities({
            ...input,
            profile,
        })
    }

    resolveCapabilities(
        input: IntelligenceCapabilityInput = {}
    ): IntelligenceCapabilities {
        const profile = input.profile ?? null
        const entitlement = input.entitlement ?? DEFAULT_ENTITLEMENT
        const isOnline = input.isOnline ?? true
        const hasRemoteProvider = input.hasRemoteProvider ?? llmService.isAvailable()

        const hasDisclosure = !!profile?.aiDisclosureAcknowledgedAt
        const masterToggleEnabled = profile?.aiFeaturesEnabled === true
        const masterAIOptInEnabled = masterToggleEnabled && hasDisclosure
        const journalRemoteOptInEnabled = masterAIOptInEnabled && profile?.aiJournalAnalysisEnabled !== false
        const oracleRemoteOptInEnabled = masterAIOptInEnabled && profile?.aiOracleEnabled !== false
        const localProactiveInsightsEnabled = profile?.proactiveInsightsEnabled !== false
        const backgroundProactiveInsightsEnabled =
            localProactiveInsightsEnabled && profile?.insightFrequency !== 'on_demand'

        let remoteUnavailableReason: RemoteAIUnavailableReason | undefined

        if (masterToggleEnabled && !hasDisclosure) {
            remoteUnavailableReason = 'disclosure_required'
        } else if (!masterAIOptInEnabled) {
            remoteUnavailableReason = 'disabled_by_user'
        } else if (!isOnline) {
            remoteUnavailableReason = 'offline'
        } else if (!hasRemoteProvider) {
            remoteUnavailableReason = 'provider_unavailable'
        }

        const remoteEnrichmentEnabled =
            remoteUnavailableReason === undefined && masterAIOptInEnabled

        return {
            entitlement,
            isOnline,
            hasRemoteProvider,
            localIntelligenceEnabled: true,
            masterAIOptInEnabled,
            journalRemoteOptInEnabled,
            oracleRemoteOptInEnabled,
            remoteEnrichmentEnabled,
            remoteJournalAnalysisEnabled: remoteEnrichmentEnabled && journalRemoteOptInEnabled,
            actionExtractionEnabled: remoteEnrichmentEnabled && journalRemoteOptInEnabled,
            threadExtractionEnabled: remoteEnrichmentEnabled && journalRemoteOptInEnabled,
            oracleChatEnabled: remoteEnrichmentEnabled && oracleRemoteOptInEnabled,
            guidedReflectionEnabled: remoteEnrichmentEnabled && oracleRemoteOptInEnabled,
            backgroundAIEnabled: remoteEnrichmentEnabled,
            localProactiveInsightsEnabled,
            proactiveInsightsEnabled: backgroundProactiveInsightsEnabled,
            remoteInsightPolishEnabled:
                remoteEnrichmentEnabled &&
                oracleRemoteOptInEnabled &&
                localProactiveInsightsEnabled,
            showOracleEntryPoints: remoteEnrichmentEnabled && oracleRemoteOptInEnabled,
            remoteUnavailableReason,
        }
    }

    private async getCurrentProfile(): Promise<ProfileSnapshot | null> {
        try {
            const profiles = await database
                .get<UserProfile>('user_profile')
                .query(Q.take(1))
                .fetch()

            return profiles[0] ?? null
        } catch {
            return null
        }
    }

    private async resolveOnlineState(): Promise<boolean> {
        try {
            const networkState = await Network.getNetworkStateAsync()
            if (!networkState.isConnected) return false
            return networkState.isInternetReachable !== false
        } catch {
            return true
        }
    }
}

export const intelligenceCapabilitiesService = new IntelligenceCapabilitiesService()
