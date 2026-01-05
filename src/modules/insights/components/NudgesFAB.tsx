import React, { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { usePausableAnimation } from '@/shared/hooks/usePausableAnimation';
import { Text } from '@/shared/ui';

interface NudgesFABProps {
  isVisible: boolean;
  hasSuggestions: boolean;
  hasCritical: boolean;
  onClick: () => void;
  /** Count of pending activity (link requests + shared weaves) */
  pendingActivityCount?: number;
}

import { useOracleSheet } from '@/modules/oracle/hooks/useOracleSheet';

export function NudgesFAB({ isVisible, hasSuggestions, hasCritical, onClick, pendingActivityCount = 0 }: NudgesFABProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const pulseScale = useSharedValue(1);
  const { open } = useOracleSheet();

  // Pause animation when app is sleeping (backgrounded or idle) to save battery
  const { isSleeping } = usePausableAnimation(pulseScale);

  // Gentle pulse animation - pauses when app is sleeping
  useEffect(() => {
    if ((hasSuggestions || pendingActivityCount > 0) && !isSleeping) {
      pulseScale.value = withRepeat(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [hasSuggestions, pendingActivityCount, isSleeping]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!isVisible) return null;

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Open Oracle with circle context (shows nudges)
        open({ context: 'circle' });
      }}
      style={{
        position: 'absolute',
        left: 20,
        bottom: insets.bottom + 20,
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
        shadowColor: isDarkMode ? colors.accent : '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 10,
      }}
    >
      <Animated.View style={iconStyle}>
        <WeaveIcon size={24} color={colors.foreground} />
      </Animated.View>

      {/* Activity Badge */}
      {pendingActivityCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.destructive,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: '700',
            }}
          >
            {pendingActivityCount > 9 ? '9+' : pendingActivityCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
