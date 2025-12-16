import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();

  return (
    <TouchableOpacity
      onPress={onClick}
      className="absolute right-6 w-16 h-16 rounded-full items-center justify-center z-50 shadow-lg"
      style={{
        bottom: insets.bottom + 24,
        backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
        shadowColor: isDarkMode ? colors.accent : '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 12,
      }}
    >
      <Plus color={isDarkMode ? colors['accent-foreground'] : colors.primary} size={28} />
    </TouchableOpacity>
  );
}