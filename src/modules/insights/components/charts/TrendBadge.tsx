/**
 * TrendBadge
 * Shows trend direction with icon and value
 * Used for "↑ 5 from last week" style displays
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const { tokens, spacing } = useTheme();
  
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
  const fontSize = size === 'default' ? 14 : 12;
  
  const displayValue = isPositive ? `+${value}` : `${value}`;
  
  return (
    <View style={styles.container}>
      <View style={[styles.badge, { gap: spacing[1] }]}>
        <Icon size={iconSize} color={color} />
        <Text style={[
          styles.value,
          {
            color,
            fontSize,
            fontFamily: 'Inter_600SemiBold',
          }
        ]}>
          {displayValue}
        </Text>
      </View>
      {label && (
        <Text style={[
          styles.label,
          {
            color: tokens.foregroundMuted,
            fontSize: size === 'default' ? 13 : 11,
            fontFamily: 'Inter_400Regular',
            marginLeft: spacing[1],
          }
        ]}>
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {},
  label: {},
});
