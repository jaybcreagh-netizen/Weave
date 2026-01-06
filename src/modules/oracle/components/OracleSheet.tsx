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
import { OracleChat } from './OracleChat'
import { SkeletonOracleChat } from './SkeletonOracleChat'
import { PortalHost } from '@gorhom/portal'
import { PerfLogger } from '@/shared/utils/performance-logger';
import { ConversationHistoryList } from './ConversationHistoryList'
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet'

export function OracleSheet() {
    const { colors, typography } = useTheme()
    const { isOpen, params, close } = useOracleSheet()

    const [isReady, setIsReady] = React.useState(false);
    const [showHistory, setShowHistory] = useState(false)
    const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined)

    React.useEffect(() => {
        if (isOpen) {
            PerfLogger.log('Oracle', 'Sheet Opened (Visible)');
            // Start mounting content quickly, but allow one frame for the modal to init
            const timer = setTimeout(() => {
                setIsReady(true);
            }, 50);
            return () => clearTimeout(timer);
        } else {
            setIsReady(false);
            // Reset state when closed
            setShowHistory(false);
            setSelectedConversationId(undefined);
        }
    }, [isOpen]);

    if (!isOpen) return null

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={close}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <View
                    className="flex-row items-center justify-between px-4 py-3 border-b"
                    style={{ borderBottomColor: colors.border }}
                >
                    <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={24} color={colors.foreground} />
                    </TouchableOpacity>

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

                {/* Oracle Chat Content */}
                <View className="flex-1">
                    {isReady ? (
                        <Animated.View
                            key="chat"
                            entering={FadeIn.duration(400).easing(Easing.out(Easing.ease))}
                            style={{ flex: 1 }}
                        >
                            <OracleChat
                                context={params.context || 'default'}
                                friendId={params.friendId}
                                friendName={params.friendName}
                                onClose={close}
                                portalHost="oracle-sheet-host"
                                initialQuestion={params.initialQuestion}
                                journalContent={params.journalContent}
                                lensContext={params.lensContext}
                                conversationId={selectedConversationId}
                            />
                        </Animated.View>
                    ) : (
                        <Animated.View
                            key="skeleton"
                            exiting={FadeOut.duration(200)}
                            style={{ flex: 1 }}
                        >
                            <SkeletonOracleChat />
                        </Animated.View>
                    )}

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
