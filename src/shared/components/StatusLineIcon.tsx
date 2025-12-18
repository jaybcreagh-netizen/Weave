import React from 'react';
import {
    Cake,
    Heart,
    Briefcase,
    Package,
    Church,
    Baby,
    Feather,
    Hospital,
    GraduationCap,
    PartyPopper,
    Sparkles,
    Calendar,
    MessageSquareHeart,
    UtensilsCrossed,
    Palette,
    Phone,
    Sofa,
    Zap,
    TrendingUp,
    Sprout,
    Star,
    type LucideIcon,
} from 'lucide-react-native';

/**
 * Maps status line icon strings (previously emojis) to Lucide icons
 * This allows us to render consistent Lucide icons for all status line prompts
 */
const STATUS_ICON_MAP: Record<string, LucideIcon> = {
    // Life events
    '🎂': Cake,
    '💝': Heart,
    '💼': Briefcase,
    '📦': Package,
    '💒': Church,
    '👶': Baby,
    '🕊️': Feather,
    '🏥': Hospital,
    '🎓': GraduationCap,
    '🎉': PartyPopper,
    '✨': Sparkles,

    // Status / Activity
    '🗓️': Calendar,
    '💭': MessageSquareHeart,
    '🥂': UtensilsCrossed,
    '🏂': Palette,
    '📱': Phone,
    '🛋️': Sofa,
    '💫': Zap,
    '🌱': Sprout,
    '🎨': Palette,
    '🌟': Star,
    '📈': TrendingUp,
};

interface StatusLineIconProps {
    icon: string | undefined;
    size?: number;
    color: string;
}

/**
 * Renders a status line icon as a Lucide component
 * Falls back to rendering the emoji as text if no mapping exists
 */
export function StatusLineIcon({ icon, size = 12, color }: StatusLineIconProps) {
    if (!icon) return null;

    const IconComponent = STATUS_ICON_MAP[icon];

    if (IconComponent) {
        return <IconComponent size={size} color={color} />;
    }

    // Fallback to text for unmapped emojis (shouldn't happen after full migration)
    return null;
}

export { STATUS_ICON_MAP };
