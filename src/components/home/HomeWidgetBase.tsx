import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

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
}

export const HomeWidgetBase: React.FC<HomeWidgetBaseProps> = ({
  config,
  children,
  isLoading = false,
  error = null,
  onPress,
}) => {
  const { colors } = useTheme();

  const containerStyle = [
    styles.container,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      minHeight: config.minHeight || 160,
    },
    config.fullWidth && styles.fullWidth,
  ];

  const content = (
    <View style={containerStyle}>
      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors['destructive'] }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Content */}
      {!isLoading && !error && children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
  },
  container: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
  },
  fullWidth: {
    // Used for hero cards
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  errorContainer: {
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
