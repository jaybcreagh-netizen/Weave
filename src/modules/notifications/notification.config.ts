export interface NotificationSchedule {
    type: 'daily' | 'interval' | 'weekly';
    hour?: number;
    minute?: number;
    hours?: number; // For interval - frequency
    startHour?: number; // For interval - when the cycle begins (0-23)
    weekday?: number; // For weekly (1-7, 1=Sunday)
}

export interface NotificationTemplate {
    title: string;
    body: string;
}

export interface NotificationConfigItem {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    schedule: NotificationSchedule;
    templates: {
        default: NotificationTemplate;
        [key: string]: NotificationTemplate;
    };
    availableVariables?: Record<string, string>;
    limits: {
        dailyBudgetCost: number;
        cooldownHours?: number;
    };
    profiles?: {
        resting?: Partial<NotificationConfigItem>;
        balanced?: Partial<NotificationConfigItem>;
        blooming?: Partial<NotificationConfigItem>;
    };
}

export const NOTIFICATION_CONFIG: Record<string, NotificationConfigItem> = {
    "memory-nudge": {
        id: "memory-nudge",
        name: "Memory Nudge",
        description: "Morning reflection on past journals and moments",
        enabled: true,
        schedule: {
            type: "weekly",
            hours: 10,
            hour: 11,
            minute: 15,
            weekday: 6
        },
        templates: {
            default: {
                title: "{{title}}",
                body: "{{description}}"
            }
        },
        availableVariables: {
            "title": "Title of the memory",
            "description": "Description of the memory"
        },
        limits: {
            dailyBudgetCost: 1
        }
    },
    "evening-digest": {
        id: "evening-digest",
        name: "Evening Brief",
        description: "Daily summary of interactions and plans",
        enabled: true,
        schedule: {
            type: "daily",
            hour: 19,
            minute: 0
        },
        templates: {
            default: {
                title: "Your evening brief 🌙",
                body: "Take a moment to review today's connections and plans."
            }
        },
        limits: {
            dailyBudgetCost: 0
        }
    },
    "smart-suggestions": {
        id: "smart-suggestions",
        name: "Smart Suggestions",
        description: "AI-powered friend outreach suggestions",
        enabled: true,
        schedule: {
            type: "interval",
            hours: 10,
            startHour: 10
        },
        templates: {
            default: {
                title: "{{title}}",
                body: "{{subtitle}}"
            }
        },
        availableVariables: {
            "title": "Suggestion title (e.g. 'Connect with [Name]')",
            "subtitle": "Reasoning or context for the suggestion",
            "name": "Friend's name",
            "time": "Suggested time (e.g. 'This evening')"
        },
        limits: {
            dailyBudgetCost: 1,
            cooldownHours: 2
        }
    },
    "daily-battery-checkin": {
        id: "daily-battery-checkin",
        name: "Social Battery Check-in",
        description: "Daily tracker for social energy levels",
        enabled: true,
        schedule: {
            type: "daily",
            hour: 8,
            minute: 0
        },
        templates: {
            default: {
                title: "How's your energy today? 🌙",
                body: "Take 10 seconds to check in with your social battery."
            }
        },
        limits: {
            dailyBudgetCost: 0
        }
    },
    "weekly-reflection": {
        id: "weekly-reflection",
        name: "Weekly Reflection",
        description: "Sunday reflection on your social week",
        enabled: true,
        schedule: {
            type: "weekly",
            weekday: 1,
            hour: 13,
            minute: 0
        },
        templates: {
            default: {
                title: "Time to reflect on your weave 🕸️",
                body: "How did your friendships feel this week?"
            },
            catchup: {
                title: "Missed your Sunday reflection?",
                body: "It's Monday—take a moment now to reflect before the new week begins."
            }
        },
        limits: {
            dailyBudgetCost: 0
        }
    }
};

export type NotificationConfigKey = keyof typeof NOTIFICATION_CONFIG;

export interface NotificationProfileConfig {
    disabledChannels: string[];
    intervalOverrides?: Record<string, { hours: number; startHour?: number }>;
}

export interface GlobalNotificationSettings {
    quietHours: {
        enabled: boolean;
        startHour: number;
        endHour: number;
    };
    seasonProfiles?: Record<'resting' | 'balanced' | 'blooming', NotificationProfileConfig>;
}

export const GLOBAL_NOTIFICATION_SETTINGS: GlobalNotificationSettings = {
    quietHours: {
        enabled: true,
        startHour: 23,
        endHour: 7
    },
    seasonProfiles: {
        resting: {
            disabledChannels: [
                "smart-suggestions"
            ],
            intervalOverrides: {}
        },
        balanced: {
            disabledChannels: [],
            intervalOverrides: {}
        },
        blooming: {
            disabledChannels: [],
            intervalOverrides: {
                "smart-suggestions": {
                    hours: 4
                }
            }
        }
    }
};