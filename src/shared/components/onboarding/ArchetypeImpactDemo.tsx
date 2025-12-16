import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeIcon } from '@/modules/intelligence';

interface ScoreBarProps {
  score: number;
  multiplier: string;
  label: string;
  color: string;
  delay: number;
}

function ScoreBar({ score, multiplier, label, color, delay }: ScoreBarProps) {
  const { colors } = useTheme();
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withSpring(score / 40, { // Scale to 40 as max (38 is close to full width)
        damping: 15,
        stiffness: 100,
      })
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="gap-2"
      entering={FadeInDown.delay(delay - 100).duration(400)}
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-[15px] font-medium" style={{ color: colors.foreground }}>{label}</Text>
        <View className="bg-muted px-2 py-1 rounded-md">
          <Text className="text-[11px] font-semibold" style={{ color: colors['muted-foreground'] }}>{multiplier}</Text>
        </View>
      </View>
      <View className="h-3 bg-muted rounded-full overflow-hidden">
        <Animated.View
          className="h-full rounded-full"
          style={[
            { backgroundColor: color },
            animatedBarStyle,
          ]}
        />
      </View>
      <Text className="text-base font-bold text-right" style={{ color: colors.foreground }}>+{score} points</Text>
    </Animated.View>
  );
}

export function ArchetypeImpactDemo() {
  const { colors } = useTheme();

  return (
    <View className="flex-1 items-center px-5 pt-5">
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text
          className="text-[28px] font-lora-bold text-center mb-2"
          style={{ color: colors.foreground }}
        >
          Why archetypes matter
        </Text>
        <Text
          className="text-base text-center mb-8 leading-6"
          style={{ color: colors['muted-foreground'] }}
        >
          Same friend. Different activities. Different impact.
        </Text>
      </Animated.View>

      <View
        className="w-full rounded-2xl p-5 border shadow-sm"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <View
          className="flex-row items-center gap-3 mb-6 pb-4 border-b"
          style={{ borderBottomColor: colors.border }}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary + '15' }}
          >
            <ArchetypeIcon archetype="Emperor" size={24} color={colors.primary} />
          </View>
          <View>
            <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>Alex (The Emperor)</Text>
            <Text className="text-xs mt-0.5" style={{ color: colors['muted-foreground'] }}>Values structure & achievement</Text>
          </View>
        </View>

        <View className="gap-5">
          <ScoreBar
            score={38}
            multiplier="2.0× multiplier"
            label="🎊 Milestone celebration"
            color={colors.primary}
            delay={600}
          />

          <ScoreBar
            score={6}
            multiplier="0.6× multiplier"
            label="💬 Quick text"
            color={colors['muted-foreground']}
            delay={1000}
          />
        </View>
      </View>

      <Animated.View
        className="mt-6 px-4"
        entering={FadeInDown.delay(1400).duration(400)}
      >
        <Text
          className="text-base text-center leading-6"
          style={{ color: colors.foreground }}
        >
          Archetypes help Weave suggest the <Text className="font-bold">right</Text> ways to connect,{'\n'}
          not just <Text className="font-bold">any</Text> ways.
        </Text>
      </Animated.View>

      <Animated.View
        className="mt-4 px-4"
        entering={FadeInDown.delay(1600).duration(400)}
      >
        <Text
          className="text-sm text-center italic"
          style={{ color: colors['muted-foreground'] }}
        >
          Don't worry—you can always change archetypes later as you learn.
        </Text>
      </Animated.View>
    </View>
  );
}

