import React from 'react';
import { View } from 'react-native';
import Phase1 from '@/assets/MoonIcons/Phase1.svg';
import Phase2 from '@/assets/MoonIcons/Phase2.svg';
import Phase3 from '@/assets/MoonIcons/Phase3.svg';
import Phase4 from '@/assets/MoonIcons/Phase4.svg';
import Phase5 from '@/assets/MoonIcons/Phase5.svg';

interface MoonPhaseIllustrationProps {
  phase: number; // 0-1 (0 = new moon/dark, 1 = full moon/bright)
  size?: number;
  hasCheckin?: boolean;
  batteryLevel?: number | null; // 1-5, if provided directly (avoids round-trip conversion)
  color?: string; // Optional override - defaults to energy-based color
}

// Battery level moon icons
const MOON_ICONS = {
  1: Phase1, // New Moon - Depleted
  2: Phase2, // Waning - Low
  3: Phase3, // Half Moon - Balanced
  4: Phase4, // Waxing - Good
  5: Phase5, // Full Moon - High
};

// Energy-based color palette: warm earthy tones that match the app aesthetic
// Depleted (1) = dusty rose/terracotta, Full (5) = warm sage/forest
const ENERGY_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#C9866B', // Dusty terracotta - depleted
  2: '#D4A574', // Warm sand - low
  3: '#C9985A', // Aged gold - balanced (matches app primary)
  4: '#A8B98A', // Sage green - good
  5: '#7D9B76', // Forest sage - full
};

// Muted color for days without check-in
const NO_CHECKIN_COLOR = '#A8A29E';

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
  // Use energy color based on level, or override with provided color
  const moonColor = color ?? ENERGY_COLORS[level];

  // If no check-in, show Phase 1 (New Moon) with low opacity and muted color
  if (!hasCheckin) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: 0.25 }}>
        <Phase1 width={size} height={size} fill={NO_CHECKIN_COLOR} color={NO_CHECKIN_COLOR} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <MoonIcon width={size} height={size} fill={moonColor} color={moonColor} />
    </View>
  );
}
