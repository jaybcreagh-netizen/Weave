import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import JournalSignals, { SentimentLabel } from '@/db/models/JournalSignals';
import ConversationThread from '@/db/models/ConversationThread';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getDisplayTitle } from '../../utils/title-utils';

interface EnrichedEntryCardProps {
    entry: JournalEntry | WeeklyReflection;
    signals?: JournalSignals | null;
    threads?: ConversationThread[];
    friendNames?: string[];
    isSelected: boolean;
    isSelectMode: boolean;
    onPress: () => void;
    onLongPress: () => void;
    index: number;
}

export const EnrichedEntryCard: React.FC<EnrichedEntryCardProps> = ({
    entry,
    signals,
    threads = [],
    friendNames = [],
    isSelected,
    isSelectMode,
    onPress,
    onLongPress,
    index
}) => {
    const { colors, typography } = useTheme();
    const isReflection = 'weekStartDate' in entry;
    const date = isReflection
        ? new Date((entry as WeeklyReflection).weekStartDate)
        : new Date((entry as JournalEntry).entryDate);
    const canSelect = !isReflection;

    const formatDate = (d: Date) => {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const getSentimentColor = (label?: SentimentLabel) => {
        switch (label) {
            case 'tense': return colors.destructive;
            case 'concerned': return colors.warning;
            case 'positive': return colors.info;
            case 'grateful': return colors.success;
            default: return 'transparent';
        }
    };

    const hasSentiment = !isReflection && signals && signals.sentimentLabel !== 'neutral';
    const sentimentColor = hasSentiment ? getSentimentColor(signals.sentimentLabel) : 'transparent';

    // Build title: LLM title > heuristic > date fallback
    const title = isReflection
        ? 'Weekly Reflection'
        : getDisplayTitle(entry as JournalEntry);

    // Build header metadata string: "6 Feb · with Hannah"
    const headerParts = [formatDate(date)];
    if (!isReflection && friendNames.length > 0) {
        const namesStr = friendNames.length <= 2
            ? friendNames.join(', ')
            : `${friendNames.slice(0, 2).join(', ')} +${friendNames.length - 2}`;
        headerParts.push(`with ${namesStr}`);
    }
    const headerText = headerParts.join(' · ');

    const Content = (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            className="mb-3 p-4 rounded-2xl overflow-hidden"
            style={{
                backgroundColor: colors.card,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? colors.primary : colors.border,
                // Sentiment left border accent
                borderLeftWidth: hasSentiment ? 3 : (isSelected ? 2 : 1),
                borderLeftColor: hasSentiment ? sentimentColor : (isSelected ? colors.primary : colors.border),
            }}
            activeOpacity={0.7}
        >
            {/* Header Row */}
            <View className="flex-row items-center gap-2 mb-2">
                {isSelectMode && (
                    <View className="mr-1">
                        {canSelect ? (
                            <Icon
                                name={isSelected ? 'CircleCheck' : 'Circle'}
                                size={20}
                                color={isSelected ? colors.primary : colors['muted-foreground']}
                            />
                        ) : (
                            <View style={{ width: 20 }} />
                        )}
                    </View>
                )}

                <Icon
                    name={isReflection ? 'Sparkles' : 'PenLine'}
                    size={13}
                    color={colors.primary}
                />

                <Text
                    variant="caption"
                    className="flex-1"
                    style={{ color: colors['muted-foreground'], fontSize: 12 }}
                >
                    {headerText}
                </Text>

                {isReflection && (
                    <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text
                            variant="caption"
                            style={{ color: colors['muted-foreground'], fontSize: 11 }}
                        >
                            Weekly
                        </Text>
                    </View>
                )}
            </View>

            {/* Title */}
            <Text
                variant="body"
                weight="medium"
                style={{ color: colors.foreground, fontSize: 15, marginBottom: 4 }}
                numberOfLines={1}
            >
                {title}
            </Text>

            {/* Elevated Themes (between title and content) */}
            {!isReflection && signals?.coreThemes?.length ? (
                <View className="flex-row flex-wrap items-center gap-1.5 mb-2">
                    {signals.coreThemes.slice(0, 3).map((theme: string, i: number) => {
                        const isPrimary = i === 0 && sentimentColor !== 'transparent';
                        return (
                            <View
                                key={`theme-${i}`}
                                className="px-2.5 py-0.5 rounded-lg"
                                style={{
                                    backgroundColor: isPrimary
                                        ? sentimentColor + '15'
                                        : colors.muted,
                                    borderWidth: isPrimary ? 1 : 0,
                                    borderColor: isPrimary ? sentimentColor + '30' : 'transparent',
                                }}
                            >
                                <Text
                                    variant="caption"
                                    weight={isPrimary ? 'medium' : 'regular'}
                                    style={{
                                        color: isPrimary ? sentimentColor : colors['muted-foreground'],
                                        fontSize: 11,
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {theme.replace('_', ' ')}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            ) : null}

            {/* Content Preview (serif for journal feel) */}
            <Text
                variant="body"
                style={{
                    color: colors['muted-foreground'],
                    fontSize: 13,
                    lineHeight: 19,
                    fontFamily: typography.fonts.serif,
                }}
                numberOfLines={2}
            >
                {isReflection
                    ? (entry as WeeklyReflection).gratitudeText
                    : (entry as JournalEntry).content}
            </Text>

            {/* Footer: Thread indicator */}
            {!isReflection && threads.length > 0 && (
                <View className="flex-row items-center gap-1 mt-2">
                    <Icon name="GitBranch" size={9} color={colors['muted-foreground']} />
                    <Text
                        variant="caption"
                        style={{ color: colors['muted-foreground'], fontSize: 10, fontStyle: 'italic' }}
                    >
                        {threads[0].topic}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );

    // Only animate the first few items
    if (index < 8) {
        return (
            <Animated.View
                entering={FadeInDown.delay(index * 30).duration(300)}
            >
                {Content}
            </Animated.View>
        );
    }

    return Content;
};
