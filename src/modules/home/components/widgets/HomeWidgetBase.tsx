import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
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
      style={[
        styles.card,
        {
          minHeight: config.minHeight || 160,
          backgroundColor: tokens.backgroundSubtle
        },
      ]}
    >
      {/* Loading State */}
      {isLoading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={tokens?.primary || colors.primary} />
        </View>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: tokens?.destructive || '#DC2626' }]}>
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

const styles = StyleSheet.create({
  card: {
    // marginBottom handled by grid gap
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
    padding: 16,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
});
