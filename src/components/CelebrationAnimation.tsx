import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';

interface CelebrationAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  intensity?: 'light' | 'moderate' | 'deep' | 'profound';
}

/**
 * Celebration animation that appears when:
 * 1. User logs a weave (light celebration)
 * 2. User deepens a weave (intensity based on deepening level)
 */
export function CelebrationAnimation({
  visible,
  onComplete,
  intensity = 'moderate',
}: CelebrationAnimationProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  // Particle animations
  const particles = Array.from({ length: intensity === 'profound' ? 12 : intensity === 'deep' ? 8 : intensity === 'moderate' ? 5 : 3 });

  useEffect(() => {
    if (visible) {
      // Main animation sequence
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 })
      );

      opacity.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
        withDelay(
          600, // Shortened to 600ms for all intensities
          withTiming(0, { duration: 200 }, (finished) => {
            if (finished && onComplete) {
              runOnJS(onComplete)();
            }
          })
        )
      );

      rotation.value = withSequence(
        withTiming(360, { duration: intensity === 'profound' ? 800 : 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 })
      );
    } else {
      scale.value = 0;
      opacity.value = 0;
      rotation.value = 0;
    }
  }, [visible, intensity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Center burst */}
      <Animated.View style={[styles.centerBurst, animatedStyle]}>
        <View style={styles.sparkleContainer}>
          <Text style={styles.sparkleText}>✨</Text>
        </View>
      </Animated.View>

      {/* Particle burst */}
      {particles.map((_, i) => (
        <Particle key={i} index={i} total={particles.length} intensity={intensity} />
      ))}
    </View>
  );
}

function Particle({ index, total, intensity }: { index: number; total: number; intensity: string }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const angle = (index / total) * Math.PI * 2;
    const distance = intensity === 'profound' ? 120 : intensity === 'deep' ? 100 : 80;

    translateX.value = withSequence(
      withTiming(Math.cos(angle) * distance, { duration: 500, easing: Easing.out(Easing.quad) }),
      withTiming(Math.cos(angle) * distance * 1.2, { duration: 300 })
    );

    translateY.value = withSequence(
      withTiming(Math.sin(angle) * distance, { duration: 500, easing: Easing.out(Easing.quad) }),
      withTiming(Math.sin(angle) * distance * 1.2, { duration: 300 })
    );

    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(300, withTiming(0, { duration: 400 }))
    );

    scale.value = withSequence(
      withSpring(1, { damping: 10 }),
      withDelay(300, withTiming(0, { duration: 400 }))
    );
  }, []);

  const particleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particle, particleStyle]}>
      <Text style={styles.particleText}>✨</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  centerBurst: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleText: {
    fontSize: 50,
    textAlign: 'center',
  },
  particle: {
    position: 'absolute',
  },
  particleText: {
    fontSize: 20,
  },
});
