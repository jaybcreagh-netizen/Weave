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
    'Cake': Cake,
    'Heart': Heart,
    'Briefcase': Briefcase,
    'Package': Package,
    'Church': Church,
    'Baby': Baby,
    'Feather': Feather,
    'Hospital': Hospital,
    'GraduationCap': GraduationCap,
    'PartyPopper': PartyPopper,
    'Sparkles': Sparkles,

    // Status / Activity
    'Calendar': Calendar,
    'MessageSquareHeart': MessageSquareHeart,
    'UtensilsCrossed': UtensilsCrossed,
    'Palette': Palette,
    'Phone': Phone,
    'Sofa': Sofa,
    'Zap': Zap,
    'Sprout': Sprout,
    'Star': Star,
    'TrendingUp': TrendingUp,
};

interface StatusLineIconProps {
    icon: string | undefined;
    size?: number;
    color: string;
}

/**
 * Renders a status line icon as a Lucide component
 */
export function StatusLineIcon({ icon, size = 12, color }: StatusLineIconProps) {
    if (!icon) return null;

    const IconComponent = STATUS_ICON_MAP[icon];

    if (IconComponent) {
        return <IconComponent size={size} color={color} />;
    }

    // Fallback? or just null
    return null;
}

export { STATUS_ICON_MAP };
