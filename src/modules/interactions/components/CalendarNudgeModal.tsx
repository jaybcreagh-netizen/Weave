import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, Bell, RefreshCw, ArrowRight } from 'lucide-react-native';

import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { requestCalendarPermissions, saveCalendarSettings } from '../services/calendar.service';
import { logger } from '@/shared/services/logger.service';

interface CalendarNudgeModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    onConnected: () => void;
}

/**
 * Calendar Nudge Modal
 * 
 * Shown to users who haven't enabled calendar integration yet.
 * Encourage them to connect for better scheduling and reminders.
 */
export function CalendarNudgeModal({ isOpen, onDismiss, onConnected }: CalendarNudgeModalProps) {
    const { colors } = useTheme();
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            // Request permissions
            const granted = await requestCalendarPermissions();

            if (granted) {
                // Save enabled state (just in case they had it disabled in settings)
                await saveCalendarSettings({
                    enabled: true,
                    calendarId: null, // Let service pick default
                    reminderMinutes: 60,
                    twoWaySync: true
                });

                onConnected();
            } else {
                // If denied, we can't do much. 
                // Maybe they denied it in system settings.
                // For now, just dismiss.
                onDismiss();
            }
        } catch (error) {
            logger.error('CalendarNudgeModal', 'Failed to connect calendar:', error);
            onDismiss();
        } finally {
            setIsConnecting(false);
        }
    };

    const benefits = [
        { icon: RefreshCw, text: 'Sync your weaves with your calendar' },
        { icon: Bell, text: 'Get notified about upcoming friend time' },
        { icon: Calendar, text: 'Avoid scheduling conflicts' },
    ];

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onDismiss}
            height="full"
            title="Calendar Integration"
        >
            <View style={styles.container}>
                {/* Header Illustration */}
                <View style={[styles.illustrationContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Calendar size={48} color={colors.primary} />
                </View>

                {/* Tagline */}
                <Text variant="h2" style={styles.title}>
                    Never miss a moment
                </Text>

                <Text variant="body" style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
                    Connect your calendar to automatically sync planned weaves and get helpful reminders.
                </Text>

                {/* Benefits List */}
                <View style={styles.benefitsList}>
                    {benefits.map((benefit, index) => (
                        <View key={index} style={styles.benefitRow}>
                            <View style={[styles.benefitIcon, { backgroundColor: colors.secondary + '20' }]}>
                                <benefit.icon size={18} color={colors.secondary} />
                            </View>
                            <Text variant="body" style={{ flex: 1 }}>
                                {benefit.text}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        variant="primary"
                        label="Connect Calendar"
                        icon={<ArrowRight size={18} color={colors['primary-foreground']} />}
                        onPress={handleConnect}
                        loading={isConnecting}
                        fullWidth
                    />
                    <Button
                        variant="ghost"
                        label="Not Now"
                        onPress={onDismiss}
                        fullWidth
                        style={styles.dismissButton}
                    />
                </View>
            </View>
        </StandardBottomSheet>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
    },
    illustrationContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 24,
        maxWidth: '90%',
    },
    benefitsList: {
        width: '100%',
        gap: 12,
        marginBottom: 28,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    benefitIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actions: {
        width: '100%',
        gap: 8,
    },
    dismissButton: {
        marginTop: 4,
    },
});
