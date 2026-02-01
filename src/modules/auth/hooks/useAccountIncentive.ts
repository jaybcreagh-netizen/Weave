import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { useAuth } from '../context/AuthContext';

const SNOOZE_KEY = 'account_incentive_snoozed_until';
const PERMANENT_DISMISS_KEY = 'account_incentive_permanently_dismissed';
const FIRST_LAUNCH_KEY = 'app_first_launch_date';
const SNOOZE_DAYS = 3;
const MIN_FRIENDS = 3;
const MIN_DAYS = 3;

interface UseAccountIncentiveResult {
    shouldShow: boolean;
    /** Temporarily dismiss (snooze for 3 days) */
    dismiss: () => Promise<void>;
    /** Permanently dismiss - never show again */
    dismissPermanently: () => Promise<void>;
    isLoading: boolean;
}

/**
 * Hook to manage the "Create Account" incentive prompt for non-authenticated users.
 * 
 * Trigger Conditions:
 * - User is NOT authenticated
 * - User has ≥3 friends in local DB
 * - User has been using the app for ≥3 days
 * 
 * Snooze: 3 days after dismiss
 */
export function useAccountIncentive(): UseAccountIncentiveResult {
    const { user } = useAuth();
    const [shouldShow, setShouldShow] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkEligibility();
    }, [user]);

    const checkEligibility = async () => {
        setIsLoading(true);
        try {
            // 1. If user is authenticated, never show
            if (user) {
                setShouldShow(false);
                setIsLoading(false);
                return;
            }

            // 2. Check if permanently dismissed
            const permanentlyDismissed = await AsyncStorage.getItem(PERMANENT_DISMISS_KEY);
            if (permanentlyDismissed === 'true') {
                setShouldShow(false);
                setIsLoading(false);
                return;
            }

            // 3. Check snooze
            const snoozedUntil = await AsyncStorage.getItem(SNOOZE_KEY);
            if (snoozedUntil) {
                const snoozeDate = parseInt(snoozedUntil, 10);
                if (Date.now() < snoozeDate) {
                    setShouldShow(false);
                    setIsLoading(false);
                    return;
                }
            }

            // 4. Check first launch date (≥3 days)
            let firstLaunch = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
            if (!firstLaunch) {
                // First time checking - set it now
                firstLaunch = Date.now().toString();
                await AsyncStorage.setItem(FIRST_LAUNCH_KEY, firstLaunch);
            }
            const daysSinceFirstLaunch = (Date.now() - parseInt(firstLaunch, 10)) / (1000 * 60 * 60 * 24);
            if (daysSinceFirstLaunch < MIN_DAYS) {
                setShouldShow(false);
                setIsLoading(false);
                return;
            }

            // 5. Check friend count (≥3)
            const friends = await database.get<Friend>('friends').query().fetch();
            if (friends.length < MIN_FRIENDS) {
                setShouldShow(false);
                setIsLoading(false);
                return;
            }

            // All conditions met!
            setShouldShow(true);
        } catch (error) {
            console.warn('[useAccountIncentive] Error checking eligibility:', error);
            setShouldShow(false);
        } finally {
            setIsLoading(false);
        }
    };

    const dismiss = async () => {
        const snoozeDate = Date.now() + (SNOOZE_DAYS * 24 * 60 * 60 * 1000);
        await AsyncStorage.setItem(SNOOZE_KEY, snoozeDate.toString());
        setShouldShow(false);
    };

    const dismissPermanently = async () => {
        await AsyncStorage.setItem(PERMANENT_DISMISS_KEY, 'true');
        setShouldShow(false);
    };

    return { shouldShow, dismiss, dismissPermanently, isLoading };
}
