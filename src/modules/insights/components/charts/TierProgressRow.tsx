/**
 * TierProgressRow
 * Horizontal progress bar with label, percentage, and count
 * Used for showing tier health in Circle Health card
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const { tokens, spacing } = useTheme();
  
  return (
    <View style={styles.container}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[
            styles.label,
            {
              color: tokens.foreground,
              fontFamily: 'Inter_500Medium',
            }
          ]}>
            {label}
          </Text>
        </View>
        <View style={styles.labelRight}>
          <Text style={[
            styles.percentage,
            {
              color: tokens.foreground,
              fontFamily: 'Inter_600SemiBold',
            }
          ]}>
            {Math.round(progress)}%
          </Text>
          <Text style={[
            styles.count,
            {
              color: tokens.foregroundMuted,
              fontFamily: 'Inter_400Regular',
            }
          ]}>
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

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 14,
  },
  labelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentage: {
    fontSize: 14,
  },
  count: {
    fontSize: 13,
  },
});
