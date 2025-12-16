/**
 * TierProgressRow
 * Horizontal progress bar with label, percentage, and count
 * Used for showing tier health in Circle Health card
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ProgressBar } from '@/shared/ui/ProgressBar';

interface TierProgressRowProps {
  label: string;
  progress: number; // 0-100
  count: number;
  color: string;
}

export const TierProgressRow: React.FC<TierProgressRowProps> = ({
  label,
  progress,
  count,
  color,
}) => {
  const { tokens } = useTheme();

  return (
    <View className="gap-1.5">
      {/* Label row */}
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <Text
            className="text-sm font-inter-medium"
            style={{
              color: tokens.foreground,
            }}
          >
            {label}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text
            className="text-sm font-inter-semibold"
            style={{
              color: tokens.foreground,
            }}
          >
            {Math.round(progress)}%
          </Text>
          <Text
            className="text-[13px] font-inter-regular"
            style={{
              color: tokens.foregroundMuted,
            }}
          >
            ({count})
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <ProgressBar
        progress={progress}
        color={color}
        height={6}
      />
    </View>
  );
};
