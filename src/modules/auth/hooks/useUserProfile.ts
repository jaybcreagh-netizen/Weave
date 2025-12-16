import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { useAuth } from '../context/AuthContext';
import { useObservableState } from 'observable-hooks';
import { of } from 'rxjs';
import { useCallback } from 'react';
import { SocialBatteryService } from '../services/social-battery.service';

/**
 * Hook to get the current user profile reactively
 */
export function useUserProfile() {
    const { user } = useAuth();

    const profile$ = user
        ? database.get<UserProfile>('user_profile').findAndObserve(user.id)
        : of(null);

    const profile = useObservableState(profile$, null);

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
