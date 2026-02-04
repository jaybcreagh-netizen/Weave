import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { MessageSquare, Shield, FileText } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsItem } from './SettingsItem';
import { FeedbackModal } from '../FeedbackModal';

interface SupportSettingsProps {
    onClose: () => void;
}

export const SupportSettings: React.FC<SupportSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    return (
        <View className="gap-4">
            <SettingsItem
                icon={MessageSquare}
                title="Send Feedback"
                subtitle="Report bugs or share ideas"
                onPress={() => setShowFeedbackModal(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Legal Section */}
            <Text className="text-xs font-inter-semibold uppercase tracking-wide mb-2 mt-2" style={{ color: colors['muted-foreground'] }}>
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
