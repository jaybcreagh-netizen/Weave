import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Lightbulb, Calendar } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface PlanChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetIntention: () => void;
  onSchedulePlan: () => void;
}

/**
 * Modal that appears when user taps "Plan a Weave"
 * Offers choice between setting an intention or scheduling a concrete plan
 */
export function PlanChoiceModal({
  isOpen,
  onClose,
  onSetIntention,
  onSchedulePlan,
}: PlanChoiceModalProps) {
  const { colors, isDarkMode } = useTheme();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView style={styles.backdrop} intensity={isDarkMode ? 10 : 30} tint={isDarkMode ? 'dark' : 'light'}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[
              styles.modalContainer,
              { backgroundColor: isDarkMode ? colors.background + 'F5' : colors.background }
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Plan a Connection</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X color={colors['muted-foreground']} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.choices}>
              <TouchableOpacity
                style={[styles.choiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={onSetIntention}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
                  <Lightbulb color={colors.foreground} size={24} />
                </View>
                <View style={styles.choiceContent}>
                  <Text style={[styles.choiceTitle, { color: colors.foreground }]}>Set an Intention</Text>
                  <Text style={[styles.choiceDescription, { color: colors['muted-foreground'] }]}>
                    Want to connect but not ready to schedule yet
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={onSchedulePlan}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                  <Calendar color={colors['primary-foreground']} size={24} />
                </View>
                <View style={styles.choiceContent}>
                  <Text style={[styles.choiceTitle, { color: colors.foreground }]}>Schedule a Plan</Text>
                  <Text style={[styles.choiceDescription, { color: colors['muted-foreground'] }]}>
                    Ready to set a date and add to timeline
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  closeButton: {
    padding: 4,
  },
  choices: {
    gap: 16,
  },
  choiceCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceContent: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  choiceDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
