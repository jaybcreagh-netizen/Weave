/**
 * TrendBadge
 * Shows trend direction with icon and value
 * Used for "↑ 5 from last week" style displays
 */

import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface TrendBadgeProps {
  value: number;
  label?: string; // e.g., "from last week"
  size?: 'default' | 'small';
  showZero?: boolean; // Whether to show badge when value is 0
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  label,
  size = 'default',
  showZero = false,
}) => {
  const { tokens } = useTheme();

  // Don't render if zero and showZero is false
  if (value === 0 && !showZero) {
    return null;
  }

  const isPositive = value > 0;
  const isNeutral = value === 0;

  const color = isNeutral
    ? tokens.foregroundMuted
    : isPositive
      ? tokens.success
      : tokens.destructive;

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const iconSize = size === 'default' ? 16 : 14;

  const displayValue = isPositive ? `+${value}` : `${value}`;

  return (
    <View className="flex-row items-center">
      <View className="flex-row items-center gap-0.5">
        <Icon size={iconSize} color={color} />
        <Text
          className={size === 'default' ? 'text-sm font-inter-semibold' : 'text-xs font-inter-semibold'}
          style={{ color }}
        >
          {displayValue}
        </Text>
      </View>
      {label && (
        <Text
          className="ml-0.5 font-inter-regular"
          style={{
            color: tokens.foregroundMuted,
            fontSize: size === 'default' ? 13 : 11,
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
};
