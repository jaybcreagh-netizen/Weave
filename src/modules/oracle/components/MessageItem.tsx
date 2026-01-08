
import React from 'react'
import { View } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { User } from 'lucide-react-native'
import { WeaveIcon } from '@/shared/components/WeaveIcon'
import { CachedImage } from '@/shared/ui/CachedImage'
import { SimpleMarkdown } from './SimpleMarkdown'
import { OracleActionButton } from './OracleActionButton'
import { OracleTurn } from '../services/oracle-service'
import { OracleAction } from '../services/types'

interface MessageItemProps {
    item: OracleTurn
    isUser?: boolean // Optional, derived from item.role
    colors: any
    typography: any
    user: any
    onAction: (action: OracleAction) => void
}

/**
 * Memoized message item to prevent re-renders during typing
 */
export const MessageItem = React.memo(({ item, colors, typography, user, onAction }: MessageItemProps) => {
    const isUser = item.role === 'user'

    return (
        <View className="mb-4">
            <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                    <View
                        className="w-8 h-8 rounded-full items-center justify-center mr-2 mt-1"
                        style={{ backgroundColor: colors.primary }}
                    >
                        <WeaveIcon size={16} color={colors['primary-foreground']} />
                    </View>
                )}

                <View
                    className={`px-4 py-3 rounded-2xl max-w-[80%] ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                    style={{
                        backgroundColor: isUser ? colors.primary : colors.card,
                        borderWidth: isUser ? 0 : 1,
                        borderColor: colors.border
                    }}
                >
                    {isUser ? (
                        <Text style={{ color: colors['primary-foreground'], fontFamily: typography.fonts.sans }}>
                            {item.content}
                        </Text>
                    ) : (
                        <SimpleMarkdown
                            content={item.content}
                            style={{
                                color: colors.foreground,
                                fontFamily: typography.fonts.sans,
                                fontSize: 15,
                                lineHeight: 22,
                            }}
                        />
                    )}
                </View>

                {isUser && (
                    <View
                        className="w-8 h-8 rounded-full items-center justify-center ml-2 mt-1 overflow-hidden"
                        style={{ backgroundColor: colors.muted }}
                    >
                        {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                            <CachedImage
                                source={{ uri: user?.user_metadata?.avatar_url || user?.user_metadata?.picture }}
                                style={{ width: 32, height: 32 }}
                                contentFit="cover"
                            />
                        ) : (
                            <User size={16} color={colors['muted-foreground']} />
                        )}
                    </View>
                )}
            </View>

            {!isUser && item.action && (
                <View className="ml-10">
                    <OracleActionButton action={item.action} onPress={onAction} />
                </View>
            )}
        </View>
    )
})
