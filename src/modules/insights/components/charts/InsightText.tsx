/**
 * InsightText
 * Natural language insight with optional icon
 * Used for contextual summaries like "Inner Circle is thriving ✓"
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Check, AlertCircle, Info } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

type InsightType = 'positive' | 'warning' | 'neutral';

interface InsightTextProps {
  text: string;
  type?: InsightType;
  showIcon?: boolean;
}

export const InsightText: React.FC<InsightTextProps> = ({
  text,
  type = 'neutral',
  showIcon = true,
}) => {
  const { tokens } = useTheme();

  const getColor = () => {
    switch (type) {
      case 'positive':
        return tokens.success;
      case 'warning':
        return tokens.warning;
      default:
        return tokens.foregroundMuted;
    }
  };

  const getIcon = () => {
    if (!showIcon) return null;

    const iconSize = 14;
    const color = getColor();

    switch (type) {
      case 'positive':
        return <Check size={iconSize} color={color} />;
      case 'warning':
        return <AlertCircle size={iconSize} color={color} />;
      default:
        return <Info size={iconSize} color={color} />;
    }
  };

  const color = getColor();

  return (
    <View className="flex-row items-center gap-1.5">
      {getIcon()}
      <Text
        className="text-[13px] leading-[18px] font-inter-regular"
        style={{ color }}
      >
        {text}
      </Text>
    </View>
  );
};
