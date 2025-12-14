/**
 * MetricCard
 * Large metric display with optional trend and subtitle
 * iOS Health-style "big number first" pattern
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const { tokens, spacing } = useTheme();

  const valueSize = size === 'large' ? 48 : 32;
  const labelSize = size === 'large' ? 14 : 12;

  return (
    <View style={styles.container}>
      {/* Value row with trend */}
      <View style={styles.valueRow}>
        <Text style={[
          styles.value,
          {
            fontSize: valueSize,
            color: color || tokens.foreground,
            fontFamily: 'Lora_700Bold',
          }
        ]}>
          {value}
        </Text>
        {trend !== undefined && (
          <View style={styles.trendContainer}>
            <TrendBadge value={trend} label={trendLabel} />
          </View>
        )}
      </View>

      {/* Label */}
      <Text style={[
        styles.label,
        {
          fontSize: labelSize,
          color: tokens.foregroundMuted,
          fontFamily: 'Inter_400Regular',
        }
      ]}>
        {label}
      </Text>

      {/* Optional subtitle */}
      {subtitle && (
        <Text style={[
          styles.subtitle,
          {
            color: tokens.foregroundSubtle,
            fontFamily: 'Inter_400Regular',
            marginTop: spacing[2],
          }
        ]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align to bottom
    gap: 12,
  },
  value: {
    lineHeight: 56,
  },
  trendContainer: {
    marginBottom: 10, // Lift slightly to align with text baseline
  },
  label: {},
  subtitle: {
    fontSize: 12,
  },
});
