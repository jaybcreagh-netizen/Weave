import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, SectionList, Animated } from 'react-native';
import { ArrowLeft, Edit, Trash2, Calendar } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { isFuture, isToday, isPast, format } from 'date-fns';

import { Glyph } from '../src/components/glyph';
import { useFriendStore } from '../src/stores/friendStore';
import { useInteractionStore } from '../src/stores/interactionStore';
import { useUIStore } from '../src/stores/uiStore';
import { calculateOverallStatus, ConnectionStatus, calculateNextConnectionDate } from '../src/lib/timeline-utils';
import { theme } from '../src/theme';
import { type Interaction, type Tier, type Archetype, type Status } from '../src/components/types';
import { InteractionDetailModal } from '../src/components/interaction-detail-modal';
import { modeIcons } from '../src/lib/constants';

// Helper functions
const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isToday(d)) return 'Today';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function FriendProfile() {
  const router = useRouter();
  const { friendId } = useLocalSearchParams();
  const { activeFriend: friend, activeFriendInteractions: interactions, observeFriend, unobserveFriend } = useFriendStore();
  const { deleteFriend } = useFriendStore();
  const { deleteInteraction } = useInteractionStore();
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);

  useEffect(() => {
    if (friendId && typeof friendId === 'string') {
      observeFriend(friendId);
    }
    return () => {
      unobserveFriend();
    };
  }, [friendId, observeFriend, unobserveFriend]);

  const timelineSections = useMemo(() => {
    const sortedInteractions = [...(interactions || [])].sort((a, b) => {
        const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
        const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
        return dateB.getTime() - dateA.getTime();
    });

    const sections: { [key: string]: Interaction[] } = {
        Planned: [],
        Today: [],
        Past: [],
    };

    sortedInteractions.forEach(interaction => {
        const date = new Date(interaction.date);
        if (isFuture(date)) sections.Planned.push(interaction);
        else if (isToday(date)) sections.Today.push(interaction);
        else sections.Past.push(interaction);
    });

    return Object.entries(sections)
        .map(([title, data]) => ({ title, data }))
        .filter(section => section.data.length > 0);

  }, [interactions]);

  const nextConnectionDate = useMemo(() => {
    const pastInteractions = (interactions || []).filter(i => isPast(new Date(i.date)));
    if (pastInteractions.length === 0 || !friend) return null;

    const mostRecentPastInteraction = pastInteractions.reduce((latest, current) => {
        return new Date(current.date) > new Date(latest.date) ? current : latest;
    });

    return calculateNextConnectionDate(new Date(mostRecentPastInteraction.date), friend.tier as Tier);
  }, [interactions, friend]);

  if (!friend) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading friend...</Text>
      </SafeAreaView>
    );
  }

  const connectionStatus: ConnectionStatus = calculateOverallStatus(interactions || [], friend.tier as Tier);

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

  const renderTimelineItem = ({ item: interaction, section }: { item: Interaction; section: { title: string } }) => {
    const date = typeof interaction.date === 'string' ? new Date(interaction.date) : interaction.date;
    const isFutureInteraction = section.title === 'Planned';
    const modeIcon = modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default;

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({
          inputRange: [-80, 0],
          outputRange: [0, 80],
          extrapolate: 'clamp',
        });
        return (
          <TouchableOpacity onPress={() => deleteInteraction(interaction.id)} style={styles.deleteButton}>
            <Animated.View style={{ transform: [{ translateX: trans }] }}>
                <Trash2 color="white" size={20} />
            </Animated.View>
          </TouchableOpacity>
        );
      };

    return (
        <View style={styles.swipeableContainer}>
            <Swipeable renderRightActions={renderRightActions}>
                <View style={styles.itemContainer}>
                    <View style={styles.dateColumn}>
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                    <Text style={styles.timeText}>
                        {new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                    </View>

                    <View style={styles.knotContainer}>
                        <View style={[
                            styles.thread,
                            isFutureInteraction
                                ? styles.threadDashed
                                : { backgroundColor: theme.colors.border }
                        ]} />
                        <View style={[styles.knot, { backgroundColor: isFutureInteraction ? theme.colors.border : '#D4AF37' }]} />
                    </View>

                    <TouchableOpacity
                    style={styles.cardContainer}
                    onPress={() => setSelectedInteraction(interaction as Interaction)}
                    >
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                        <Text style={styles.cardIcon}>{modeIcon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{interaction.activity}</Text>
                            <Text style={styles.cardSubtitle}>
                            {interaction.mode?.replace('-', ' ')} • {interaction.type}
                            </Text>
                            <View style={[styles.statusBadge, interaction.status === 'completed' ? styles.statusCompleted : styles.statusPlanned]}>
                            <Text style={[styles.statusBadgeText, interaction.status === 'completed' ? styles.statusCompletedText : styles.statusPlannedText]}>
                                {interaction.status === 'completed' ? 'Completed' : 'Planned'}
                            </Text>
                            </View>
                        </View>
                        </View>
                    </View>
                    </TouchableOpacity>
                </View>
            </Swipeable>
        </View>
    );
  };

  const ListHeader = () => (
    <>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={20} color={theme.colors['muted-foreground']} />
            <Text>Back</Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => {}} style={{ padding: 8 }}>
                    <Calendar size={20} color={theme.colors['muted-foreground']} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEdit} style={{ padding: 8 }}>
                    <Edit size={20} color={theme.colors['muted-foreground']} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteFriend} style={{ padding: 8 }}>
                    <Trash2 size={20} color={theme.colors.destructive} />
                </TouchableOpacity>
            </View>
        </View>
        <View style={styles.contentContainer}>
            <Glyph
                name={friend.name}
                statusText={friend.statusText}
                tier={friend.tier as Tier}
                archetype={friend.archetype as Archetype}
                status={friend.status as Status}
                photoUrl={friend.photoUrl}
                variant="full"
            />
            {nextConnectionDate && !isPast(nextConnectionDate) && (
                <TouchableOpacity 
                    style={styles.connectByButton}
                    onPress={() => router.push({ pathname: '/interaction-form', params: { friendId: friend.id, mode: 'plan' } })}
                >
                    <Text style={styles.connectByButtonText}>Connect by: {format(nextConnectionDate, 'MMMM do')}</Text>
                </TouchableOpacity>
            )}
            <View style={styles.actionButtonsContainer}>
                <TouchableOpacity onPress={() => router.push({ pathname: '/interaction-form', params: { friendId: friend.id, mode: 'log' } })} style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.actionButtonTextPrimary}>Log a Weave</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push({ pathname: '/interaction-form', params: { friendId: friend.id, mode: 'plan' } })} style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}>
                <Text style={styles.actionButtonTextSecondary}>Plan a Weave</Text>
                </TouchableOpacity>
            </View>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
            <Text style={styles.timelineTitle}>
                Weave Timeline
            </Text>
        </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
        <SectionList
            sections={timelineSections}
            renderItem={renderTimelineItem}
            keyExtractor={(item) => item.id.toString()}
            renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeaderContainer}>
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
            )}
            ListHeaderComponent={<ListHeader />}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>🕸️</Text>
                    <Text style={styles.emptyText}>No weaves yet</Text>
                    <Text style={styles.emptySubtext}>Your timeline will grow as you connect</Text>
                </View>
            }
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        />
        <InteractionDetailModal
            interaction={selectedInteraction}
            isOpen={selectedInteraction !== null}
            onClose={() => setSelectedInteraction(null)}
            friendName={friend.name}
        />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    loadingContainer: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: theme.colors.border },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    contentContainer: { padding: 20, gap: 24 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12 },
    actionButton: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    actionButtonTextPrimary: { color: 'white', fontSize: 18, fontWeight: '500' },
    actionButtonTextSecondary: { color: theme.colors.foreground, fontSize: 18, fontWeight: '500' },
    timelineTitle: { fontSize: 24, fontWeight: '600', color: theme.colors.foreground, marginBottom: 24 },
    sectionHeaderContainer: {
        width: '100%',
        paddingVertical: 8,
        paddingLeft: 130, // Offset to clear the thread and align with cards
        paddingRight: 20, // Match item padding
    },
    sectionHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors['muted-foreground'],
        textAlign: 'center',
    },
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyEmoji: { fontSize: 40, marginBottom: 16, opacity: 0.5 },
    emptyText: { color: theme.colors['muted-foreground'] },
    emptySubtext: { fontSize: 12, color: 'rgba(138, 138, 138, 0.7)', marginTop: 4 },
    swipeableContainer: { paddingHorizontal: 20, overflow: 'visible' },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: theme.colors.background,
        paddingBottom: 24,
    },
    dateColumn: { width: 64, alignItems: 'flex-end', paddingTop: 8, paddingRight: 8 },
    dateText: { fontSize: 12, color: theme.colors['muted-foreground'], fontWeight: '500' },
    timeText: { fontSize: 11, color: 'rgba(138, 138, 138, 0.7)' },
    knotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        position: 'relative',
    },
    thread: {
        position: 'absolute',
        top: 0,
        bottom: -24, // Extend below the container to connect with the next item
        width: 2,
        left: '50%',
        marginLeft: -1,
    },
    threadDashed: {
        backgroundColor: 'transparent',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    knot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(247, 245, 242, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        elevation: 2,
        zIndex: 1,
    },
    cardContainer: { flex: 1 },
    card: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22, elevation: 3 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    cardIcon: { fontSize: 24 },
    cardTitle: { fontWeight: '500', color: theme.colors.foreground, marginBottom: 4, fontSize: 15 },
    cardSubtitle: { fontSize: 12, color: theme.colors['muted-foreground'], textTransform: 'capitalize', marginBottom: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    statusCompleted: { backgroundColor: '#dcfce7' },
    statusPlanned: { backgroundColor: '#fef9c3' },
    statusBadgeText: { fontSize: 12, fontWeight: '500' },
    statusCompletedText: { color: '#166534' },
    statusPlannedText: { color: '#854d0e' },
    deleteButton: { backgroundColor: theme.colors.destructive, justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, padding: 16 },
    connectByButton: {
        backgroundColor: theme.colors.secondary,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectByButtonText: {
        color: theme.colors.foreground,
        fontSize: 14,
        fontWeight: '500',
    }
});