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
import { EditReflectionModal } from '../src/components/EditReflectionModal';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

export default function FriendProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { friendId } = useLocalSearchParams();
  const { activeFriend: friend, activeFriendInteractions: interactions, observeFriend, unobserveFriend } = useFriendStore();
  const { deleteFriend } = useFriendStore();
  const { deleteInteraction, updateReflection } = useInteractionStore();
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [editingReflection, setEditingReflection] = useState<Interaction | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const scrollY = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [itemHeights, setItemHeights] = useState<{[key: string]: {y: number, height: number}}>({});
  console.log('[Haptic State]', Object.keys(itemHeights).length, 'items with layout info.'); // Log state on render

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
      const hasCrossed = Math.abs(VIEWPORT_CENTER - itemCenter) < 20;

      // Check if it has been triggered in this direction already
      const lastDirection = triggeredAtScroll.current[itemId];
      const currentDirection = VIEWPORT_CENTER > itemCenter ? 'down' : 'up';

      if (hasCrossed && lastDirection !== currentDirection) {
        triggeredAtScroll.current[itemId] = currentDirection;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Reset if we've left the crossing zone
      if (!hasCrossed && lastDirection) {
        delete triggeredAtScroll.current[itemId];
      }
    });

    lastScrollY.current = currentScroll;
  };

  useEffect(() => {
    if (friendId && typeof friendId === 'string') {
      // Reset loading state when friendId changes
      setIsDataLoaded(false);
      setItemHeights({}); // Clear heights for new friend
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

  const sortedInteractions = useMemo(() => 
    [...(interactions || [])].sort((a, b) => {
        const dateA = typeof a.interactionDate === 'string' ? new Date(a.interactionDate) : a.interactionDate;
        const dateB = typeof b.interactionDate === 'string' ? new Date(b.interactionDate) : b.interactionDate;
        return dateB.getTime() - dateA.getTime();
    }), [interactions]);

  const timelineSections = useMemo(() => {
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

  }, [sortedInteractions]);

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
    const itemRef = useRef<View>(null);
    const date = typeof interaction.interactionDate === 'string' ? new Date(interaction.interactionDate) : interaction.interactionDate;
    const isFutureInteraction = section.title === 'Seeds';
    const isFirstInSection = index === 0;

    // Check if this is the first item overall (for thread rendering)
    const isVeryFirstItem = timelineSections[0]?.data[0]?.id === interaction.id;

    useEffect(() => {
      if (itemRef.current) {
        itemRef.current.measure((x, y, width, height, pageX, pageY) => {
          // We need the position relative to the scrollview, not the screen.
          // `pageY` is absolute to the screen. We can subtract the header height.
          // A more robust way might involve a ref on the SectionList itself.
          // For now, let's assume a static header height can be calculated or estimated.
          // This will be much more reliable than onLayout's relative `y`.
          const yPosition = pageY - headerHeight;
          if (itemHeights[interaction.id.toString()]?.y !== yPosition) {
            setItemHeights(prev => ({
                ...prev,
                [interaction.id.toString()]: { y: yPosition, height }
            }));
          }
        });
      }
    }, [itemRef.current, headerHeight]);

    return (
        <View ref={itemRef} style={styles.itemWrapper}>
            {/* Render continuous thread before the very first item */}
            {isVeryFirstItem && (
                <View style={styles.threadContainer}>
                    <ContinuousThread
                        contentHeight={contentHeight}
                        startY={0}
                        interactions={sortedInteractions.map(int => ({
                            id: int.id.toString(),
                            interactionDate: int.interactionDate,
                            y: itemHeights[int.id.toString()]?.y || 0,
                        }))}
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
    <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
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
                        <Text style={styles.emptyEmoji}>🧵</Text>
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
            onEditReflection={(interaction) => {
              setEditingReflection(interaction);
              setSelectedInteraction(null); // Close detail modal
            }}
        />

        <EditReflectionModal
            interaction={editingReflection}
            isOpen={editingReflection !== null}
            onClose={() => setEditingReflection(null)}
            onSave={updateReflection}
            friendArchetype={friend?.archetype}
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
    contentContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12 },
    actionButton: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    actionButtonPrimary: {},
    actionButtonSecondary: {},
    buttonGradient: {
      paddingVertical: 12,
      paddingHorizontal: 16,
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
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    actionButtonTextSecondary: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    timelineTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8, fontFamily: 'Lora_700Bold' },
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