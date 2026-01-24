import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsItem } from './SettingsItem';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    MessageSquare,
    Shield,
    FileText,
    Sparkles,
    Zap,
} from 'lucide-react-native';
import { useUIStore } from '@/shared/stores/uiStore';

// Modals
import { FeedbackModal } from '../FeedbackModal';

// Feature flags and auth
import { isFeatureEnabled } from '@/shared/config/feature-flags';

// Settings keys
import { QUICK_WEAVE_ENABLED_KEY } from '@/modules/interactions/utils/quick-weave-settings';

interface GeneralSettingsProps {
    onClose: () => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [smartDefaultsEnabled, setSmartDefaultsEnabled] = useState(true);
    const [quickWeaveEnabled, setQuickWeaveEnabled] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const smartDefaultsStr = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
        setSmartDefaultsEnabled(smartDefaultsStr ? JSON.parse(smartDefaultsStr) : true);

        const quickWeaveStr = await AsyncStorage.getItem(QUICK_WEAVE_ENABLED_KEY);
        setQuickWeaveEnabled(quickWeaveStr ? JSON.parse(quickWeaveStr) : true);
    };

    const handleToggleSmartDefaults = async (enabled: boolean) => {
        setSmartDefaultsEnabled(enabled);
        await AsyncStorage.setItem('@weave:smart_defaults_enabled', JSON.stringify(enabled));
    };

    const handleToggleQuickWeave = async (enabled: boolean) => {
        setQuickWeaveEnabled(enabled);
        useUIStore.getState().setQuickWeaveFeatureEnabled(enabled);
        await AsyncStorage.setItem(QUICK_WEAVE_ENABLED_KEY, JSON.stringify(enabled));
    };

    return (
        <View className="gap-4">
            {/* Account Section - Only show if feature is enabled */}


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

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={MessageSquare}
                title="Send Feedback"
                subtitle="Report bugs or share ideas"
                onPress={() => setShowFeedbackModal(true)}
            />



            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Legal Section */}
            <Text className="text-xs font-inter-semibold uppercase tracking-wide mb-2" style={{ color: colors['muted-foreground'] }}>
                Legal
            </Text>

            <SettingsItem
                icon={Shield}
                title="Privacy Policy"
                subtitle="How we handle your data"
                onPress={() => {
                    onClose();
                    router.push('/privacy-policy');
                }}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={FileText}
                title="Terms of Service"
                subtitle="Usage agreement"
                onPress={() => {
                    onClose();
                    router.push('/terms-of-service');
                }}
            />

            {/* Modals */}
            <FeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
            />
        </View>
    );
};

