import React from 'react';
import { View, Text } from 'react-native';
import {
    Calendar, Sparkles, CheckCircle2, Lightbulb,
    AlertTriangle, RefreshCw, Zap, Heart, Clock, Star,
    Gift, Briefcase, Home, GraduationCap, PartyPopper,
    HeartCrack, Activity, Target, History, Egg
} from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { ListItem } from '@/shared/ui/ListItem';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import Interaction from '@/db/models/Interaction';
import { Suggestion } from '@/shared/types/common';
import FriendModel from '@/db/models/Friend';
import { format } from 'date-fns';
import { calculateWeeklySummary, generateContextualPrompts, selectBestPrompt, ContextualPrompt } from '@/modules/reflection';
import { getCategoryLabel } from '@/modules/interactions';

interface UpcomingDate {
    friend: FriendModel;
    type: 'birthday' | 'anniversary' | 'life_event';
    daysUntil: number;
    title?: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
}

interface FocusDetailSheetProps {
    isVisible: boolean;
    onClose: () => void;
    upcomingPlans: Interaction[];
    tomorrowPlans?: Interaction[];
    completedPlans: Interaction[];
    suggestions: Suggestion[];
    upcomingDates: UpcomingDate[];
    friends: FriendModel[];
    onConfirmPlan: (id: string) => void;
    onReschedulePlan: (plan: Interaction) => void;
    onSuggestionAction: (suggestion: Suggestion) => void;
}

export const FocusDetailSheet: React.FC<FocusDetailSheetProps> = ({
    isVisible,
    onClose,
    upcomingPlans,
    tomorrowPlans = [],
    completedPlans,
    suggestions,
    upcomingDates,
    friends,
    onConfirmPlan,
    onReschedulePlan,
    onSuggestionAction,
}) => {
    const { tokens, typography, spacing, isDarkMode } = useTheme();
    const [planFriendIds, setPlanFriendIds] = React.useState<Record<string, string[]>>({});
    const [prompt, setPrompt] = React.useState<ContextualPrompt | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        const loadFriends = async () => {
            const newMap: Record<string, string[]> = {};
            const allPlans = [...upcomingPlans, ...tomorrowPlans, ...completedPlans];
            for (const plan of allPlans) {
                try {
                    const iFriends = await plan.interactionFriends.fetch();
                    newMap[plan.id] = iFriends.map((f: any) => f.friendId);
                } catch (e) {
                    console.error('Error loading plan friends:', e);
                }
            }
            if (isMounted) setPlanFriendIds(newMap);
        };
        loadFriends();
        return () => { isMounted = false; };
    }, [upcomingPlans, tomorrowPlans, completedPlans]);

    React.useEffect(() => {
        let isMounted = true;
        const loadPrompt = async () => {
            try {
                const summary = await calculateWeeklySummary();
                const prompts = generateContextualPrompts(summary);
                const bestPrompt = selectBestPrompt(prompts);
                if (isMounted) setPrompt(bestPrompt);
            } catch (error) {
                console.error('Error loading reflection prompt:', error);
            }
        };
        if (isVisible) {
            loadPrompt();
        }
        return () => { isMounted = false; };
    }, [isVisible]);

    const renderSuggestionIcon = (iconName: string, category?: string) => {
        const size = 20;
        const color = tokens.primary;

        switch (iconName) {
            case 'AlertTriangle': return <AlertTriangle size={size} color={tokens.destructive} />;
            case 'RefreshCw': return <RefreshCw size={size} color={tokens.primary} />;
            case 'History': return <History size={size} color={tokens.warning} />; // High drift
            case 'Zap': return <Zap size={size} color="#F59E0B" />; // Amber for momentum
            case 'Sparkles': return <Sparkles size={size} color="#8B5CF6" />; // Purple for deepen
            case 'Clock': return <Clock size={size} color={tokens.foregroundMuted} />;
            case 'Heart': return <Heart size={size} color="#EC4899" />; // Pink/Red
            case 'Gift': return <Gift size={size} color="#EC4899" />;
            case 'Briefcase': return <Briefcase size={size} color={tokens.primary} />;
            case 'Home': return <Home size={size} color={tokens.primary} />;
            case 'GraduationCap': return <GraduationCap size={size} color={tokens.primary} />;
            case 'PartyPopper': return <PartyPopper size={size} color="#F59E0B" />;
            case 'HeartCrack': return <HeartCrack size={size} color={tokens.foregroundMuted} />;
            case 'Activity': return <Activity size={size} color={tokens.destructive} />;
            case 'Target': return <Target size={size} color={tokens.primary} />;
            case 'Egg': return <Egg size={size} color={tokens.primary} />;
            case 'Star': return <Star size={size} color="#F59E0B" />;
            default: return <Sparkles size={size} color={tokens.primary} />;
        }
    };

    return (
        <AnimatedBottomSheet
            visible={isVisible}
            onClose={onClose}
            height="full"
            scrollable
            title="Today's Focus"
        >
            <View>
                {/* Reflection Prompt */}
                {prompt && (
                    <View
                        className="p-4 rounded-xl mb-6 border"
                        style={{ backgroundColor: tokens.primary + '10', borderColor: tokens.primary + '20' }}
                    >
                        <View className="flex-row items-center mb-2 gap-1.5">
                            <Lightbulb size={16} color={tokens.primary} />
                            <Text
                                className="text-xs tracking-wider uppercase"
                                style={{ color: tokens.primary, fontFamily: typography.fonts.sansSemiBold }}
                            >
                                REFLECTION
                            </Text>
                        </View>
                        <Text
                            className="text-base leading-6"
                            style={{ color: tokens.foreground, fontFamily: typography.fonts.serif }}
                        >
                            {prompt.prompt}
                        </Text>
                    </View>
                )}

                {/* Upcoming Plans Section */}
                {upcomingPlans.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Upcoming" icon={<Calendar size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {upcomingPlans.map((plan, index) => {
                                const friendIds = planFriendIds[plan.id] || [];
                                const planFriends = friends.filter(f => friendIds.includes(f.id));
                                const friendName = planFriends.length > 0 ? planFriends[0].name : '';
                                const subtitle = `${friendName ? `with ${friendName} • ` : ''}${format(new Date(plan.interactionDate), 'h:mm a')}`;

                                return (
                                    <View key={plan.id} className="px-4">
                                        <ListItem
                                            title={plan.title || `${getCategoryLabel(plan.interactionCategory as any)}${friendName ? ` with ${friendName}` : ''}`}
                                            subtitle={subtitle}
                                            showDivider={index < upcomingPlans.length - 1}
                                            compact
                                            trailing={
                                                <View className="flex-row">
                                                    <Button
                                                        label="Reschedule"
                                                        size="sm"
                                                        variant="secondary"
                                                        onPress={() => onReschedulePlan(plan)}
                                                        className="py-1 px-2.5 h-8 min-w-[80px]"
                                                    />
                                                </View>
                                            }
                                        />
                                    </View>
                                );
                            })}
                        </Card>
                    </View>
                )}

                {/* Tomorrow's Plans Section */}
                {tomorrowPlans.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Tomorrow" icon={<Clock size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {tomorrowPlans.map((plan, index) => {
                                const friendIds = planFriendIds[plan.id] || [];
                                const planFriends = friends.filter(f => friendIds.includes(f.id));
                                const friendName = planFriends.length > 0 ? planFriends[0].name : '';
                                const subtitle = `${friendName ? `with ${friendName} • ` : ''}${format(new Date(plan.interactionDate), 'h:mm a')}`;

                                return (
                                    <View key={plan.id} className="px-4">
                                        <ListItem
                                            title={plan.title || `${getCategoryLabel(plan.interactionCategory as any)}${friendName ? ` with ${friendName}` : ''}`}
                                            subtitle={subtitle}
                                            showDivider={index < tomorrowPlans.length - 1}
                                            compact
                                            trailing={
                                                <View className="flex-row">
                                                    <Button
                                                        label="Reschedule"
                                                        size="sm"
                                                        variant="secondary"
                                                        onPress={() => onReschedulePlan(plan)}
                                                        className="py-1 px-2.5 h-8 min-w-[80px]"
                                                    />
                                                </View>
                                            }
                                        />
                                    </View>
                                );
                            })}
                        </Card>
                    </View>
                )}

                {/* Completed Plans Section */}
                {completedPlans.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Completed Today" icon={<CheckCircle2 size={20} color={tokens.success} />} />
                        <Card padding="none">
                            {completedPlans.map((plan, index) => {
                                const friendIds = planFriendIds[plan.id] || [];
                                const planFriends = friends.filter(f => friendIds.includes(f.id));
                                const friendName = planFriends.length > 0 ? planFriends[0].name : '';
                                const subtitle = `${friendName ? `with ${friendName} • ` : ''}${format(new Date(plan.interactionDate), 'h:mm a')}`;

                                return (
                                    <View key={plan.id} className="px-4">
                                        <ListItem
                                            title={plan.title || `${getCategoryLabel(plan.interactionCategory as any)}${friendName ? ` with ${friendName}` : ''}`}
                                            subtitle={subtitle}
                                            showDivider={index < completedPlans.length - 1}
                                            compact
                                            trailing={
                                                <View className="flex-row">
                                                    {plan.reflectionJSON || plan.reflection ? (
                                                        <View className="flex-row items-center opacity-70">
                                                            <CheckCircle2 size={16} color={tokens.success} style={{ marginRight: 4 }} />
                                                            <Text style={{
                                                                color: tokens.success,
                                                                fontFamily: typography.fonts.sansMedium,
                                                                fontSize: 12
                                                            }}>
                                                                Reflected
                                                            </Text>
                                                        </View>
                                                    ) : (
                                                        <Button
                                                            label="Deepen"
                                                            size="sm"
                                                            onPress={() => onConfirmPlan(plan.id)}
                                                            className="py-1 px-2.5 h-8 min-w-[80px]"
                                                        />
                                                    )}
                                                </View>
                                            }
                                        />
                                    </View>
                                );
                            })}
                        </Card>
                    </View>
                )}

                {/* Suggestions Section */}
                {suggestions.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Suggestions" icon={<Sparkles size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {suggestions.map((suggestion, index) => {
                                const friend = friends.find(f => f.id === suggestion.friendId);
                                return (
                                    <View key={suggestion.id} className="px-4">
                                        <ListItem
                                            leading={renderSuggestionIcon(suggestion.icon, suggestion.category)}
                                            title={suggestion.title}
                                            subtitle={suggestion.subtitle}
                                            showDivider={index < suggestions.length - 1}
                                            compact
                                            trailing={
                                                <Button
                                                    label={suggestion.actionLabel || "View"}
                                                    variant="secondary"
                                                    size="sm"
                                                    className="py-1 px-2.5 h-8 min-w-[80px]"
                                                    onPress={() => onSuggestionAction(suggestion)}
                                                />
                                            }
                                        />
                                    </View>
                                );
                            })}
                        </Card>
                    </View>
                )}

                {/* Upcoming Events Section */}
                {upcomingDates.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Life Events" icon={<Calendar size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {upcomingDates.map((event, index) => (
                                <View key={`${event.friend.id}-${event.type}`} className="px-4">
                                    <ListItem
                                        title={event.friend.name}
                                        subtitle={`${event.type === 'birthday' ? 'Birthday' : event.title} • ${event.daysUntil === 0 ? 'Today' : event.daysUntil === 1 ? 'Tomorrow' : `In ${event.daysUntil} days`}`}
                                        showDivider={index < upcomingDates.length - 1}
                                        compact
                                    />
                                </View>
                            ))}
                        </Card>
                    </View>
                )}

                {upcomingPlans.length === 0 && completedPlans.length === 0 && suggestions.length === 0 && upcomingDates.length === 0 && (
                    <View className="items-center justify-center py-16 gap-4">
                        <CheckCircle2 size={48} color={tokens.success} />
                        <Text
                            className="text-xl"
                            style={{ color: tokens.foreground, fontFamily: typography.fonts.serifBold }}
                        >
                            All Caught Up
                        </Text>
                        <Text
                            className="text-base text-center"
                            style={{ color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }}
                        >
                            You've handled everything for now. Enjoy your day!
                        </Text>
                    </View>
                )}
            </View>
        </AnimatedBottomSheet>
    );
};

