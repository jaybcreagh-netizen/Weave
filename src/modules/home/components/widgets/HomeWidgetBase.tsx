import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/ui/Card';

export interface HomeWidgetConfig {
  id: string;
  type: string;
  title?: string;
  minHeight?: number;
  fullWidth?: boolean; // If true, takes full width instead of half
}

export interface HomeWidgetProps {
  onPress?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

interface HomeWidgetBaseProps {
  config: HomeWidgetConfig;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onPress?: () => void;
  padding?: 'default' | 'large' | 'none';
}

export const HomeWidgetBase: React.FC<HomeWidgetBaseProps> = ({
  config,
  children,
  isLoading = false,
  error = null,
  onPress,
  padding,
}) => {
  const { colors, tokens } = useTheme();

  const content = (
    <Card
      variant={config.fullWidth ? 'default' : 'default'}
      padding={padding === 'large' ? 'lg' : padding === 'none' ? 'none' : 'md'}
      className="justify-center"
      style={{
        minHeight: config.minHeight || 160,
        backgroundColor: tokens.backgroundSubtle
      }}
    >
      {/* Loading State */}
      {isLoading && (
        <View className="flex-1 justify-center items-center min-h-[120px] p-4">
          <ActivityIndicator size="large" color={tokens?.primary || colors.primary} />
        </View>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <View className="flex-1 justify-center items-center min-h-[120px] p-4">
          <Text
            className="text-sm text-center font-sans"
            style={{ color: tokens?.destructive || '#DC2626' }}
          >
            {error}
          </Text>
        </View>
      )}

      {/* Content */}
      {!isLoading && !error && children}
    </Card>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return content;
};

