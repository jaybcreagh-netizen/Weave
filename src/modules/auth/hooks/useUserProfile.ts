import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { useAuth } from '../context/AuthContext';
import { useObservableState } from 'observable-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SocialBatteryService } from '../services/social-battery.service';
import {
    intelligenceCapabilitiesService,
    type IntelligenceCapabilities,
} from '@/modules/intelligence/services/intelligence-capabilities.service';

/**
 * Hook to get the current user profile reactively
 */
export function useUserProfile() {
    const { user } = useAuth();
    const [intelligenceCapabilities, setIntelligenceCapabilities] = useState<IntelligenceCapabilities>(
        () => intelligenceCapabilitiesService.resolveCapabilities({
            profile: null,
            hasRemoteProvider: false,
            isOnline: true,
        })
    );

    // Observe relevant columns so profile field updates trigger a render immediately.
    const profiles$ = useMemo(() => {
        return database.get<UserProfile>('user_profile')
            .query()
            .observeWithColumns([
                'user_id',
                'ai_features_enabled',
                'ai_journal_analysis_enabled',
                'ai_oracle_enabled',
                'ai_disclosure_acknowledged_at',
                'proactive_insights_enabled',
                'insight_frequency',
                'reflection_last_snoozed',
                'reflection_day',
                'reflection_auto_show',
            ]);
    }, []);

    const profiles = useObservableState(profiles$, []);
    const profile = useMemo(() => {
        if (profiles.length === 0) return null;

        if (user) {
            const match = profiles.find(p => p.userId === user.id);
            if (match) return match;
        }

        return profiles[0];
    }, [profiles, user]);

    // Side effect: If we found a profile but it doesn't have the userId set yet, claim it.
    // This handles the first login after local-only usage.
    useEffect(() => {
        if (user && profile && !profile.userId) {
            // Claim this local profile for the authenticated user
            console.log('[useUserProfile] Claiming local profile for user:', user.id);
            database.write(async () => {
                await profile.update((p: any) => {
                    p.userId = user.id;
                });
            }).catch(err => console.warn('[useUserProfile] Failed to claim profile:', err));
        }
    }, [user, profile]);

    useEffect(() => {
        let isCancelled = false;

        intelligenceCapabilitiesService.getCapabilities({ profile }).then(capabilities => {
            if (!isCancelled) {
                setIntelligenceCapabilities(capabilities);
            }
        }).catch(() => {
            if (!isCancelled) {
                setIntelligenceCapabilities(
                    intelligenceCapabilitiesService.resolveCapabilities({ profile })
                );
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [
        profile?.aiFeaturesEnabled,
        profile?.aiJournalAnalysisEnabled,
        profile?.aiOracleEnabled,
        profile?.aiDisclosureAcknowledgedAt,
        profile?.proactiveInsightsEnabled,
        profile?.insightFrequency,
    ]);

    const submitBatteryCheckin = useCallback(async (value: number, note?: string) => {
        if (!user) return;
        await SocialBatteryService.submitCheckin(user.id, value, note);
    }, [user]);

    const updateProfile = useCallback(async (updates: Partial<{
        reflectionLastSnoozed: number;
        reflectionDay: number;
        reflectionAutoShow: boolean;
    }>) => {
        if (!profile) return;
        await database.write(async () => {
            await profile.update((p: any) => {
                Object.assign(p, updates);
            });
        });
    }, [profile]);

    return {
        profile,
        isLoading: user && !profile,
        submitBatteryCheckin,
        updateProfile,
        intelligenceCapabilities,
    };
}
