import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, Sun, Zap, Sparkles, Users } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUIStore } from '@/shared/stores/uiStore';
import { SettingsItem } from './SettingsItem';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';

// Settings keys
import { QUICK_WEAVE_ENABLED_KEY, QUICK_WEAVE_MODE_KEY } from '@/modules/interactions/utils/quick-weave-settings';
import { SUGGESTION_NUDGES_ENABLED_KEY } from '@/modules/interactions/utils/suggestion-nudge-settings';

export const InteractionSettings = () => {
    const { colors } = useTheme();
    const {
        isDarkMode,
        toggleDarkMode,
        setQuickWeaveFeatureEnabled,
        setQuickWeaveMode,
        setSuggestionNudgesEnabled,
    } = useUIStore();

    const [smartDefaultsEnabled, setSmartDefaultsEnabled] = useState(true);
    const [quickWeaveEnabled, setQuickWeaveEnabled] = useState(true);
    const [quickWeaveMode, setQuickWeaveModeState] = useState<'gesture' | 'click'>('gesture');
    const [suggestionNudgesEnabled, setSuggestionNudgesEnabledState] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const smartDefaultsStr = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
        setSmartDefaultsEnabled(smartDefaultsStr ? JSON.parse(smartDefaultsStr) : true);

        const quickWeaveStr = await AsyncStorage.getItem(QUICK_WEAVE_ENABLED_KEY);
        setQuickWeaveEnabled(quickWeaveStr ? JSON.parse(quickWeaveStr) : true);

        const quickWeaveModeStr = await AsyncStorage.getItem(QUICK_WEAVE_MODE_KEY);
        setQuickWeaveModeState((quickWeaveModeStr as 'gesture' | 'click') || 'gesture');

        const suggestionNudgesStr = await AsyncStorage.getItem(SUGGESTION_NUDGES_ENABLED_KEY);
        const nudgesEnabled = suggestionNudgesStr ? JSON.parse(suggestionNudgesStr) : true;
        setSuggestionNudgesEnabledState(nudgesEnabled);
        setSuggestionNudgesEnabled(nudgesEnabled);
    };

    const handleToggleSmartDefaults = async (enabled: boolean) => {
        setSmartDefaultsEnabled(enabled);
        await AsyncStorage.setItem('@weave:smart_defaults_enabled', JSON.stringify(enabled));
    };

    const handleToggleQuickWeave = async (enabled: boolean) => {
        setQuickWeaveEnabled(enabled);
        setQuickWeaveFeatureEnabled(enabled);
        await AsyncStorage.setItem(QUICK_WEAVE_ENABLED_KEY, JSON.stringify(enabled));
    };

    const handleToggleQuickWeaveMode = async (mode: 'gesture' | 'click') => {
        setQuickWeaveModeState(mode);
        setQuickWeaveMode(mode);
        await AsyncStorage.setItem(QUICK_WEAVE_MODE_KEY, mode);
    };

    const handleToggleSuggestionNudges = async (enabled: boolean) => {
        setSuggestionNudgesEnabledState(enabled);
        setSuggestionNudgesEnabled(enabled);
        await AsyncStorage.setItem(SUGGESTION_NUDGES_ENABLED_KEY, JSON.stringify(enabled));
    };

    return (
        <View className="gap-4">
            {/* Theme Toggle */}
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

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Interaction Settings */}
            <SettingsItem
                icon={Zap}
                title="Quick Weave"
                subtitle="Long-press friends for radial quick log"
                rightElement={
                    <ModernSwitch
                        value={quickWeaveEnabled}
                        onValueChange={handleToggleQuickWeave}
                    />
                }
            />

            {quickWeaveEnabled && (
                <SettingsItem
                    icon={Zap}
                    title="Tap to Interact"
                    subtitle="Release to tap options instead of dragging"
                    isChild
                    rightElement={
                        <ModernSwitch
                            value={quickWeaveMode === 'click'}
                            onValueChange={(val) => handleToggleQuickWeaveMode(val ? 'click' : 'gesture')}
                        />
                    }
                />
            )}

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Users}
                title="Circle Suggestion Nudges"
                subtitle="Show subtle dots on friend cards with suggestions"
                rightElement={
                    <ModernSwitch
                        value={suggestionNudgesEnabled}
                        onValueChange={handleToggleSuggestionNudges}
                    />
                }
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Sparkles}
                title="Smart Activity Ordering"
                subtitle="Reorder activities by time of day & context"
                rightElement={
                    <ModernSwitch
                        value={smartDefaultsEnabled}
                        onValueChange={handleToggleSmartDefaults}
                    />
                }
            />
        </View>
    );
};
