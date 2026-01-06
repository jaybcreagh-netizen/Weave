import React, { useMemo } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { MessageCircle, ChevronRight, Clock, AlertCircle } from 'lucide-react-native'
import { useOracleHistory } from '../hooks/useOracleHistory'
import OracleConversation from '@/db/models/OracleConversation'
import { formatDistanceToNow } from 'date-fns'
import { FlashList } from '@shopify/flash-list'
import { useTheme } from '@/shared/hooks/useTheme'

interface Props {
    onSelect: (conversationId: string) => void
    onClose: () => void
}

export const ConversationHistoryList: React.FC<Props> = ({ onSelect, onClose }) => {
    const { conversations, isLoading } = useOracleHistory()
    const { colors } = useTheme()

    const sections = useMemo(() => {
        // Simple grouping could be added here if needed
        // For now, just a flat list sorted by date (from hook)
        return conversations
    }, [conversations])

    const renderItem = ({ item }: { item: OracleConversation }) => {
        return (
            <TouchableOpacity
                className="flex-row items-center p-4 border-b border-gray-100 dark:border-gray-800"
                onPress={() => onSelect(item.id)}
            >
                <View className="mr-3 bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
                    <MessageCircle size={20} color={colors['muted-foreground']} />
                </View>
                <View className="flex-1">
                    <Text variant="body" className="font-medium" numberOfLines={1}>
                        {item.title || 'New Conversation'}
                    </Text>
                    <Text variant="caption" className="text-gray-500 mt-1">
                        {formatDistanceToNow(item.lastMessageAt, { addSuffix: true })} · {item.turnCount} turns
                    </Text>
                </View>
                <ChevronRight size={16} color={colors['muted-foreground']} />
            </TouchableOpacity>
        )
    }

    if (isLoading) {
        return (
            <View className="p-8 items-center">
                <Text>Loading history...</Text>
            </View>
        )
    }

    if (conversations.length === 0) {
        return (
            <View className="p-8 items-center justify-center flex-1">
                <Clock size={48} color={colors.muted} />
                <Text variant="h3" className="mt-4 text-center text-gray-400">
                    No Past Conversations
                </Text>
                <Text variant="body" className="mt-2 text-center text-gray-400">
                    Your chats with the Oracle will appear here.
                </Text>
            </View>
        )
    }

    return (
        <View className="flex-1 bg-white dark:bg-gray-900">
            {/* Header handled by BottomSheet typically, but we can keep list clean */}
            <FlashList
                data={sections}
                renderItem={renderItem}
                estimatedItemSize={70}
                keyExtractor={(item) => item.id}
            />
        </View>
    )
}
