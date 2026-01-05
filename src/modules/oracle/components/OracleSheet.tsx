/**
 * OracleSheet
 * 
 * Global modal wrapper for the Oracle chat interface.
 * Can be opened from anywhere in the app via useOracleSheet().
 */

import React from 'react'
import { Modal, View, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native'
import { X } from 'lucide-react-native'
import { useTheme } from '@/shared/hooks/useTheme'
import { Text } from '@/shared/ui/Text'
import { useOracleSheet } from '../hooks/useOracleSheet'
import { OracleChat } from './OracleChat'

export function OracleSheet() {
    const { colors, typography } = useTheme()
    const { isOpen, params, close } = useOracleSheet()

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

                    <View style={{ width: 24 }} />
                </View>

                {/* Oracle Chat Content */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <OracleChat
                        context={params.context || 'default'}
                        friendId={params.friendId}
                        friendName={params.friendName}
                        onClose={close}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
