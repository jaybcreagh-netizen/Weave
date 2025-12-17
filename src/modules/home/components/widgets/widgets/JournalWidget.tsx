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

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
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
import { isSameWeek, differenceInDays } from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import Interaction from '@/db/models/Interaction';
import {
    getRecentMeaningfulWeaves,
    getMemories,
    type Memory,
    type MeaningfulWeave
} from '@/modules/journal';
import { generateJournalPrompts, type JournalPrompt } from '@/modules/journal';

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
            return database.get<JournalEntry>('journal_entries').query().fetchCount();
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'entry' : 'entries'}`,
    },
    {
        icon: Flame,
        getValue: async () => {
            // Calculate streak: consecutive days with completed weaves backwards from today
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let streak = 0;
            let checkDate = new Date(today);

            for (let i = 0; i < 30; i++) { // Check up to 30 days back
                const dayStart = checkDate.getTime();
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;

                const count = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('status', 'completed'),
                        Q.where('interaction_date', Q.gte(dayStart)),
                        Q.where('interaction_date', Q.lt(dayEnd))
                    )
                    .fetchCount();

                if (count > 0) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }

            return streak;
        },
        formatLabel: (value) => `${value} day streak`,
    },
    {
        icon: Calendar,
        getValue: async () => {
            // Weeks active: from first interaction to now
            const firstInteraction = await database
                .get<Interaction>('interactions')
                .query(Q.sortBy('interaction_date', 'asc'), Q.take(1))
                .fetch();

            if (firstInteraction.length === 0) return 0;

            const firstDate = new Date(firstInteraction[0].interactionDate);
            const now = new Date();
            const weeks = Math.floor(differenceInDays(now, firstDate) / 7);
            return Math.max(1, weeks);
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'week' : 'weeks'} active`,
    },
    {
        icon: Users,
        getValue: async () => {
            // Count unique friends documented in journal entries via join table
            const joinEntries = await database
                .get<JournalEntryFriend>('journal_entry_friends')
                .query()
                .fetch();

            const friendIds = new Set<string>();
            joinEntries.forEach((entry) => friendIds.add(entry.friendId));

            return friendIds.size;
        },
        formatLabel: (value) => `${value} ${value === 1 ? 'friend' : 'friends'} in your story`,
    },
    {
        icon: Sparkles,
        getValue: async () => {
            return database.get<WeeklyReflection>('weekly_reflections').query().fetchCount();
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
    const [isLoading, setIsLoading] = useState(true);
    const [statIndex, setStatIndex] = useState(0); // Start at 0, cycle automatically
    const [statValues, setStatValues] = useState<number[]>([]); // Store all values
    const [promptKey, setPromptKey] = useState(0); // For refreshing prompt
    const [forceDefaultPrompt, setForceDefaultPrompt] = useState(false); // Skip priority when refreshing

    // Get the current stat config
    const currentStat = STATS[statIndex];
    // If we have values loaded, use the real value, otherwise null
    const currentStatValue = statValues.length > 0 ? statValues[statIndex] : null;
    const StatIcon = currentStat.icon;

    // Get a random general prompt
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

        // 1. Check Weekly Reflection (Sunday or Monday, not yet completed this week)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const isSundayOrMonday = dayOfWeek === 0 || dayOfWeek === 1;

        if (isSundayOrMonday) {
            const reflections = await database
                .get<WeeklyReflection>('weekly_reflections')
                .query(Q.sortBy('created_at', 'desc'), Q.take(1))
                .fetch();

            const hasReflectedThisWeek = reflections.length > 0 &&
                isSameWeek(reflections[0].createdAt, today, { weekStartsOn: 0 });

            if (!hasReflectedThisWeek) {
                return { type: 'weekly-reflection' };
            }
        }

        // 2. Check for meaningful weave in last 48h
        try {
            const meaningfulWeaves = await getRecentMeaningfulWeaves(1, 48);
            if (meaningfulWeaves.length > 0) {
                const weave = meaningfulWeaves[0];
                const prompts = generateJournalPrompts({ type: 'weave', weave });
                if (prompts.length > 0) {
                    return { type: 'post-weave', weave, prompt: prompts[0] };
                }
            }
        } catch (error) {
            console.warn('[JournalWidget] Error fetching meaningful weaves:', error);
        }

        // 3. Check for memories
        try {
            const memories = await getMemories(1);
            if (memories.length > 0) {
                return { type: 'memory', memory: memories[0] };
            }
        } catch (error) {
            console.warn('[JournalWidget] Error fetching memories:', error);
        }

        // 4. Check days since last journal entry (nudge if 3+ days)
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

        // 5. Default - general prompt
        return getRandomGeneralPrompt();
    }, [promptKey, forceDefaultPrompt]);

    // Load widget state and ALL stats
    useEffect(() => {
        let mounted = true;

        const load = async () => {
            setIsLoading(true);
            try {
                // Determine state and fetch all stats in parallel
                const [state, ...values] = await Promise.all([
                    determineState(),
                    ...STATS.map(s => s.getValue())
                ]);

                if (mounted) {
                    setWidgetState(state);
                    setStatValues(values as number[]);
                    // Randomize start index so it handles fresh mounts differently
                    setStatIndex(Math.floor(Math.random() * STATS.length));
                }
            } catch (error) {
                console.error('[JournalWidget] Error loading:', error);
                // Fall back to default state
                if (mounted) {
                    const randomPrompt = GENERAL_PROMPTS[Math.floor(Math.random() * GENERAL_PROMPTS.length)];
                    setWidgetState({
                        type: 'default',
                        prompt: {
                            id: 'general',
                            question: randomPrompt,
                            context: 'General prompt',
                            type: 'general',
                        }
                    });
                    setStatValues(STATS.map(() => 0));
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        load();
        return () => { mounted = false; };
    }, [determineState, promptKey]);

    // Cycle stats every 5 seconds
    useEffect(() => {
        if (isLoading) return;

        const interval = setInterval(() => {
            setStatIndex((prev) => (prev + 1) % STATS.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [isLoading]);

    // Handle widget tap
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/journal');
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

    return (
        <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isLoading}>
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.7}
            >
                {/* Increased fixed height to accommodate larger header */}
                <View style={{ height: 200, justifyContent: 'space-between' }}>
                    <View>
                        {/* Large Header matching Social Season style */}
                        <View className="flex-row items-center gap-4 mb-4">
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center"
                                style={{ backgroundColor: tokens.primary + '15' }}
                            >
                                <JournalIcon size={48} color={tokens.primary} />
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
                        <View style={{ height: 80, justifyContent: 'center' }}>
                            <Text
                                numberOfLines={3}
                                style={{
                                    color: tokens.foreground,
                                    fontFamily: widgetState?.type === 'weekly-reflection'
                                        ? typography.fonts.serifBold
                                        : typography.fonts.serif,
                                    fontSize: widgetState?.type === 'weekly-reflection'
                                        ? typography.scale.h3.fontSize
                                        : typography.scale.body.fontSize,
                                    lineHeight: widgetState?.type === 'weekly-reflection'
                                        ? typography.scale.h3.lineHeight
                                        : typography.scale.body.lineHeight,
                                }}
                            >
                                {promptText}
                            </Text>

                            {/* Subtext (if any) */}
                            {subtext && (
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
                    </View>

                    {/* Footer: Stat + Refresh button */}
                    <View
                        className="pt-3 border-t flex-row items-center justify-between"
                        style={{ borderTopColor: tokens.borderSubtle }}
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
                        {widgetState?.type !== 'weekly-reflection' && (
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
            </TouchableOpacity>
        </HomeWidgetBase>
    );
}
