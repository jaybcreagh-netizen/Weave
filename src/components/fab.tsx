import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();

  const fabStyle = {
    ...styles.container,
    bottom: insets.bottom + 24,
    backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
    shadowColor: isDarkMode ? colors.accent : '#000',
  };

  const iconColor = isDarkMode ? colors['accent-foreground'] : colors.primary;

  return (
    <TouchableOpacity
      onPress={onClick}
      style={fabStyle}
    >
      <Plus color={iconColor} size={28} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: 64,
        height: 64,
        borderRadius: 32,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 12,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        right: 24,
    }
});