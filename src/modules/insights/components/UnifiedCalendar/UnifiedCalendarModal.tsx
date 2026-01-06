/**
 * UnifiedCalendarModal
 * Modal wrapper for the UnifiedCalendar component with Moons/Patterns tabs
 */

import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { X, Calendar, Sparkles } from 'lucide-react-native';
import { startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { UnifiedCalendar } from './UnifiedCalendar';
import { PatternsTabContent } from '@/modules/intelligence/components/social-season/YearInMoons/PatternsTabContent';
import { EditInteractionModal } from '@/modules/interactions';
import { InteractionActions } from '@/modules/interactions/services/interaction.actions';
import { SocialBatterySheet } from '@/modules/home/components/widgets/SocialBatterySheet';
import { SocialBatteryService } from '@/modules/auth/services/social-battery.service';
import { useUserProfile } from '@/modules/auth/hooks/useUserProfile';
import { database } from '@/db';

type TabId = 'moons' | 'patterns';

interface UnifiedCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: TabId;
    onOpenPlanWizard?: (friendId?: string, friendName?: string) => void;
}

const TABS: { id: TabId; label: string; icon: typeof Calendar }[] = [
    { id: 'moons', label: 'Moons', icon: Calendar },
    { id: 'patterns', label: 'Patterns', icon: Sparkles },
];

export function UnifiedCalendarModal({
    isOpen,
    onClose,
    initialTab = 'moons',
    onOpenPlanWizard,
}: UnifiedCalendarModalProps) {
    const { tokens, isDarkMode } = useTheme();
    const { profile } = useUserProfile();
    const [currentTab, setCurrentTab] = useState<TabId>(initialTab);

    // Battery check-in state
    const [isBatterySheetOpen, setIsBatterySheetOpen] = useState(false);
    const [checkinDate, setCheckinDate] = useState<Date | null>(null);
    const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

    // Reset tab when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setCurrentTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Battery check-in handlers
    const handleOpenBatteryCheckin = React.useCallback((date?: Date) => {
        const targetDate = date || new Date();
        console.log('[UnifiedCalendarModal] handleOpenBatteryCheckin:', targetDate);
        setCheckinDate(targetDate);
        setIsBatterySheetOpen(true);
    }, []);

    const handleBatterySubmit = React.useCallback(async (value: number, note?: string) => {
        if (!profile || !checkinDate) return;

        try {
            const timestamp = startOfDay(checkinDate).getTime() + 12 * 60 * 60 * 1000;
            await SocialBatteryService.submitCheckin(profile.id, value, note, timestamp, true);
            setIsBatterySheetOpen(false);
            // Trigger calendar refresh to show the new battery data
            setCalendarRefreshTrigger(prev => prev + 1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('[UnifiedCalendarModal] Error submitting battery check-in:', error);
        }
    }, [profile, checkinDate]);

    const handleBatteryDismiss = React.useCallback(() => {
        setIsBatterySheetOpen(false);
    }, []);

    // Edit Weave Modal State
    const [selectedWeaveId, setSelectedWeaveId] = React.useState<string | null>(null);
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [selectedInteraction, setSelectedInteraction] = React.useState<any>(null);

    const handleEditWeave = React.useCallback(async (weaveId: string) => {
        try {
            const interaction = await database.get('interactions').find(weaveId);
            setSelectedInteraction(interaction);
            setSelectedWeaveId(weaveId);
            setShowEditModal(true);
        } catch (error) {
            console.error('[UnifiedCalendarModal] Error loading weave:', error);
        }
    }, []);

    const handleSaveInteraction = React.useCallback(async (interactionId: string, updates: any) => {
        await InteractionActions.updateInteraction(interactionId, updates);
        setShowEditModal(false);
        setSelectedInteraction(null);
        setSelectedWeaveId(null);
        // Note: Calendar will auto-refresh via observables
    }, []);

    return (
        <>
            <Modal
                visible={isOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
                    {/* Header */}
                    <View
                        className="flex-row items-center justify-between px-5 py-3"
                        style={{ borderBottomWidth: 1, borderBottomColor: tokens.border }}
                    >
                        <Text
                            className="text-xl font-lora-bold"
                            style={{ color: tokens.foreground }}
                        >
                            Life Calendar
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2 -mr-2 rounded-full"
                            style={{ backgroundColor: tokens.backgroundMuted }}
                        >
                            <X size={20} color={tokens.foreground} />
                        </TouchableOpacity>
                    </View>

                    {/* Tab Navigation */}
                    <View
                        className="flex-row px-5 py-3 gap-2"
                        style={{ backgroundColor: tokens.background }}
                    >
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = currentTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    onPress={() => setCurrentTab(tab.id)}
                                    className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                                    style={{
                                        backgroundColor: isActive
                                            ? tokens.primary + '15'
                                            : 'transparent',
                                    }}
                                >
                                    <Icon
                                        size={16}
                                        color={isActive ? tokens.primary : tokens.foregroundMuted}
                                    />
                                    <Text
                                        className="text-sm font-inter-medium"
                                        style={{
                                            color: isActive ? tokens.primary : tokens.foregroundMuted,
                                        }}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Content */}
                    {currentTab === 'moons' && (
                        <UnifiedCalendar
                            onOpenPlanWizard={onOpenPlanWizard}
                            onOpenBatteryCheckin={handleOpenBatteryCheckin}
                            onEditWeave={handleEditWeave}
                            refreshTrigger={calendarRefreshTrigger}
                        />
                    )}
                    {currentTab === 'patterns' && <PatternsTabContent />}

                    {/* Battery Check-in Sheet - Inside Modal like YearInMoonsModal */}
                    <SocialBatterySheet
                        isVisible={isBatterySheetOpen}
                        onSubmit={handleBatterySubmit}
                        onDismiss={handleBatteryDismiss}
                    />
                </SafeAreaView>
            </Modal>


            <EditInteractionModal
                interaction={selectedInteraction}
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedInteraction(null);
                    setSelectedWeaveId(null);
                }}
                onSave={handleSaveInteraction}
            />
        </>
    );
}
