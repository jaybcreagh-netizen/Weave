/**
 * SimpleBarChart
 * Minimal bar chart for energy/weave patterns
 * Shows labeled bars with values
 */

import React from 'react';
import { View, Text } from 'react-native';
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
  const { tokens } = useTheme();

  const barColor = color || tokens.primary;
  const maxValue = Math.max(...data.map(d => d.maxValue ?? d.value), 1);

  return (
    <View style={{ height: height + 24 }}>
      <View className="flex-row justify-between items-end flex-1">
        {data.map((item, index) => {
          const val = Number.isFinite(item.value) ? item.value : 0;
          const barHeight = Number.isFinite((val / maxValue) * height) ? (val / maxValue) * height : 0;

          return (
            <View key={index} className="flex-1 items-center">
              {/* Value label (optional) */}
              {showValues && (
                <Text
                  className="text-[10px] mb-1 font-inter-medium"
                  style={{
                    color: tokens.foregroundMuted,
                  }}
                >
                  {formatValue(item.value)}
                </Text>
              )}

              {/* Bar container */}
              <View
                className="w-[60%] justify-end relative"
                style={{ height }}
              >
                <View
                  className="absolute bottom-0 left-0 right-0 h-full rounded opacity-30"
                  style={{ backgroundColor: tokens.borderSubtle }}
                />

                <View
                  className="w-full rounded"
                  style={{
                    height: barHeight,
                    backgroundColor: barColor,
                  }}
                />
              </View>

              {/* Label */}
              <Text
                className="text-[11px] mt-1.5 font-inter-medium"
                style={{
                  color: tokens.foregroundMuted,
                }}
              >
                {String(item.label)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};
