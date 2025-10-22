import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, SectionList, LayoutChangeEvent, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Edit, Trash2, Calendar } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isFuture, isToday, isPast, format } from 'date-fns';

import { FriendCard } from '../src/components/FriendCard';
import { TimelineItem } from '../src/components/TimelineItem';
import { ContinuousThread } from '../src/components/ContinuousThread';
import { useFriendStore } from '../src/stores/friendStore';
import { useInteractionStore } from '../src/stores/interactionStore';
import { calculateNextConnectionDate, getPoeticSectionTitle } from '../src/lib/timeline-utils';
import { useTheme } from '../src/hooks/useTheme';
import { type Interaction, type Tier } from '../src/components/types';
import { InteractionDetailModal } from '../src/components/interaction-detail-modal';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

export default function FriendProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { friendId } = useLocalSearchParams();
  const { activeFriend: friend, activeFriendInteractions: interactions, observeFriend, unobserveFriend } = useFriendStore();
  const { deleteFriend } = useFriendStore();
  const { deleteInteraction } = useInteractionStore();
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const scrollY = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [itemHeights, setItemHeights] = useState<{[key: string]: {y: number, height: number}}>({});
  const triggeredAtScroll = useRef<{[key: string]: number}>({});
  const lastScrollY = useRef(0);

  // Page entrance animations
  const pageOpacity = useSharedValue(0);
  const headerOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    // Only animate when data is loaded
    if (isDataLoaded) {
      // Page container fades in first
      pageOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      });

      // Friend card and header elements - sync with timeline base delay
      headerOpacity.value = withDelay(
        100,
        withTiming(1, {
          duration: 600,
          easing: Easing.out(Easing.quad),
        })
      );

      // Buttons fade in just before timeline starts (timeline starts at 200ms)
      buttonsOpacity.value = withDelay(
        150,
        withTiming(1, {
          duration: 600,
          easing: Easing.out(Easing.quad),
        })
      );
    } else {
      // Reset animations when loading new friend
      pageOpacity.value = 0;
      headerOpacity.value = 0;
      buttonsOpacity.value = 0;
    }
  }, [isDataLoaded]);

  const pageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  // Handle haptics on scroll
  const handleScroll = (event: any) => {
    const currentScroll = event.nativeEvent.contentOffset.y;
    const VIEWPORT_CENTER = currentScroll + 400;

    Object.entries(itemHeights).forEach(([itemId, position]) => {
      const itemCenter = position.y + (position.height / 2);
      const lastTriggerScroll = triggeredAtScroll.current[itemId] || -1000;

      const hasCrossed = Math.abs(VIEWPORT_CENTER - itemCenter) < 10;
      const hasMovedEnough = Math.abs(currentScroll - lastTriggerScroll) > 50;

      if (hasCrossed && hasMovedEnough) {
        triggeredAtScroll.current[itemId] = currentScroll;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });

    lastScrollY.current = currentScroll;
  };

  useEffect(() => {
    if (friendId && typeof friendId === 'string') {
      // Reset loading state when friendId changes
      setIsDataLoaded(false);
      observeFriend(friendId);
    }
    return () => {
      unobserveFriend();
    };
  }, [friendId, observeFriend, unobserveFriend]);

  // Track when data is actually loaded - must match the friendId
  // Add small delay to ensure data is fully settled
  useEffect(() => {
    if (friend && friend.id === friendId && interactions !== undefined) {
      const timer = setTimeout(() => {
        setIsDataLoaded(true);
      }, 150); // Small delay to ensure all data is ready

      return () => clearTimeout(timer);
    }
  }, [friend, interactions, friendId]);

  const timelineSections = useMemo(() => {
    const sortedInteractions = [...(interactions || [])].sort((a, b) => {
        const dateA = typeof a.interactionDate === 'string' ? new Date(a.interactionDate) : a.interactionDate;
        const dateB = typeof b.interactionDate === 'string' ? new Date(b.interactionDate) : b.interactionDate;
        return dateB.getTime() - dateA.getTime();
    });

    const sections: { [key: string]: Interaction[] } = {
        Seeds: [], // Future
        Today: [],
        'Woven Memories': [], // Past
    };

    sortedInteractions.forEach(interaction => {
        const date = new Date(interaction.interactionDate);
        if (isFuture(date)) sections.Seeds.push(interaction);
        else if (isToday(date)) sections.Today.push(interaction);
        else sections['Woven Memories'].push(interaction);
    });

    return Object.entries(sections)
        .map(([title, data]) => ({ title, data }))
        .filter(section => section.data.length > 0);

  }, [interactions]);

  const nextConnectionDate = useMemo(() => {
    const pastInteractions = (interactions || []).filter(i => isPast(new Date(i.interactionDate)));
    if (pastInteractions.length === 0 || !friend) return null;

    const mostRecentPastInteraction = pastInteractions.reduce((latest, current) => {
        return new Date(current.interactionDate) > new Date(latest.interactionDate) ? current : latest;
    });

    return calculateNextConnectionDate(new Date(mostRecentPastInteraction.interactionDate), friend.dunbarTier as Tier);
  }, [interactions, friend]);

  // Show loading state until data is actually loaded
  if (!isDataLoaded || !friend) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const handleEdit = () => {
    router.push(`/edit-friend?friendId=${friend.id}`);
  };

  const handleDeleteFriend = () => {
    Alert.alert("Delete Friend", "Are you sure you want to remove this friend from your weave?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          await deleteFriend(friend.id);
          router.back();
      }},
    ]);
  };

  const renderTimelineItem = ({ item: interaction, section, index }: { item: Interaction; section: { title: string; data: Interaction[] }; index: number }) => {
    const date = typeof interaction.interactionDate === 'string' ? new Date(interaction.interactionDate) : interaction.interactionDate;
    const isFutureInteraction = section.title === 'Seeds';
    const isFirstInSection = index === 0;

    // Check if this is the first item overall (for thread rendering)
    const isVeryFirstItem = timelineSections[0]?.data[0]?.id === interaction.id;

    return (
        <View
            style={styles.itemWrapper}
            onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                setItemHeights(prev => ({
                    ...prev,
                    [interaction.id.toString()]: { y, height }
                }));
            }}
        >
            {/* Render continuous thread before the very first item */}
            {isVeryFirstItem && (
                <View style={styles.threadContainer}>
                    <ContinuousThread
                        contentHeight={contentHeight}
                        startY={0}
                        interactions={interactions?.map(int => ({
                            id: int.id.toString(),
                            interactionDate: int.interactionDate,
                            y: itemHeights[int.id.toString()]?.y || 0,
                        })) || []}
                    />
                </View>
            )}
            <TimelineItem
                interaction={interaction}
                isFuture={isFutureInteraction}
                onPress={() => setSelectedInteraction(interaction)}
                index={index}
                sectionLabel={section.title}
                isFirstInSection={isFirstInSection}
            />
        </View>
    );
  };

  const ListHeader = () => (
    <View>
        <View style={[styles.header, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={20} color={colors['muted-foreground']} />
              <Text style={{ color: colors.foreground }}>Back</Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => {}} style={{ padding: 8 }}>
                    <Calendar size={20} color={colors['muted-foreground']} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEdit} style={{ padding: 8 }}>
                    <Edit size={20} color={colors['muted-foreground']} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteFriend} style={{ padding: 8 }}>
                    <Trash2 size={20} color={colors.destructive} />
                </TouchableOpacity>
            </View>
        </View>
        <View style={styles.contentContainer}>
            <Animated.View style={headerAnimatedStyle}>
                <FriendCard friend={friend} variant="full" />
            </Animated.View>

            {nextConnectionDate && !isPast(nextConnectionDate) && (
                <Animated.View style={buttonsAnimatedStyle}>
                    <TouchableOpacity
                        style={[styles.connectByButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                        onPress={() => router.push({ pathname: '/interaction-form', params: { friendId: friend.id, mode: 'plan' } })}
                    >
                        <Text style={[styles.connectByButtonText, { color: colors.foreground }]}>
                          Connect by: {format(nextConnectionDate, 'MMMM do')}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            <Animated.View style={[styles.actionButtonsContainer, buttonsAnimatedStyle]}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/interaction-form', params: { friendId: friend.id, mode: 'log' } })}
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                >
                  <LinearGradient
                    colors={[colors.primary, `${colors.primary}DD`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <View style={styles.glassOverlay} />
                    <Text style={[styles.actionButtonTextPrimary, { color: colors['primary-foreground'] }]}>Log a Weave</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/interaction-form', params: { friendId: friend.id, mode: 'plan' } })}
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                >
                  <LinearGradient
                    colors={[colors.secondary, `${colors.secondary}CC`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <View style={styles.glassOverlay} />
                    <Text style={[styles.actionButtonTextSecondary, { color: colors.foreground }]}>Plan a Weave</Text>
                  </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
            <Text style={[styles.timelineTitle, { color: colors.foreground }]}>
                Weave Timeline
            </Text>
        </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Animated.View style={[{ flex: 1 }, pageAnimatedStyle]}>
        {/* Sticky Header */}
        <ListHeader />

        {/* Independent Timeline Container */}
        <View style={styles.timelineContainer}>
            {/* Timeline ScrollView */}
            <AnimatedSectionList
                key={friendId} // Force remount when friend changes
                sections={timelineSections}
                renderItem={renderTimelineItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>🕸️</Text>
                        <Text style={[styles.emptyText, { color: colors['muted-foreground'] }]}>No weaves yet</Text>
                        <Text style={[styles.emptySubtext, { color: colors['muted-foreground'] }]}>Your timeline will grow as you connect</Text>
                    </View>
                }
                stickySectionHeadersEnabled={false}
                contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}
                onScroll={(event) => {
                    // Update animated value
                    scrollY.value = event.nativeEvent.contentOffset.y;
                    // Handle haptics
                    handleScroll(event);
                }}
                scrollEventThrottle={16}
                onContentSizeChange={(_, height) => setContentHeight(height)}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
            />
        </View>

        <InteractionDetailModal
            interaction={selectedInteraction}
            isOpen={selectedInteraction !== null}
            onClose={() => setSelectedInteraction(null)}
            friendName={friend.name}
        />
        </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    contentContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 16 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12 },
    actionButton: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    actionButtonPrimary: {},
    actionButtonSecondary: {},
    buttonGradient: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    glassOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderBottomLeftRadius: 100,
      borderBottomRightRadius: 100,
    },
    actionButtonTextPrimary: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    actionButtonTextSecondary: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    timelineTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, fontFamily: 'Lora_700Bold' },
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyEmoji: { fontSize: 40, marginBottom: 16, opacity: 0.5 },
    emptyText: {},
    emptySubtext: { fontSize: 12, marginTop: 4, opacity: 0.7 },
    itemWrapper: {
        paddingHorizontal: 20,
    },
    connectByButton: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    connectByButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    timelineContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    threadContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
    },
});