import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={onClick}
      style={[styles.container, { bottom: insets.bottom + 24 }]}
    >
      <Plus color={theme.colors.primary} size={28} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: 64,
        height: 64,
        backgroundColor: theme.colors.primary + '33',
        borderRadius: 32,
        shadowColor: '#000',
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