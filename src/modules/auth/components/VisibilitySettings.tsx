/**
 * VisibilitySettings
 *
 * Controls what linked friends can see on your profile.
 * Settings are stored in user_profiles.visibility_settings JSONB column.
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Eye, EyeOff, Users, Globe } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { getCurrentSession } from '@/modules/auth/services/supabase-auth.service';
import { logger } from '@/shared/services/logger.service';

type VisibilityLevel = 'public' | 'friends' | 'hidden';

interface VisibilitySettings {
    displayName: VisibilityLevel;
    archetype: VisibilityLevel;
    birthday: VisibilityLevel;
}

const DEFAULT_SETTINGS: VisibilitySettings = {
    displayName: 'friends',
    archetype: 'friends',
    birthday: 'friends',
};

const VISIBILITY_OPTIONS: { value: VisibilityLevel; label: string; icon: typeof Eye }[] = [
    { value: 'public', label: 'Anyone', icon: Globe },
    { value: 'friends', label: 'Friends Only', icon: Users },
    { value: 'hidden', label: 'Hidden', icon: EyeOff },
];

interface VisibilitySettingsProps {
    onSettingsChange?: (settings: VisibilitySettings) => void;
}

export function VisibilitySettingsComponent({ onSettingsChange }: VisibilitySettingsProps) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<VisibilitySettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const session = await getCurrentSession();
            if (!session) {
                setLoading(false);
                return;
            }

            const client = getSupabaseClient();
            if (!client) {
                setLoading(false);
                return;
            }

            const { data, error } = await client
                .from('user_profiles')
                .select('visibility_settings')
                .eq('id', session.userId)
                .single();

            if (error) {
                logger.error('VisibilitySettings', 'Failed to load settings:', error);
            } else if (data?.visibility_settings) {
                setSettings({
                    ...DEFAULT_SETTINGS,
                    ...data.visibility_settings,
                });
            }
        } catch (error) {
            logger.error('VisibilitySettings', 'Exception loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (field: keyof VisibilitySettings, value: VisibilityLevel) => {
        const newSettings = { ...settings, [field]: value };
        setSettings(newSettings);
        onSettingsChange?.(newSettings);

        setSaving(true);
        try {
            const session = await getCurrentSession();
            if (!session) return;

            const client = getSupabaseClient();
            if (!client) return;

            const { error } = await client
                .from('user_profiles')
                .update({ visibility_settings: newSettings })
                .eq('id', session.userId);

            if (error) {
                logger.error('VisibilitySettings', 'Failed to save settings:', error);
                Alert.alert('Error', 'Failed to save visibility settings');
                // Revert on error
                setSettings(settings);
            }
        } catch (error) {
            logger.error('VisibilitySettings', 'Exception saving settings:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
            </Card>
        );
    }

    const renderField = (field: keyof VisibilitySettings, label: string) => (
        <View key={field} style={{ marginBottom: 16 }}>
            <Text variant="caption" style={{ marginBottom: 8, color: colors['muted-foreground'] }}>
                {label}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {VISIBILITY_OPTIONS.map((option) => {
                    const isSelected = settings[field] === option.value;
                    const IconComponent = option.icon;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            onPress={() => updateSetting(field, option.value)}
                            disabled={saving}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                backgroundColor: isSelected ? colors.primary + '20' : 'transparent',
                                borderColor: isSelected ? colors.primary : colors.border,
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            <IconComponent
                                size={16}
                                color={isSelected ? colors.primary : colors['muted-foreground']}
                            />
                            <Text
                                style={{
                                    fontSize: 12,
                                    color: isSelected ? colors.primary : colors.foreground,
                                    fontWeight: isSelected ? '600' : '400',
                                }}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <Card style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Eye size={20} color={colors.primary} />
                <Text variant="h4" style={{ color: colors.foreground }}>
                    Profile Visibility
                </Text>
            </View>

            <Text variant="caption" style={{ marginBottom: 16, color: colors['muted-foreground'] }}>
                Control what linked friends can see on your profile.
            </Text>

            {renderField('displayName', 'Display Name')}
            {renderField('archetype', 'Your Archetype')}
            {renderField('birthday', 'Birthday')}
        </Card>
    );
}

export default VisibilitySettingsComponent;
