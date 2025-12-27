import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsItem } from './SettingsItem';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Users,
    MessageSquare,
    Shield,
    FileText,
    Sparkles,
    User,
    LogOut,
} from 'lucide-react-native';

// Modals
import { FeedbackModal } from '../FeedbackModal';

// Feature flags and auth
import { isFeatureEnabled } from '@/shared/config/feature-flags';
import { getCurrentSession, signOut } from '@/modules/auth/services/supabase-auth.service';

interface GeneralSettingsProps {
    onClose: () => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [smartDefaultsEnabled, setSmartDefaultsEnabled] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | undefined>();

    useEffect(() => {
        loadSettings();
        checkAuthStatus();
    }, []);

    const loadSettings = async () => {
        const smartDefaultsStr = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
        setSmartDefaultsEnabled(smartDefaultsStr ? JSON.parse(smartDefaultsStr) : true);
    };

    const checkAuthStatus = async () => {
        if (!isFeatureEnabled('ACCOUNT_UI_ENABLED')) return;
        const session = await getCurrentSession();
        console.log('[Settings] Auth status:', session ? 'signed in' : 'signed out', session?.email);
        setIsSignedIn(session !== null);
        setUserEmail(session?.email);
    };

    const handleToggleSmartDefaults = async (enabled: boolean) => {
        setSmartDefaultsEnabled(enabled);
        await AsyncStorage.setItem('@weave:smart_defaults_enabled', JSON.stringify(enabled));
    };

    const handleSignOut = async () => {
        console.log('[Settings] Signing out...');
        const result = await signOut();
        console.log('[Settings] Sign out result:', result);
        setIsSignedIn(false);
        setUserEmail(undefined);
    };

    return (
        <View className="gap-4">
            {/* Account Section - Only show if feature is enabled */}
            {isFeatureEnabled('ACCOUNT_UI_ENABLED') && (
                <>
                    <Text className="text-xs font-inter-semibold uppercase tracking-wide mb-2" style={{ color: colors['muted-foreground'] }}>
                        Account
                    </Text>

                    {isSignedIn ? (
                        <>
                            <SettingsItem
                                icon={User}
                                title="Your Profile"
                                subtitle={userEmail || 'Edit username and display name'}
                                onPress={() => {
                                    onClose();
                                    router.push('/profile');
                                }}
                            />
                            <SettingsItem
                                icon={LogOut}
                                title="Sign Out"
                                subtitle="Sign out of your account"
                                onPress={handleSignOut}
                            />
                        </>
                    ) : (
                        <SettingsItem
                            icon={User}
                            title="Sign In"
                            subtitle="Create an account to share weaves"
                            onPress={() => {
                                onClose();
                                router.push('/auth');
                            }}
                        />
                    )}

                    <View className="border-t border-border" style={{ borderColor: colors.border }} />
                </>
            )}

            {/* Community / Management */}
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

