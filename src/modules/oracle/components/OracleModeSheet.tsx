import React from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native'
import { OracleLensMode } from '../services/types'
import {
    Sparkles,
    Calendar,
    Feather,
    Zap,
    X,
    Loader2,
    MessageCircle
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { useTheme } from '@/shared/hooks/useTheme'
import { useOracleSheet } from '../hooks/useOracleSheet'

interface Props {
    visible: boolean
    onClose: () => void
    onSelectMode: (mode: OracleLensMode) => void
    loading?: boolean
}

const getModeConfig = (friendName?: string, context?: string): Partial<Record<OracleLensMode, {
    icon: any,
    color: string,
    label: string,
    description: string
}>> => {
    const config: Partial<Record<OracleLensMode, {
        icon: any,
        color: string,
        label: string,
        description: string
    }>> = {
        'consultation': {
            icon: MessageCircle,
            color: '#8B5CF6',
            label: friendName ? `Ask about ${friendName}` : 'Consult Oracle',
            description: friendName ? `Get guidance on your friendship with ${friendName}.` : 'Ask a question or seek guidance on your relationships.'
        },
        'go_deeper': {
            icon: Sparkles,
            color: '#7C3AED', // Purple
            label: friendName ? 'Deepen Connection' : 'Go Deeper',
            description: friendName ? `Understand your dynamic with ${friendName} better.` : 'Understand this moment with full context about your connection.'
        },
        'plan_next_steps': {
            icon: Calendar,
            color: '#2563EB', // Blue
            label: friendName ? `Plan with ${friendName}` : 'Plan Next Steps',
            description: 'Turn this into action: schedule a meetup, reminder, or intention.'
        },
        'quick_actions': {
            icon: Zap,
            color: '#D97706', // Orange
            label: friendName ? `Actions for ${friendName}` : 'Quick Actions',
            description: 'Directly access tools with pre-filled context.'
        }
    }

    // Only show expand_entry if we are NOT in a friend context
    // This makes it explicitly hidden for Friend Profiles
    if (context !== 'friend') {
        config['expand_entry'] = {
            icon: Feather,
            color: '#059669', // Green
            label: 'Expand This Entry',
            description: 'Capture more detail with a quick guided reflection.'
        }
    }

    return config
}

export const OracleModeSheet = ({ visible, onClose, onSelectMode, loading = false }: Props) => {
    const { colors, isDarkMode } = useTheme()
    const { params } = useOracleSheet()

    // Debug logging
    React.useEffect(() => {
        console.log('[OracleModeSheet] params:', params);
        console.log('[OracleModeSheet] friendName:', params?.friendName);
    }, [params]);

    const modeConfig = React.useMemo(
        () => getModeConfig(params?.friendName, params?.context),
        [params?.friendName, params?.context]
    )

    if (!visible) return null

    return (
        <SafeAreaView className="flex-1">
            {/* Header */}
            <View className="px-6 pt-6 pb-4 flex-row justify-between items-start">
                <View className="flex-1 mr-4">
                    <Text
                        className="text-2xl font-bold mb-1"
                        style={{
                            color: colors.foreground,
                            fontFamily: 'Lora_700Bold'
                        }}
                    >
                        Oracle
                    </Text>
                    <Text
                        className="text-base"
                        style={{
                            color: colors.foreground,
                            opacity: 0.6,
                            fontFamily: 'Inter_400Regular'
                        }}
                    >
                        What would you like to do?
                    </Text>
                </View>
            </View>

            {/* Content */}
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 24, paddingTop: 10, gap: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View className="items-center justify-center py-20 gap-4">
                        <View className="p-4 rounded-full bg-white/50 dark:bg-black/20">
                            <Loader2 size={32} color={colors.primary} className="animate-spin" />
                        </View>
                        <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular' }}>
                            Initializing...
                        </Text>
                    </View>
                ) : (
                    (Object.keys(modeConfig) as OracleLensMode[]).map((mode) => {
                        const config = modeConfig[mode]
                        if (!config) return null
                        const Icon = config.icon

                        return (
                            <TouchableOpacity
                                key={mode}
                                onPress={() => onSelectMode(mode)}
                                activeOpacity={0.7}
                                className="w-full rounded-2xl overflow-hidden border"
                                style={{
                                    backgroundColor: config.color + '10', // 10% opacity tint
                                    borderColor: config.color + '30', // 30% border opacity
                                    // Soft shadow for depth
                                    shadowColor: isDarkMode ? '#000' : '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: isDarkMode ? 0.3 : 0.05,
                                    shadowRadius: 8,
                                    elevation: 2
                                }}
                            >
                                <View className="p-5 flex-row gap-4 items-center">
                                    {/* Icon Container */}
                                    <View
                                        className="w-12 h-12 rounded-full items-center justify-center shrink-0"
                                        style={{
                                            backgroundColor: config.color + '20', // 20% opacity tint for icon bg
                                        }}
                                    >
                                        <Icon size={24} color={config.color} />
                                    </View>

                                    <View className="flex-1 gap-1">
                                        <Text
                                            className="text-lg font-bold leading-tight"
                                            style={{
                                                color: colors.foreground,
                                                fontFamily: 'Inter_600SemiBold'
                                            }}
                                        >
                                            {config.label}
                                        </Text>

                                        <Text
                                            className="text-sm leading-relaxed"
                                            style={{
                                                color: colors.foreground,
                                                opacity: 0.7,
                                                fontFamily: 'Inter_400Regular'
                                            }}
                                        >
                                            {config.description}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    )
}
