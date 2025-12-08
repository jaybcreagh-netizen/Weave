import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { Moon, Sun } from 'lucide-react-native';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { SettingsItem } from './SettingsItem';

export const AppearanceSettings = () => {
    const { colors } = useTheme();
    const { isDarkMode, toggleDarkMode } = useUIStore();

    return (
        <SettingsItem
            icon={isDarkMode ? Moon : Sun}
            title={isDarkMode ? "Dark Theme" : "Light Theme"}
            subtitle={isDarkMode ? "Mystic arcane theme" : "Warm cream theme"}
            rightElement={
                <ModernSwitch
                    value={isDarkMode}
                    onValueChange={toggleDarkMode}
                />
            }
        />
    );
};
