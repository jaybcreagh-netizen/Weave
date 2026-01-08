/**
 * OracleSheet
 * 
 * Global modal wrapper for the Oracle chat interface.
 * Can be opened from anywhere in the app via useOracleSheet().
 */

import React, { useState } from 'react'
import { Modal, View, TouchableOpacity, SafeAreaView, Platform, InteractionManager } from 'react-native'
import { X, Clock } from 'lucide-react-native'
import Animated, { FadeIn, FadeOut, Easing } from 'react-native-reanimated'
import { useTheme } from '@/shared/hooks/useTheme'
import { Text } from '@/shared/ui/Text'
import { useOracleSheet } from '../hooks/useOracleSheet'
import { OracleLensMode } from '../services/types'
import { OracleChat } from './OracleChat'
import { OracleSplashScreen } from './OracleSplashScreen'
import { OracleModeSheet } from './OracleModeSheet'
import { InsightModeView } from './modes/InsightModeView'
import { PlanModeView } from './modes/PlanModeView'
import { ExpandModeView } from './modes/ExpandModeView'
import QuickActionsView from './modes/QuickActionsView'
import { PortalHost } from '@gorhom/portal'
import { PerfLogger } from '@/shared/utils/performance-logger';
import { ConversationHistoryList } from './ConversationHistoryList'
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet'

import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

export function OracleSheet() {
    const { colors, typography } = useTheme()
    const { isOpen, activeMode, close, params, setMode } = useOracleSheet()

    // NEW: Analytics Tracking
    const previousMode = React.useRef<OracleLensMode | null>(null);

    React.useEffect(() => {
        if (isOpen && activeMode && activeMode !== previousMode.current) {
            trackEvent(AnalyticsEvents.ORACLE_MODE_SWITCHED, {
                mode: activeMode,
                previous_mode: previousMode.current || 'none',
                trigger_context: params.context || 'unknown'
            });
            previousMode.current = activeMode;
        } else if (!isOpen) {
            previousMode.current = null; // Reset on close
        }
    }, [isOpen, activeMode, params.context]);

    const [isReady, setIsReady] = React.useState(false);
    const [showHistory, setShowHistory] = useState(false)
    const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined)

    React.useEffect(() => {
        if (isOpen) {
            PerfLogger.log('Oracle', 'Sheet Opened (Visible)');
            const timer = setTimeout(() => {
                setIsReady(true);
            }, 1500);
            return () => clearTimeout(timer);
        } else {
            setIsReady(false);
            setShowHistory(false);
            setSelectedConversationId(undefined);
            setMode(null); // Reset mode on close
        }
    }, [isOpen]);

    if (!isOpen) return null

    const renderContent = () => {
        if (!isReady) {
            return (
                <Animated.View
                    key="splash"
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(400)} // Longer fade out for smooth transition
                    style={{ flex: 1 }}
                >
                    <OracleSplashScreen />
                </Animated.View>
            )
        }

        switch (activeMode) {
            case 'go_deeper':
                return <InsightModeView />
            case 'plan_next_steps':
                return <PlanModeView />
            case 'expand_entry':
                return <ExpandModeView />
            case 'quick_actions':
                return <QuickActionsView />
            case 'consultation':
                return <OracleChat onClose={close} />
            default:
                return (
                    <Animated.View
                        key="mode-selection"
                        entering={FadeIn.duration(400).easing(Easing.out(Easing.ease))}
                        style={{ flex: 1 }}
                    >
                        <OracleModeSheet
                            visible={true}
                            onClose={close}
                            onSelectMode={setMode}
                        />
                    </Animated.View>
                )
        }
    }

    const showBackButton = activeMode && (params.context === 'journal' || activeMode !== 'consultation');

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={close}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View
                    className="flex-row items-center justify-between px-4 py-3 border-b"
                    style={{ borderBottomColor: colors.border }}
                >
                    {showBackButton ? (
                        <TouchableOpacity
                            onPress={() => setMode(null)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            className="flex-row items-center"
                        >
                            <Text style={{ color: colors.foreground, marginRight: 4 }}>← Back</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={24} color={colors.foreground} />
                        </TouchableOpacity>
                    )}

                    <Text
                        variant="h3"
                        style={{
                            color: colors.foreground,
                            fontFamily: typography.fonts.serifBold,
                        }}
                    >
                        Weave
                    </Text>

                    <TouchableOpacity
                        onPress={() => setShowHistory(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        <Clock size={24} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View className="flex-1">
                    {renderContent()}

                    {/* Portal Host for sheets rendered inside this modal */}
                    <PortalHost name="oracle-sheet-host" />
                </View>

                <StandardBottomSheet
                    visible={showHistory}
                    onClose={() => setShowHistory(false)}
                    title="Past Conversations"
                    portalHost="oracle-sheet-host"
                    snapPoints={['80%']}
                >
                    <ConversationHistoryList
                        onSelect={(id) => {
                            setSelectedConversationId(id)
                            setShowHistory(false)
                        }}
                        onClose={() => setShowHistory(false)}
                    />
                </StandardBottomSheet>
            </SafeAreaView>
        </Modal>
    )
}
