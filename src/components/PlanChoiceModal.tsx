import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Lightbulb, Calendar, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface PlanChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetIntention: () => void;
  onSchedulePlan: () => void;
}

/**
 * Choice option row styled to match app's design language
 */
function OptionRow({
  onPress,
  icon,
  iconBgColor,
  title,
  subtitle,
  tokens,
  typography,
  isLast = false,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  subtitle: string;
  tokens: any;
  typography: any;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[
        styles.optionRow,
        { backgroundColor: tokens.card },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        {icon}
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionTitle, { color: tokens.foreground, fontFamily: typography.fonts.sansMedium }]}>
          {title}
        </Text>
        <Text style={[styles.optionSubtitle, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }]}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight color={tokens.foregroundMuted} size={20} />
    </TouchableOpacity>
  );
}

/**
 * Modal for choosing how to plan a connection
 * Styled to match Weave's warm, mindful aesthetic
 */
export function PlanChoiceModal({
  isOpen,
  onClose,
  onSetIntention,
  onSchedulePlan,
}: PlanChoiceModalProps) {
  const { tokens, typography, isDarkMode } = useTheme();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)' }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: tokens.background,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDarkMode ? 0.4 : 0.15,
              shadowRadius: 24,
              elevation: 10,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: tokens.backgroundMuted }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X color={tokens.foregroundMuted} size={16} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: tokens.foreground, fontFamily: typography.fonts.serifBold }]}>
              Plan a Weave
            </Text>
            <Text style={[styles.headerSubtitle, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }]}>
              Choose how you'd like to connect
            </Text>
          </View>

          {/* Options */}
          <View style={[styles.optionsContainer, { borderColor: tokens.border }]}>
            <OptionRow
              onPress={onSetIntention}
              icon={<Lightbulb color={tokens.mystic?.accent || tokens.primary} size={22} />}
              iconBgColor={(tokens.mystic?.accent || tokens.primary) + '20'}
              title="Set an Intention"
              subtitle="A gentle reminder without a date"
              tokens={tokens}
              typography={typography}
            />
            <OptionRow
              onPress={onSchedulePlan}
              icon={<Calendar color={tokens.primary} size={22} />}
              iconBgColor={tokens.primary + '20'}
              title="Schedule a Plan"
              subtitle="Add a specific date to your timeline"
              tokens={tokens}
              typography={typography}
              isLast
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  optionsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 14,
  },
  optionTitle: {
    fontSize: 16,
  },
  optionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});

