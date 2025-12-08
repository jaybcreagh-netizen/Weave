import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsItem } from './SettingsItem';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Users,
    MessageSquare,
    Trophy,
    BookOpen,
    Shield,
    FileText,
    Sparkles
} from 'lucide-react-native';

// Modals
import TrophyCabinetModal from '../TrophyCabinetModal';
import { FeedbackModal } from '../FeedbackModal';
import { ArchetypeLibrary } from '../ArchetypeLibrary';
import { FriendManagementModal } from '../FriendManagementModal';

interface GeneralSettingsProps {
    onClose: () => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showTrophyCabinet, setShowTrophyCabinet] = useState(false);
    const [showArchetypeLibrary, setShowArchetypeLibrary] = useState(false);
    const [showFriendManagement, setShowFriendManagement] = useState(false);
    const [smartDefaultsEnabled, setSmartDefaultsEnabled] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const smartDefaultsStr = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
        setSmartDefaultsEnabled(smartDefaultsStr ? JSON.parse(smartDefaultsStr) : true);
    };

    const handleToggleSmartDefaults = async (enabled: boolean) => {
        setSmartDefaultsEnabled(enabled);
        await AsyncStorage.setItem('@weave:smart_defaults_enabled', JSON.stringify(enabled));
    };

    return (
        <View className="gap-4">
            {/* Community / Management */}
            <SettingsItem
                icon={Users}
                title="Manage Groups"
                subtitle="Create and edit friend groups"
                onPress={() => {
                    onClose();
                    setTimeout(() => setShowFriendManagement(true), 300);
                }}
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

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={MessageSquare}
                title="Send Feedback"
                subtitle="Report bugs or share ideas"
                onPress={() => setShowFeedbackModal(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Trophy}
                title="Trophy Cabinet"
                subtitle="View your achievements"
                onPress={() => setShowTrophyCabinet(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={BookOpen}
                title="Archetype Library"
                subtitle="Explore connection archetypes"
                onPress={() => setShowArchetypeLibrary(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Users}
                title="Manage Friends"
                subtitle="Batch remove friends"
                onPress={() => setShowFriendManagement(true)}
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
            <TrophyCabinetModal
                visible={showTrophyCabinet}
                onClose={() => setShowTrophyCabinet(false)}
            />

            <FeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
            />

            <ArchetypeLibrary
                isVisible={showArchetypeLibrary}
                onClose={() => setShowArchetypeLibrary(false)}
            />

            <FriendManagementModal
                visible={showFriendManagement}
                onClose={() => setShowFriendManagement(false)}
            />
        </View>
    );
};
