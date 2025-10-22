import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, Calendar, MapPin, Heart, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { theme } from '../theme';
import { type Interaction, type MoonPhase } from './types';
import { modeIcons } from '../lib/constants';

const moonPhaseIcons: Record<MoonPhase, string> = {
  'NewMoon': '🌑',
  'WaxingCrescent': '🌒',
  'FirstQuarter': '🌓',
  'WaxingGibbous': '🌔',
  'FullMoon': '🌕',
  'WaningGibbous': '🌖',
  'LastQuarter': '🌗',
  'WaningCrescent': '🌘'
};

const formatDateTime = (date: Date | string): { date: string; time: string } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  };
};

export function InteractionDetailModal({
  interaction,
  isOpen,
  onClose,
  friendName
}: InteractionDetailModalProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 200) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!interaction) return null;

  const { date, time } = formatDateTime(interaction.interactionDate);
  const modeIcon = modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default;
  const moonIcon = interaction.vibe ? moonPhaseIcons[interaction.vibe as MoonPhase] : null;
  const isPast = new Date(interaction.interactionDate) < new Date();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <BlurView style={styles.backdrop} intensity={10} tint="dark">
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.modalContainer, { paddingBottom: insets.bottom }, animatedStyle]}>
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerIcon}>{modeIcon}</Text>
                <View>
                  <Text style={styles.headerTitle}>{interaction.activity}</Text>
                  <Text style={styles.headerSubtitle}>
                    {interaction.mode?.replace('-', ' ')} • {interaction.type}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <X color={theme.colors['muted-foreground']} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent}>
              <View style={[styles.statusBadge, interaction.status === 'completed' ? styles.statusCompleted : styles.statusPlanned]}>
                <Text style={[styles.statusBadgeText, interaction.status === 'completed' ? styles.statusCompletedText : styles.statusPlannedText]}>
                  {interaction.status === 'completed' ? '✓ Completed' : '⏳ Planned'}
                </Text>
              </View>

              <InfoRow icon={<Calendar color={theme.colors['muted-foreground']} size={20} />} title={date} subtitle={time} />
              {friendName && <InfoRow icon={<Heart color={theme.colors['muted-foreground']} size={20} />} title={friendName} subtitle="With" />}
              {isPast && moonIcon && <InfoRow icon={<Text style={{ fontSize: 24 }}>{moonIcon}</Text>} title={interaction.vibe?.replace(/([A-Z])/g, ' $1').trim()} subtitle="Moon phase" />}
              {interaction.location && <InfoRow icon={<MapPin color={theme.colors['muted-foreground']} size={20} />} title={interaction.location} subtitle="Location" />}
              {interaction.notes && <InfoRow icon={<MessageCircle color={theme.colors['muted-foreground']} size={20} />} title={interaction.notes} subtitle="Notes" />}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </BlurView>
    </Modal>
  );
}

const InfoRow = ({ icon, title, subtitle }: { icon: React.ReactNode, title: string, subtitle: string }) => (
    <View style={styles.infoRow}>
        <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
        <View style={{ flex: 1 }}>
            <Text style={styles.infoSubtitle}>{subtitle}</Text>
            <Text style={styles.infoTitle}>{title}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'rgba(247, 245, 242, 0.8)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
        height: '75%',
    },
    handleBarContainer: {
        padding: 16,
        alignItems: 'center',
    },
    handleBar: {
        width: 48,
        height: 6,
        backgroundColor: theme.colors.muted,
        borderRadius: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        paddingTop: 8,
    },
    headerTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    headerIcon: {
        fontSize: 32,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: theme.colors.foreground,
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.colors['muted-foreground'],
        textTransform: 'capitalize',
    },
    scrollViewContent: {
        padding: 24,
        gap: 24,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    statusCompleted: {
        backgroundColor: '#dcfce7',
    },
    statusPlanned: {
        backgroundColor: '#fef9c3',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    statusCompletedText: {
        color: '#166534',
    },
    statusPlannedText: {
        color: '#854d0e',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        backgroundColor: 'rgba(229, 225, 220, 0.5)', // muted/50
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
    },
    infoSubtitle: {
        fontSize: 14,
        color: theme.colors['muted-foreground'],
    },
    infoTitle: {
        fontWeight: '500',
        color: theme.colors.foreground,
    }
});