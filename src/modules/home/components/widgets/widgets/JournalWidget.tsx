/**
 * JournalWidget
 * 
 * Dynamic dashboard widget that shows contextual journal prompts.
 * Integrates with the journal module's context engine and prompts.
 * 
 * States (priority order):
 * 1. Weekly Reflection Ready - Sunday/Monday if not yet completed
 * 2. Post-Weave Prompt - Meaningful weave logged in last 48h
 * 3. Memory Moment - Anniversary/throwback surfaced
 * 4. Journaling Nudge - 3+ days since last journal entry
 * 5. Default - General journaling prompt
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import {
    BookHeart,
    RefreshCw,
    BookOpen,
    Flame,
    Calendar,
    Users,
    Sparkles,
    type LucideIcon
} from 'lucide-react-native';
import { JournalIcon } from 'assets/icons/JournalIcon';
import { differenceInDays } from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { useAppSleeping } from '@/shared/hooks/useAppState';
import { UIEventBus } from '@/shared/services/ui-event-bus';
import * as Sentry from '@sentry/react-native';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import Interaction from '@/db/models/Interaction';
// FIX: Direct imports to avoid circular dependencies in barrel files
import {
    getRecentMeaningfulWeaves,
    getMemories,
    type Memory,
    type MeaningfulWeave
} from '@/modules/journal/services/journal-context-engine';
import { generateJournalPrompts, type JournalPrompt } from '@/modules/journal/services/journal-prompts';
// Static import to avoid dynamic import issues in production builds
import { hasCompletedReflectionForCurrentWeek } from '@/modules/reflection/services/weekly-reflection.service';

const WIDGET_CONFIG: HomeWidgetConfig = {
    id: 'journal',
    type: 'journal',
    title: 'Journal',
    minHeight: 120,
    fullWidth: true,
};

// ============================================================================
// TYPES
// ============================================================================

type WidgetState =
    | { type: 'weekly-reflection' }
    | { type: 'weekly-reflection-completed' }
    | { type: 'post-weave'; weave: MeaningfulWeave; prompt: JournalPrompt }
    | { type: 'memory'; memory: Memory }
    | { type: 'nudge'; daysSinceLastEntry: number }
    | { type: 'default'; prompt: JournalPrompt };

interface StatItem {
    icon: LucideIcon;
    getValue: () => Promise<number>;
    formatLabel: (value: number) => string;
}

// ============================================================================
// STATS DEFINITIONS
// ============================================================================

const STATS: StatItem[] = [
    {
        icon: BookOpen,
        getValue: async () => {
            try {
                return await database.get<JournalEntry>('journal_entries').query().fetchCount();
            } catch (error) {
                Sentry.addBreadcrumb({ category: 'journal-widget-stats', message: 'Entry count stat failed', level: 'error', data: { error: String(error) } });
                return 0;
            }
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'entry' : 'entries'}`,
    },
    {
        icon: Flame,
        getValue: async () => {
            try {
                // Calculate streak: consecutive days with completed weaves backwards from today
                // OPTIMIZED: Fetch all relevant interactions in one go instead of 30 queries
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Look back 30 days
                const lookbackWindow = 30 * 24 * 60 * 60 * 1000;
                const windowStart = today.getTime() - lookbackWindow;
                const windowEnd = today.getTime() + 24 * 60 * 60 * 1000; // Include today

                const interactions = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('status', 'completed'),
                        Q.where('interaction_date', Q.gte(windowStart)),
                        Q.where('interaction_date', Q.lt(windowEnd)),
                        Q.sortBy('interaction_date', 'desc')
                    )
                    .fetch();

                // Create a set of dates (YYYY-MM-DD) that have completed interactions
                const activeDates = new Set<string>();
                interactions.forEach(interaction => {
                    const date = new Date(interaction.interactionDate);
                    date.setHours(0, 0, 0, 0);
                    activeDates.add(date.toISOString().split('T')[0]);
                });

                let streak = 0;
                let checkDate = new Date(today);

                for (let i = 0; i < 30; i++) {
                    const dateStr = checkDate.toISOString().split('T')[0];
                    if (activeDates.has(dateStr)) {
                        streak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else {
                        // If today has no interaction yet, don't break streak if yesterday had one
                        // But if we are checking today (i===0) and it's missing, we allow it (streak continues from yesterday)
                        // However, standard streak logic usually implies "current streak ending today or yesterday".
                        // If i==0 (today) and no interaction, we check yesterday. 
                        // If yesterday is missing, streak is 0.
                        if (i === 0) {
                            checkDate.setDate(checkDate.getDate() - 1);
                            continue;
                        }
                        break;
                    }
                }

                return streak;
            } catch (error) {
                Sentry.addBreadcrumb({ category: 'journal-widget-stats', message: 'Streak stat failed', level: 'error', data: { error: String(error) } });
                return 0;
            }
        },
        formatLabel: (value) => `${value} day streak`,
    },
    {
        icon: Calendar,
        getValue: async () => {
            try {
                // Weeks active: from first interaction to now
                const firstInteraction = await database
                    .get<Interaction>('interactions')
                    .query(Q.sortBy('interaction_date', 'asc'), Q.take(1))
                    .fetch();

                if (firstInteraction.length === 0) return 0;

                const firstDate = new Date(firstInteraction[0].interactionDate);
                const now = new Date();

                // Safety check for date-fns function
                if (typeof differenceInDays !== 'function') {
                    Sentry.addBreadcrumb({ category: 'journal-widget-stats', message: 'differenceInDays is not a function', level: 'error' });
                    // Fallback calculation
                    const diffTime = Math.abs(now.getTime() - firstDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return Math.max(1, Math.floor(diffDays / 7));
                }

                const weeks = Math.floor(differenceInDays(now, firstDate) / 7);
                return Math.max(1, weeks);
            } catch (error) {
                Sentry.addBreadcrumb({ category: 'journal-widget-stats', message: 'Weeks active stat failed', level: 'error', data: { error: String(error) } });
                return 0;
            }
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'week' : 'weeks'} active`,
    },
    {
        icon: Users,
        getValue: async () => {
            try {
                // Count unique friends documented in journal entries via join table
                const joinEntries = await database
                    .get<JournalEntryFriend>('journal_entry_friends')
                    .query()
                    .fetch();

                const friendIds = new Set<string>();
                joinEntries.forEach((entry) => friendIds.add(entry.friendId));

                return friendIds.size;
            } catch (error) {
                Sentry.addBreadcrumb({ category: 'journal-widget-stats', message: 'Friends in story stat failed', level: 'error', data: { error: String(error) } });
                return 0;
            }
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'friend' : 'friends'} in your story`,
    },
    {
        icon: Sparkles,
        getValue: async () => {
            try {
                return await database.get<WeeklyReflection>('weekly_reflections').query().fetchCount();
            } catch (error) {
                Sentry.addBreadcrumb({ category: 'journal-widget-stats', message: 'Reflection count stat failed', level: 'error', data: { error: String(error) } });
                return 0;
            }
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'reflection' : 'reflections'}`,
    },
];

// General prompts for default state
const GENERAL_PROMPTS = [
    "What's one friendship moment from today you want to remember?",
    "Is there something you've been meaning to say to someone?",
    "What patterns are you noticing in your friendships lately?",
    "Who are you grateful for today, and why?",
    "How have your friendships changed over the past year?",
    "Which friendships give you energy? Which ones take it?",
    "When was the last time a friend really showed up for you?",
    "When was the last time you really showed up for a friend?",
];

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalWidget() {
    const { tokens, typography } = useTheme();
    const router = useRouter();

    const [widgetState, setWidgetState] = useState<WidgetState | null>(null);
    const [isWidgetStateLoading, setIsWidgetStateLoading] = useState(true);
    const [statValues, setStatValues] = useState<number[]>([]);
    const [statIndex, setStatIndex] = useState(0);
    const [promptKey, setPromptKey] = useState(0);
    const [forceDefaultPrompt, setForceDefaultPrompt] = useState(false);

    // Get the current stat config
    // Default to first stat if empty
    const currentStat = STATS[statIndex % STATS.length];
    const currentStatValue = statValues.length > 0 ? statValues[statIndex % statValues.length] : null;
    const StatIcon = currentStat.icon;

    // ... (getRandomGeneralPrompt and determineState remain the same) ...
    const getRandomGeneralPrompt = (): WidgetState => {
        const randomPrompt = GENERAL_PROMPTS[Math.floor(Math.random() * GENERAL_PROMPTS.length)];
        return {
            type: 'default',
            prompt: {
                id: 'general',
                question: randomPrompt,
                context: 'General prompt',
                type: 'general',
            }
        };
    };

    // Determine widget state based on priority
    const determineState = useCallback(async (): Promise<WidgetState> => {
        // If forceDefaultPrompt is set, skip all prioritization and show random prompt
        if (forceDefaultPrompt) {
            return getRandomGeneralPrompt();
        }

        // 1. Check Weekly Reflection (Sunday or Monday, not yet completed for target week)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const isSundayOrMonday = dayOfWeek === 0 || dayOfWeek === 1;

        if (isSundayOrMonday) {
            try {
                const hasReflectedThisWeek = await hasCompletedReflectionForCurrentWeek();
                if (!hasReflectedThisWeek) {
                    return { type: 'weekly-reflection' };
                }
            } catch (error) {
                console.warn('[JournalWidget] Error checking weekly reflection:', error);
            }
        }

        // 2. Check for meaningful weave in last 48h
        try {
            if (typeof getRecentMeaningfulWeaves === 'function') {
                const meaningfulWeaves = await getRecentMeaningfulWeaves(1, 48);
                if (meaningfulWeaves && meaningfulWeaves.length > 0) {
                    const weave = meaningfulWeaves[0];
                    const prompts = generateJournalPrompts({ type: 'weave', weave });
                    if (prompts && prompts.length > 0) {
                        return { type: 'post-weave', weave, prompt: prompts[0] };
                    }
                }
            }
        } catch (error) {
            console.warn('[JournalWidget] Error fetching meaningful weaves:', error);
        }

        // 3. Check for memories
        try {
            if (typeof getMemories === 'function') {
                const memories = await getMemories(1);
                if (memories && memories.length > 0) {
                    return { type: 'memory', memory: memories[0] };
                }
            }
        } catch (error) {
            console.warn('[JournalWidget] Error fetching memories:', error);
        }

        // 4. Check days since last journal entry (nudge if 3+ days)
        try {
            const lastEntry = await database
                .get<JournalEntry>('journal_entries')
                .query(Q.sortBy('created_at', 'desc'), Q.take(1))
                .fetch();

            if (lastEntry.length > 0) {
                const daysSince = differenceInDays(today, lastEntry[0].createdAt);
                if (daysSince >= 3) {
                    return { type: 'nudge', daysSinceLastEntry: daysSince };
                }
            } else {
                // No entries at all - nudge to start
                return { type: 'nudge', daysSinceLastEntry: -1 };
            }
        } catch (error) {
            console.warn('[JournalWidget] Error checking last entry:', error);
        }

        // 5. Default - general prompt
        return getRandomGeneralPrompt();
    }, [promptKey, forceDefaultPrompt]);

    // Pause stat cycling when app is sleeping to save battery
    const isSleeping = useAppSleeping();
    const isFocused = useIsFocused();

    // Use a ref for mounted state to survive effect re-runs and prevent race conditions
    const mountedRef = useRef(true);
    const loadIdRef = useRef(0);

    useEffect(() => {
        // Reset mounted state on each effect run
        mountedRef.current = true;
        const currentLoadId = ++loadIdRef.current;

        // Function to load main widget state (prompt)
        const loadWidgetState = async () => {
            setIsWidgetStateLoading(true);
            try {
                // Small delay to prioritize initial render
                await new Promise(resolve => setTimeout(resolve, 100));

                // Check if this load is still valid (not superseded by a newer load)
                if (currentLoadId !== loadIdRef.current) {
                    console.log('[JournalWidget] Load superseded, aborting');
                    return;
                }

                // Race against a timeout to prevent infinite loading
                const statePromise = determineState();
                let timeoutId: ReturnType<typeof setTimeout>;
                const timeoutPromise = new Promise<WidgetState>((resolve) => {
                    timeoutId = setTimeout(() => {
                        console.warn('[JournalWidget] State determination timed out, using fallback');
                        resolve(getRandomGeneralPrompt());
                    }, 3000); // 3s timeout
                });

                const state = await Promise.race([statePromise, timeoutPromise]);
                clearTimeout(timeoutId!);
                Sentry.addBreadcrumb({ category: 'journal-widget', message: `State resolved. type=${state.type}`, level: 'info' });

                // Check both mounted and load ID to ensure we should update state
                if (mountedRef.current && currentLoadId === loadIdRef.current) {
                    setWidgetState(state);
                }
            } catch (error) {
                Sentry.addBreadcrumb({ category: 'journal-widget', message: 'loadWidgetState caught error', level: 'error', data: { error: String(error) } });
                console.error('[JournalWidget] Error loading state:', error);
                if (mountedRef.current && currentLoadId === loadIdRef.current) {
                    setWidgetState(getRandomGeneralPrompt());
                }
            } finally {
                // Always clear loading state if this is still the active load
                if (mountedRef.current && currentLoadId === loadIdRef.current) {
                    setIsWidgetStateLoading(false);
                    Sentry.addBreadcrumb({ category: 'journal-widget', message: 'loadWidgetState complete, loading=false', level: 'info' });
                    console.timeEnd('JournalWidget.loadState');
                }
            }
        };

        // Function to load stats independently - DEFERRED
        const loadStats = async () => {
            try {
                // Defer stats loading to prioritize main content
                await new Promise(resolve => setTimeout(resolve, 2000));

                if (currentLoadId !== loadIdRef.current) return;

                const values = await Promise.all(STATS.map(s => s.getValue()));
                if (mountedRef.current && currentLoadId === loadIdRef.current) {
                    setStatValues(values);
                    setStatIndex(Math.floor(Math.random() * STATS.length));
                }
            } catch (error) {
                console.error('[JournalWidget] Error loading stats:', error);
                if (mountedRef.current && currentLoadId === loadIdRef.current) {
                    setStatValues(STATS.map(() => 0));
                }
            } finally {
                if (mountedRef.current && currentLoadId === loadIdRef.current) {
                    console.timeEnd('JournalWidget.loadStats');
                }
            }
        };

        loadWidgetState();
        loadStats();

        return () => {
            mountedRef.current = false;
        };
    }, [determineState, promptKey]); // Removed isFocused - it's not used as a gate and causes race conditions

    // Cycle stats every 5 seconds (only when visible)
    useEffect(() => {
        if (isWidgetStateLoading || isSleeping || !isFocused) return;

        const interval = setInterval(() => {
            setStatIndex((prev) => (prev + 1) % STATS.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [isWidgetStateLoading, isSleeping, isFocused]);

    // Handle widget tap
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (widgetState?.type === 'weekly-reflection') {
            UIEventBus.emit({ type: 'OPEN_WEEKLY_REFLECTION' });
        } else {
            router.push('/journal');
        }
    };

    // Handle refresh prompt - show a random general prompt, bypassing priority system
    const handleRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setForceDefaultPrompt(true);
        setPromptKey(prev => prev + 1);
    };

    // Get prompt text based on state
    const getPromptText = (): string => {
        if (!widgetState) return '';

        switch (widgetState.type) {
            case 'weekly-reflection':
                return 'Your weekly reflection is ready';
            case 'weekly-reflection-completed':
                return 'Weekly reflection completed';
            case 'post-weave':
                return widgetState.prompt.question;
            case 'memory':
                return widgetState.memory.title;
            case 'nudge':
                if (widgetState.daysSinceLastEntry === -1) {
                    return 'Start capturing your friendship journey';
                }
                return `It's been ${widgetState.daysSinceLastEntry} days since your last entry`;
            case 'default':
                return widgetState.prompt.question;
        }
    };

    // Get subtext based on state
    const getSubtext = (): string | null => {
        if (!widgetState) return null;

        switch (widgetState.type) {
            case 'weekly-reflection':
                return 'Tap to reflect on this week\'s connections';
            case 'weekly-reflection-completed':
                return "You're all caught up for the week!";
            case 'post-weave':
                return widgetState.prompt.context;
            case 'memory':
                return widgetState.memory.description;
            case 'nudge':
                return 'Tap to write';
            case 'default':
                return null;
        }
    };

    const promptText = getPromptText();
    const subtext = getSubtext();
    const isReflectionState = widgetState?.type === 'weekly-reflection' || widgetState?.type === 'weekly-reflection-completed';

    return (
        <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isWidgetStateLoading}>
            {/* Increased fixed height to accommodate layout */}
            <View style={{ height: 200, justifyContent: 'space-between' }}>
                <View className="flex-1">
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/journal');
                        }}
                    >
                        {/* Large Header matching Social Season style */}
                        <View className="flex-row items-center gap-4 mb-4">
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center"
                                style={{ backgroundColor: tokens.primary + '15' }}
                            >
                                {widgetState?.type === 'weekly-reflection-completed' ? (
                                    <View className="bg-primary w-full h-full rounded-full items-center justify-center">
                                        <Sparkles size={32} color="#FFFFFF" />
                                    </View>
                                ) : (
                                    <JournalIcon size={48} color={tokens.primary} />
                                )}
                            </View>
                            <View>
                                <Text
                                    className="mb-1"
                                    style={{
                                        color: tokens.foreground,
                                        fontFamily: typography.fonts.serifBold,
                                        fontSize: typography.scale.h2.fontSize,
                                        lineHeight: typography.scale.h2.lineHeight
                                    }}
                                >
                                    Journal
                                </Text>
                                <Text
                                    style={{
                                        color: tokens.foregroundMuted,
                                        fontFamily: typography.fonts.sans,
                                        fontSize: typography.scale.bodySmall.fontSize,
                                        lineHeight: typography.scale.bodySmall.lineHeight
                                    }}
                                >
                                    Capture your story
                                </Text>
                            </View>
                        </View>

                        {/* Prompt text - Fixed height container */}
                        <View style={{ height: 60, justifyContent: 'center' }}>
                            <Text
                                numberOfLines={isReflectionState ? 2 : 3}
                                style={{
                                    color: tokens.foreground,
                                    fontFamily: isReflectionState ? typography.fonts.serifBold : typography.fonts.serif,
                                    fontSize: isReflectionState ? typography.scale.h3.fontSize : typography.scale.body.fontSize,
                                    lineHeight: isReflectionState ? typography.scale.h3.lineHeight : typography.scale.body.lineHeight,
                                }}
                            >
                                {promptText}
                            </Text>

                            {/* Subtext (if any) */}
                            {subtext && !isReflectionState && (
                                <Text
                                    className="mt-1"
                                    style={{
                                        color: tokens.foregroundMuted,
                                        fontFamily: typography.fonts.sans,
                                        fontSize: typography.scale.bodySmall.fontSize,
                                        lineHeight: typography.scale.bodySmall.lineHeight,
                                    }}
                                >
                                    {subtext}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                <View className="mt-3 flex-row gap-3">
                    {isReflectionState && (
                        widgetState?.type === 'weekly-reflection' ? (
                            <>
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        UIEventBus.emit({ type: 'OPEN_WEEKLY_REFLECTION' });
                                    }}
                                    className="bg-primary px-4 py-2.5 rounded-full flex-row items-center gap-2 flex-1 justify-center"
                                    style={{ backgroundColor: tokens.primary }}
                                >
                                    <Sparkles size={16} color="#FFFFFF" />
                                    <Text
                                        className="text-white font-semibold text-sm"
                                        style={{ fontFamily: typography.fonts.sansSemiBold }}
                                    >
                                        Reflect
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        router.push('/journal');
                                    }}
                                    className="px-4 py-2.5 rounded-full flex-row items-center gap-2 flex-1 justify-center border"
                                    style={{ borderColor: tokens.border }}
                                >
                                    <BookOpen size={16} color={tokens.foreground} />
                                    <Text
                                        className="font-medium text-sm"
                                        style={{
                                            color: tokens.foreground,
                                            fontFamily: typography.fonts.sansSemiBold
                                        }}
                                    >
                                        Journal
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View
                                    className="px-4 py-2.5 rounded-full flex-row items-center gap-2 flex-1 justify-center opacity-70"
                                    style={{ backgroundColor: tokens.backgroundMuted }}
                                >
                                    <Sparkles size={16} color={tokens.foregroundMuted} />
                                    <Text
                                        className="font-medium text-sm"
                                        style={{
                                            color: tokens.foregroundMuted,
                                            fontFamily: typography.fonts.sansSemiBold
                                        }}
                                    >
                                        Completed
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        router.push('/journal');
                                    }}
                                    className="px-4 py-2.5 rounded-full flex-row items-center gap-2 flex-1 justify-center border"
                                    style={{ borderColor: tokens.border }}
                                >
                                    <BookOpen size={16} color={tokens.foreground} />
                                    <Text
                                        className="font-medium text-sm"
                                        style={{
                                            color: tokens.foreground,
                                            fontFamily: typography.fonts.sansSemiBold
                                        }}
                                    >
                                        Journal
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )
                    )}
                </View>

                {/* Footer: Stat + Refresh button */}
                <View
                    className="pt-3 border-t flex-row items-center justify-between"
                    style={{ borderTopColor: tokens.borderSubtle, display: isReflectionState ? 'none' : 'flex' }}
                >
                    {/* Cycling stat with Rolling Animation */}
                    <View className="flex-1 overflow-hidden h-6 justify-center">
                        <Animated.View
                            key={statIndex}
                            entering={FadeInDown.springify().damping(12)}
                            exiting={FadeOutUp.springify().damping(12)}
                            className="flex-row items-center gap-2 absolute top-0 left-0 bottom-0"
                        >
                            <StatIcon size={14} color={tokens.foregroundMuted} />
                            <Text
                                style={{
                                    color: tokens.foregroundMuted,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.caption.fontSize,
                                }}
                            >
                                {currentStatValue !== null ? currentStat.formatLabel(currentStatValue) : '...'}
                            </Text>
                        </Animated.View>
                    </View>

                    {/* Refresh button (only for non-weekly-reflection states) */}
                    {!isReflectionState && (
                        <TouchableOpacity
                            onPress={handleRefresh}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            className="p-1"
                        >
                            <RefreshCw size={16} color={tokens.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </HomeWidgetBase >
    );
}
