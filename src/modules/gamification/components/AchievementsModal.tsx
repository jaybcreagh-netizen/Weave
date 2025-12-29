import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAchievements } from '../hooks/useAchievements';

type Achievement = ReturnType<typeof useAchievements>['achievements'][0];

/**
 * @interface AchievementsModalProps
 * @property {boolean} visible - Whether the modal is visible.
 * @property {() => void} onClose - Function to call when the modal is closed.
 */
interface AchievementsModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * A modal component to display the user's achievements.
 *
 * @param {AchievementsModalProps} props - The props for the component.
 * @returns {React.ReactElement | null} The rendered AchievementsModal component.
 */
export const AchievementsModal: React.FC<AchievementsModalProps> = ({ visible, onClose }) => {
  const { colors, isDarkMode } = useTheme();
  const { achievements, loading } = useAchievements();
  const [shouldRender, setShouldRender] = useState(false);

  const sheetTranslateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      sheetTranslateY.value = withSpring(0, { damping: 35, stiffness: 200 });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else if (shouldRender) {
      sheetTranslateY.value = withTiming(600, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible, shouldRender]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const renderAchievement = ({ item }: { item: Achievement }) => (
    <View className="mb-4 w-full">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>{item.name}</Text>
        <Text className="font-inter-regular text-xs" style={{ color: colors['muted-foreground'] }}>{item.isUnlocked ? 'Unlocked' : `${Math.floor(item.progress)}%`}</Text>
      </View>
      <Text className="font-inter-regular text-xs mb-2" style={{ color: colors['muted-foreground'] }}>{item.description}</Text>
      <View className="h-2 w-full bg-gray-200 rounded-full">
        <View style={{ height: 8, width: `${item.progress}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
      </View>
    </View>
  );

  if (!shouldRender) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <Animated.View style={animatedBackdropStyle} className="absolute inset-0">
        <BlurView intensity={isDarkMode ? 40 : 20} className="absolute inset-0" />
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          animatedSheetStyle,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t px-6 pt-6 pb-10 shadow-2xl"
      >
        <View className="mb-6 flex-row items-center justify-between">
          <Text style={{ color: colors.foreground }} className="font-lora text-[22px] font-bold">Achievements</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={{ color: colors.foreground }}>Loading...</Text>
        ) : (
          <FlatList
            data={achievements}
            renderItem={renderAchievement}
            keyExtractor={(item) => item.id}
            className="w-full"
          />
        )}
      </Animated.View>
    </Modal>
  );
};
