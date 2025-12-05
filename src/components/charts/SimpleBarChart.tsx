/**
 * SimpleBarChart
 * Minimal bar chart for energy/weave patterns
 * Shows labeled bars with values
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface BarData {
  label: string;
  value: number;
  maxValue?: number;
}

interface SimpleBarChartProps {
  data: BarData[];
  color?: string;
  height?: number;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  color,
  height = 80,
  showValues = false,
  formatValue = (v) => v.toFixed(1),
}) => {
  const { tokens, spacing } = useTheme();

  const barColor = color || tokens.primary;
  const maxValue = Math.max(...data.map(d => d.maxValue ?? d.value), 1);

  return (
    <View style={[styles.container, { height: height + 24 }]}>
      <View style={styles.barsContainer}>
        {data.map((item, index) => {
          const val = Number.isFinite(item.value) ? item.value : 0;
          const barHeight = Number.isFinite((val / maxValue) * height) ? (val / maxValue) * height : 0;

          return (
            <View key={index} style={styles.barColumn}>
              {/* Value label (optional) */}
              {showValues && (
                <Text style={[
                  styles.valueLabel,
                  {
                    color: tokens.foregroundMuted,
                    fontFamily: 'Inter_500Medium',
                  }
                ]}>
                  {formatValue(item.value)}
                </Text>
              )}

              {/* Bar container */}
              <View style={[styles.barWrapper, { height }]}>
                <View style={[
                  styles.barTrack,
                  { backgroundColor: tokens.borderSubtle }
                ]} />

                <View style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: barColor,
                    borderRadius: 4,
                  }
                ]} />
              </View>

              {/* Label */}
              <Text style={[
                styles.label,
                {
                  color: tokens.foregroundMuted,
                  fontFamily: 'Inter_500Medium',
                }
              ]}>
                {String(item.label)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flex: 1,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  valueLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  barWrapper: {
    width: '60%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: 4,
    opacity: 0.3,
  },
  bar: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    marginTop: 6,
  },
});
