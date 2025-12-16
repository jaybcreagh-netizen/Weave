import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent, AnalyticsEvents, setUserProperties } from '@/shared/services/analytics.service';

interface TutorialState {
    // Onboarding completion flags
    hasCompletedOnboarding: boolean;
    hasAddedFirstFriend: boolean;
    hasSeenQuickWeaveIntro: boolean;
    hasPerformedQuickWeave: boolean;
    hasSeenIntentionIntro: boolean;
    hasSetIntention: boolean;
    hasSeenPlanIntro: boolean;
    hasCreatedPlan: boolean;
    hasSeenTodaysFocus: boolean;
    hasSeenSocialBattery: boolean;
    hasSeenInsightsTab: boolean;
}

interface TutorialContextType extends TutorialState {
    // Loading state
    isLoaded: boolean;

    // Actions
    completeOnboarding: () => Promise<void>;
    markFirstFriendAdded: () => Promise<void>;
    markQuickWeaveIntroSeen: () => Promise<void>;
    markQuickWeavePerformed: () => Promise<void>;
    markIntentionIntroSeen: () => Promise<void>;
    markIntentionSet: () => Promise<void>;
    markPlanIntroSeen: () => Promise<void>;
    markPlanCreated: () => Promise<void>;
    markTodaysFocusSeen: () => Promise<void>;
    markSocialBatterySeen: () => Promise<void>;
    markInsightsTabSeen: () => Promise<void>;

    // Utilities
    resetTutorials: () => Promise<void>;
    loadTutorialState: () => Promise<void>;
}

const STORAGE_KEY = '@weave_tutorial_state';

const defaultState: TutorialState = {
    hasCompletedOnboarding: false,
    hasAddedFirstFriend: false,
    hasSeenQuickWeaveIntro: false,
    hasPerformedQuickWeave: false,
    hasSeenIntentionIntro: false,
    hasSetIntention: false,
    hasSeenPlanIntro: false,
    hasCreatedPlan: false,
    hasSeenTodaysFocus: false,
    hasSeenSocialBattery: false,
    hasSeenInsightsTab: false,
};

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<TutorialState>(defaultState);
    const [isLoaded, setIsLoaded] = useState(false);

    // Persist helper
    const persistState = useCallback(async (updates: Partial<TutorialState>) => {
        try {
            const newState = { ...state, ...updates };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            setState(newState);
        } catch (error) {
            console.error('Failed to persist tutorial state:', error);
        }
    }, [state]);

    // Load state on mount
    const loadTutorialState = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setState(prev => ({ ...prev, ...parsed }));
            }
            setIsLoaded(true);
        } catch (error) {
            console.error('Failed to load tutorial state:', error);
            setIsLoaded(true);
        }
    }, []);

    // Auto-load on mount
    useEffect(() => {
        loadTutorialState();
    }, [loadTutorialState]);

    // Actions
    const completeOnboarding = useCallback(async () => {
        await persistState({ hasCompletedOnboarding: true });
        trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED);
        setUserProperties({ onboarding_completed: true });
    }, [persistState]);

    const markFirstFriendAdded = useCallback(async () => {
        await persistState({ hasAddedFirstFriend: true });
    }, [persistState]);

    const markQuickWeaveIntroSeen = useCallback(async () => {
        await persistState({ hasSeenQuickWeaveIntro: true });
    }, [persistState]);

    const markQuickWeavePerformed = useCallback(async () => {
        await persistState({ hasPerformedQuickWeave: true });
    }, [persistState]);

    const markIntentionIntroSeen = useCallback(async () => {
        await persistState({ hasSeenIntentionIntro: true });
    }, [persistState]);

    const markIntentionSet = useCallback(async () => {
        await persistState({ hasSetIntention: true });
    }, [persistState]);

    const markPlanIntroSeen = useCallback(async () => {
        await persistState({ hasSeenPlanIntro: true });
    }, [persistState]);

    const markPlanCreated = useCallback(async () => {
        await persistState({ hasCreatedPlan: true });
    }, [persistState]);

    const markTodaysFocusSeen = useCallback(async () => {
        await persistState({ hasSeenTodaysFocus: true });
    }, [persistState]);

    const markSocialBatterySeen = useCallback(async () => {
        await persistState({ hasSeenSocialBattery: true });
    }, [persistState]);

    const markInsightsTabSeen = useCallback(async () => {
        await persistState({ hasSeenInsightsTab: true });
    }, [persistState]);

    const resetTutorials = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setState(defaultState);
        } catch (error) {
            console.error('Failed to reset tutorial state:', error);
        }
    }, []);

    const value: TutorialContextType = {
        ...state,
        isLoaded,
        completeOnboarding,
        markFirstFriendAdded,
        markQuickWeaveIntroSeen,
        markQuickWeavePerformed,
        markIntentionIntroSeen,
        markIntentionSet,
        markPlanIntroSeen,
        markPlanCreated,
        markTodaysFocusSeen,
        markSocialBatterySeen,
        markInsightsTabSeen,
        resetTutorials,
        loadTutorialState,
    };

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
}

export function useTutorial() {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
}
