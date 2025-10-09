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
      <Plus color="white" size={28} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: 64,
        height: 64,
        backgroundColor: theme.colors.primary,
        borderRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        right: 24,
    }
});