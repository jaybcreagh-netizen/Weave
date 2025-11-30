import React from 'react';
import { View } from 'react-native';
import Phase1 from '../../../assets/MoonIcons/Phase1.svg';
import Phase2 from '../../../assets/MoonIcons/Phase2.svg';
import Phase3 from '../../../assets/MoonIcons/Phase3.svg';
import Phase4 from '../../../assets/MoonIcons/Phase4.svg';
import Phase5 from '../../../assets/MoonIcons/Phase5.svg';

interface MoonPhaseIllustrationProps {
  phase: number; // 0-1 (0 = new moon/dark, 1 = full moon/bright)
  size?: number;
  hasCheckin?: boolean;
  batteryLevel?: number | null; // 1-5, if provided directly (avoids round-trip conversion)
  color?: string;
}

// Battery level moon icons
const MOON_ICONS = {
  1: Phase1, // New Moon - Depleted
  2: Phase2, // Waning - Low
  3: Phase3, // Half Moon - Balanced
  4: Phase4, // Waxing - Good
  5: Phase5, // Full Moon - High
};

export function MoonPhaseIllustration({
  phase,
  size = 40,
  hasCheckin = true,
  batteryLevel: providedBatteryLevel,
  color
}: MoonPhaseIllustrationProps) {
  // Use provided battery level if available, otherwise convert from phase
  let level: 1 | 2 | 3 | 4 | 5;
  if (providedBatteryLevel !== null && providedBatteryLevel !== undefined) {
    level = Math.max(1, Math.min(5, Math.round(providedBatteryLevel))) as 1 | 2 | 3 | 4 | 5;
  } else {
    // Convert phase (0-1) to battery level (1-5)
    level = Math.max(1, Math.min(5, Math.ceil(phase * 5) || 1)) as 1 | 2 | 3 | 4 | 5;
  }

  const MoonIcon = MOON_ICONS[level];

  // If no check-in, show Phase 1 (New Moon) with low opacity
  if (!hasCheckin) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
        <Phase1 width={size} height={size} fill={color} color={color} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <MoonIcon width={size} height={size} fill={color} color={color} />
    </View>
  );
}
