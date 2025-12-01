import React, { useCallback } from 'react';
import { View, Text, SectionList, StyleSheet, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { WeaveLoading } from '@/shared/components/WeaveLoading';
import Animated from 'react-native-reanimated';
import { WeaveIcon } from '@/components/WeaveIcon';
import { TimelineItem } from '@/components/TimelineItem';
import { Interaction } from '@/components/types';
import { useTheme } from '@/shared/hooks/useTheme';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

interface TimelineListProps {
    sections: any[];
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    onInteractionPress: (interaction: Interaction) => void;
    onDeleteInteraction: (id: string) => void;
    onEditInteraction: (id: string) => void;
    ListHeaderComponent?: React.ReactElement;
}

export function TimelineList({
    sections,
    onScroll,
    onLoadMore,
    hasMore,
    onInteractionPress,
    onDeleteInteraction,
    onEditInteraction,
    ListHeaderComponent
}: TimelineListProps) {
    const { colors } = useTheme();

    const renderTimelineItem = useCallback(({ item: interaction, section, index }: any) => {
        const isFutureInteraction = section.title === 'Seeds';
        const isFirstInSection = index === 0;

        // Check if this is the last item in the entire timeline
        const lastSection = sections[sections.length - 1];
        const isLastItem = lastSection?.data[lastSection.data.length - 1]?.id === interaction.id;

        return (
            <View className="px-5">
                <TimelineItem
                    interaction={interaction}
                    isFuture={isFutureInteraction}
                    onPress={() => onInteractionPress(interaction)}
                    onDelete={onDeleteInteraction}
                    onEdit={onEditInteraction}
                    index={index}
                    sectionLabel={section.title}
                    isFirstInSection={isFirstInSection}
                    isLastItem={isLastItem}
                />
            </View>
        );
    }, [onInteractionPress, onDeleteInteraction, onEditInteraction, sections]);

    return (
        <View className="flex-1 relative">
            <AnimatedSectionList
                sections={sections}
                renderItem={renderTimelineItem}
                keyExtractor={(item: any) => item.id.toString()}
                ListHeaderComponent={
                    <>
                        {ListHeaderComponent}
                        <View style={{ paddingHorizontal: 20 }}>
                            <Text style={[styles.timelineTitle, { color: colors.foreground }]}>
                                Weave Timeline
                            </Text>
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <View className="items-center py-12">
                        <View className="mb-4 opacity-50">
                            <WeaveIcon size={40} color={colors['muted-foreground']} />
                        </View>
                        <Text style={{ color: colors['muted-foreground'] }}>No weaves yet</Text>
                        <Text className="text-xs mt-1 opacity-70" style={{ color: colors['muted-foreground'] }}>Your timeline will grow as you connect</Text>
                    </View>
                }
                ListFooterComponent={
                    hasMore ? (
                        <View className="py-4 items-center">
                            <WeaveLoading size={24} />
                            <Text className="text-xs mt-2 opacity-70" style={{ color: colors['muted-foreground'] }}>
                                Loading more weaves...
                            </Text>
                        </View>
                    ) : null
                }
                stickySectionHeadersEnabled={false}
                contentContainerStyle={{ paddingTop: 0, paddingBottom: 100 }}
                onScroll={onScroll}
                scrollEventThrottle={8}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                onEndReached={onLoadMore}
                onEndReachedThreshold={0.5}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    timelineTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8, fontFamily: 'Lora_700Bold' },
});
