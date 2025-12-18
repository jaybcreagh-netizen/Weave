import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { useAuth } from '../context/AuthContext';
import { useObservableState } from 'observable-hooks';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { useCallback, useEffect } from 'react';
import { SocialBatteryService } from '../services/social-battery.service';
import { Q } from '@nozbe/watermelondb';

/**
 * Hook to get the current user profile reactively
 */
export function useUserProfile() {
    const { user } = useAuth();

    // Query all profiles (it's a singleton) to avoid Q.where pitfalls or Auth dependency blocking
    const profile$ = database.get<UserProfile>('user_profile')
        .query()
        .observe()
        .pipe(
            map(profiles => {
                if (profiles.length === 0) return null;

                // If we have a user, try to find their profile
                if (user) {
                    const match = profiles.find(p => p.userId === user.id);
                    if (match) return match;
                }

                // Fallback: Return the first profile (singleton local profile)
                return profiles[0];
            })
        );

    const profile = useObservableState(profile$, null);

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
    };
}
