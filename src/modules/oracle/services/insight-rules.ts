import { Tier } from '@/shared/types/common'

export interface InsightRule {
    id: string
    type: 'friend' | 'pattern' | 'milestone'
    name: string
    description: string
    template: string
    // For friend/pattern rules
    severityLevels?: {
        1: number
        2: number
        3: number
        4: number
    }
}

// === FRIEND RULES ===

export const FRIEND_RULES: Record<string, InsightRule> = {
    friend_drift: {
        id: 'friend_drift',
        type: 'friend',
        name: 'Drifting',
        description: 'Significant gap in connection cadence',
        template: "Drifting from {{name}}. {{daysSince}} days since you connected — your rhythm is usually every {{expectedCadence}} days.",
        severityLevels: {
            1: 1.5, // 1.5x expected cadence
            2: 2.0, // 2x expected cadence
            3: 3.0, // 3x expected cadence
            4: 4.0  // 4x expected cadence
        }
    },
    friend_deepening: {
        id: 'friend_deepening',
        type: 'friend',
        name: 'Deepening',
        description: 'Significant increase in interaction frequency',
        template: "Something's building with {{name}}. You've seen them {{recentCount}} times this month — more than usual."
    },
    friend_one_sided: {
        id: 'friend_one_sided',
        type: 'friend',
        name: 'One-sided',
        description: 'High ratio of user-initiated interactions',
        template: "You've initiated the last {{count}} interactions with {{name}}. Are they reaching back?"
    },
    friend_reconnection: {
        id: 'friend_reconnection',
        type: 'friend',
        name: 'Reconnection',
        description: 'Previously active friend has gone dormant',
        template: "{{name}} has been quiet for {{daysSince}} days. You used to see them regularly."
    },
    friend_thread_pending: {
        id: 'friend_thread_pending',
        type: 'friend',
        name: 'Thread pending',
        description: 'Active conversation thread needs update',
        template: "You mentioned {{threadTopic}} with {{name}} {{daysSince}} days ago. Any update?"
    }
}

// === PATTERN RULES ===

export const PATTERN_RULES: Record<string, InsightRule> = {
    pattern_over_initiating: {
        id: 'pattern_over_initiating',
        type: 'pattern',
        name: 'Over-initiating',
        description: 'User initiating majority of interactions across all friends',
        template: "You're carrying the load. You've initiated {{percentage}}% of all plans this month."
    },
    pattern_tier_neglect: {
        id: 'pattern_tier_neglect',
        type: 'pattern',
        name: 'Tier neglect',
        description: 'Neglecting a specific tier (e.g., Inner Circle)',
        template: "Your Inner Circle is quiet. No interactions with your closest 5 people in {{days}} days."
    },
    pattern_group_heavy: {
        id: 'pattern_group_heavy',
        type: 'pattern',
        name: 'Group heavy',
        description: 'High ratio of group interactions vs 1-on-1',
        template: "Lots of crowds lately. {{percentage}}% of your time has been in groups. Missing 1-on-1 depth?"
    },
    pattern_low_energy_socializing: {
        id: 'pattern_low_energy_socializing',
        type: 'pattern',
        name: 'Low energy',
        description: 'Socializing mostly when battery is low',
        template: "Running on empty? Most of your recent socializing happened when your battery was low."
    }
}

// === MILESTONE RULES ===

export const MILESTONE_RULES: Record<string, InsightRule> = {
    milestone_weave_count: {
        id: 'milestone_weave_count',
        type: 'milestone',
        name: 'Weave count',
        description: 'Total lifetime weaves with a friend',
        template: "That's {{count}} memories with {{name}}! A sturdy foundation."
    },
    milestone_yearly_weave: {
        id: 'milestone_yearly_weave',
        type: 'milestone',
        name: 'Yearly weave count',
        description: 'Weaves in current calendar year',
        template: "{{count}} times this year. You and {{name}} are on a roll."
    },
    milestone_streak: {
        id: 'milestone_streak',
        type: 'milestone',
        name: 'Streak',
        description: 'Consecutive weeks/months of connection',
        template: "{{weeks}} weeks in a row! Consistency is the language of love."
    },
    milestone_anniversary: {
        id: 'milestone_anniversary',
        type: 'milestone',
        name: 'Anniversary',
        description: 'Friendship anniversary',
        template: "Happy {{years}} year friend-iversary with {{name}}!"
    },
    milestone_first_journal: {
        id: 'milestone_first_journal',
        type: 'milestone',
        name: 'First journal',
        description: 'First time mentioning friend in journal',
        template: "You wrote about {{name}} in your journal for the first time."
    }
}

// === UTILITIES ===

export const getExpectedCadence = (tier: Tier | string): number => {
    switch (tier) {
        case 'Inner Circle': return 7   // Weekly
        case 'Close Friends': return 14 // Bi-weekly
        case 'Community': return 45     // ~6 weeks
        default: return 30
    }
}

export const INSIGHT_EXPIRY_HOURS = 48
export const MAX_ACTIVE_INSIGHTS = 3
