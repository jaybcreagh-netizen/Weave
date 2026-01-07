/**
 * OracleActionButton Component
 * Renders a tappable action button for Oracle suggestions.
 */

import React from 'react'
import { TouchableOpacity, Text, View } from 'react-native'
import { Calendar, Gift, BookOpen, CalendarPlus, LucideIcon, AlarmClock, User, Sparkles, Zap, Share } from 'lucide-react-native'
import { useTheme } from '@/shared/hooks/useTheme'
import { OracleAction, OracleActionType } from '../services/types'
// Types
import { OracleMode } from '../services/types'

interface OracleActionButtonProps {
    action: OracleAction
    onPress: (action: OracleAction) => void
}

const ACTION_CONFIG: Record<OracleActionType, {
    label: string
    Icon: LucideIcon
    color: string
}> = {
    log_weave: { label: 'Log this weave', Icon: CalendarPlus, color: '#8B5CF6' },
    add_life_event: { label: 'Add life event', Icon: Gift, color: '#EC4899' },
    create_reflection: { label: 'Save reflection', Icon: BookOpen, color: '#10B981' },
    plan_weave: { label: 'Plan a meetup', Icon: Calendar, color: '#F59E0B' },
    set_reminder: { label: 'Set reminder', Icon: AlarmClock, color: '#3B82F6' },
    view_friend: { label: 'View friend', Icon: User, color: '#6366F1' },
    view_insights: { label: 'View insights', Icon: Sparkles, color: '#8B5CF6' },
    start_deepening: { label: 'Deepen bond', Icon: Zap, color: '#F43F5E' },
    share_summary: { label: 'Share summary', Icon: Share, color: '#10B981' },
}

export function OracleActionButton({ action, onPress }: OracleActionButtonProps) {
    const { colors, typography } = useTheme()
    const config = ACTION_CONFIG[action.type]

    if (!config) return null

    const { label, Icon, color } = config

    return (
        <TouchableOpacity
            onPress={() => onPress(action)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: `${color}15`,
                borderWidth: 1,
                borderColor: `${color}40`,
                marginTop: 8,
                alignSelf: 'flex-start',
            }}
            activeOpacity={0.7}
        >
            <Icon size={16} color={color} />
            <Text
                style={{
                    marginLeft: 8,
                    color: color,
                    fontFamily: typography.fonts.sans,
                    fontWeight: '500',
                    fontSize: 14,
                }}
            >
                {label}
                {action.friendName && ` for ${action.friendName}`}
            </Text>
        </TouchableOpacity>
    )
}
