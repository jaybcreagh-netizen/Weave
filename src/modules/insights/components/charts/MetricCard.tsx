/**
 * MetricCard
 * Large metric display with optional trend and subtitle
 * iOS Health-style "big number first" pattern
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { TrendBadge } from './TrendBadge';

interface MetricCardProps {
  value: string | number;
  label: string;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  size?: 'large' | 'medium';
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  trend,
  trendLabel,
  subtitle,
  size = 'large',
  color,
}) => {
  const { tokens } = useTheme();

  const valueSize = size === 'large' ? 48 : 32;
  const labelSize = size === 'large' ? 14 : 12;

  return (
    <View>
      {/* Value row with trend */}
      <View className="flex-row items-end gap-3">
        <Text
          className="font-lora-bold leading-[56px]"
          style={{
            fontSize: valueSize,
            color: color || tokens.foreground,
          }}
        >
          {value}
        </Text>
        {trend !== undefined && (
          <View className="mb-2.5">
            <TrendBadge value={trend} label={trendLabel} />
          </View>
        )}
      </View>

      {/* Label */}
      <Text
        className="font-inter-regular"
        style={{
          fontSize: labelSize,
          color: tokens.foregroundMuted,
        }}
      >
        {label}
      </Text>

      {/* Optional subtitle */}
      {subtitle && (
        <Text
          className="text-xs font-inter-regular mt-2"
          style={{
            color: tokens.foregroundSubtle,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
};
