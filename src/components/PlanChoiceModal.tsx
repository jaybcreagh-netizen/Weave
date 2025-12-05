import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { X, Lightbulb, Calendar } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';

interface PlanChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetIntention: () => void;
  onSchedulePlan: () => void;
}

/**
 * Card component with press animation
 */
function ChoiceCard({
  onPress,
  icon,
  title,
  description,
  accentColor,
  gradient,
  isDarkMode,
  colors,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  gradient: string[];
  isDarkMode: boolean;
  colors: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        className="rounded-2xl overflow-hidden"
        style={{
          borderWidth: 1,
          borderColor: isDarkMode ? colors.border : accentColor + '30',
        }}
      >
        <BlurView intensity={isDarkMode ? 40 : 80} tint={isDarkMode ? 'dark' : 'light'}>
          <LinearGradient
            colors={['transparent', isDarkMode ? '#1a1d2e' : '#FAF1E0'] as any}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View className="flex-row items-center gap-4">
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center"
                style={{ backgroundColor: accentColor + '20' }}
              >
                {icon}
              </View>
              <View className="flex-1">
                <Text className="font-inter-semibold text-lg mb-1" style={{ color: colors.foreground }}>
                  {title}
                </Text>
                <Text className="font-inter-regular text-sm leading-5" style={{ color: colors['muted-foreground'] }}>
                  {description}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
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
      <View
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20
        }}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          className="w-full max-w-md rounded-3xl p-6"
          style={{
            backgroundColor: isDarkMode ? colors.background : colors.background,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
            borderWidth: 1,
            borderColor: isDarkMode ? colors.border : 'transparent',
          }}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-3">
            <View>
              <Text className="font-lora-bold text-2xl" style={{ color: colors.foreground }}>
                How would you like to connect?
              </Text>
              <Text className="font-inter-regular text-sm mt-1" style={{ color: colors['muted-foreground'] }}>
                Choose what feels right for this moment
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
              <X color={colors['muted-foreground']} size={22} />
            </TouchableOpacity>
          </View>

          {/* Choices */}
          <View className="gap-3 mt-6">
            <ChoiceCard
              onPress={onSetIntention}
              icon={<Lightbulb color={colors.primary} size={26} />}
              title="Set an Intention"
              description="Hold the thought without committing to a date"
              accentColor={colors.primary}
              gradient={
                isDarkMode
                  ? [colors.card, colors.card]
                  : [colors.primary + '08', colors.primary + '15']
              }
              isDarkMode={isDarkMode}
              colors={colors}
            />

            <ChoiceCard
              onPress={onSchedulePlan}
              icon={<Calendar color={colors.primary} size={26} />}
              title="Schedule a Plan"
              description="Pick a date and add it to your timeline"
              accentColor={colors.primary}
              gradient={
                isDarkMode
                  ? [colors.card, colors.card]
                  : [colors.primary + '08', colors.primary + '15']
              }
              isDarkMode={isDarkMode}
              colors={colors}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const StyleSheet = {
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as const,
};

