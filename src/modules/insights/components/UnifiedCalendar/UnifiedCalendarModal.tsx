/**
 * UnifiedCalendarModal
 * Modal wrapper for the UnifiedCalendar component with Moons/Patterns tabs
 */

import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { X, Calendar, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/shared/hooks/useTheme';
import { UnifiedCalendar } from './UnifiedCalendar';
import { PatternsTabContent } from '@/modules/intelligence/components/social-season/YearInMoons/PatternsTabContent';

type TabId = 'moons' | 'patterns';

interface UnifiedCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: TabId;
    onOpenPlanWizard?: (friendId?: string, friendName?: string) => void;
    onOpenBatteryCheckin?: (date?: Date) => void;
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
    onOpenBatteryCheckin,
}: UnifiedCalendarModalProps) {
    const { tokens, isDarkMode } = useTheme();
    const [currentTab, setCurrentTab] = useState<TabId>(initialTab);

    // Reset tab when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setCurrentTab(initialTab);
        }
    }, [isOpen, initialTab]);

    return (
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
                        onOpenBatteryCheckin={onOpenBatteryCheckin}
                    />
                )}
                {currentTab === 'patterns' && <PatternsTabContent />}
            </SafeAreaView>
        </Modal>
    );
}
