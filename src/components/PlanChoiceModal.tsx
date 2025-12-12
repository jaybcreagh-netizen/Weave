import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lightbulb, Calendar, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';

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
  isLast = false,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  subtitle: string;
  isLast?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      className={`flex-row items-center p-4 ${!isLast ? 'border-b' : ''}`}
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border
      }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: iconBgColor }}
      >
        {icon}
      </View>
      <View className="flex-1 ml-3.5">
        <Text variant="body" weight="medium" style={{ color: colors.foreground }}>
          {title}
        </Text>
        <Text variant="caption" className="mt-0.5" style={{ color: colors['muted-foreground'] }}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight color={colors['muted-foreground']} size={20} />
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
  const { colors } = useTheme();

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={onClose}
      height="auto"
      title="Plan a Weave"
    >
      <View className="px-5 pb-8">
        <Text
          variant="body"
          className="mb-5 text-center"
          style={{ color: colors['muted-foreground'] }}
        >
          Choose how you'd like to connect
        </Text>

        <View
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: colors.border }}
        >
          <OptionRow
            onPress={onSetIntention}
            icon={<Lightbulb color={colors.primary} size={22} />}
            iconBgColor={colors.primary + '20'}
            title="Set an Intention"
            subtitle="A gentle reminder without a date"
          />
          <OptionRow
            onPress={onSchedulePlan}
            icon={<Calendar color={colors.primary} size={22} />}
            iconBgColor={colors.primary + '20'}
            title="Schedule a Plan"
            subtitle="Add a specific date to your timeline"
            isLast
          />
        </View>
      </View>
    </StandardBottomSheet>
  );
}
