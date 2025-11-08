/**
 * MoonPhaseIllustration
 * Moon emoji rendering based on battery level
 * Uses same emojis as social battery slider for consistency
 */

import React from 'react';
import { View, Text } from 'react-native';

interface MoonPhaseIllustrationProps {
  phase: number; // 0-1 (0 = new moon/dark, 1 = full moon/bright)
  size?: number;
  hasCheckin?: boolean;
}

// Battery level moon emojis (matching SocialBatterySheet)
const MOON_EMOJIS = {
  1: '🌑', // New Moon - Depleted
  2: '🌘', // Waning - Low
  3: '🌗', // Half Moon - Balanced
  4: '🌖', // Waxing - Good
  5: '🌕', // Full Moon - High
};

export function MoonPhaseIllustration({
  phase,
  size = 40,
  hasCheckin = true
}: MoonPhaseIllustrationProps) {
  // If no check-in, show a faint new moon
  if (!hasCheckin) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
        <Text style={{ fontSize: size * 0.9 }}>🌑</Text>
      </View>
    );
  }

  // Convert phase (0-1) to battery level (1-5)
  const batteryLevel = Math.max(1, Math.min(5, Math.round(phase * 5) || 1)) as 1 | 2 | 3 | 4 | 5;
  const emoji = MOON_EMOJIS[batteryLevel];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.9 }}>{emoji}</Text>
    </View>
  );
}
