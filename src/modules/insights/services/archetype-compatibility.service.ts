/**
 * Archetype Compatibility Service
 * 
 * Determines how well two archetypes complement each other
 * for use in linked friend profiles.
 */

import { Archetype } from '@/shared/types/common';
import { archetypeData } from '@/shared/constants/constants';

export interface ArchetypeCompatibility {
    level: 'high' | 'medium' | 'low';
    score: number; // 0-1
    description: string;
    emoji: string;
}

/**
 * Compatibility matrix based on archetype energies.
 * Higher scores indicate more complementary pairings.
 * 
 * Rationale:
 * - Hermit + High Priestess: Both value depth → high
 * - Sun + Fool: Both love spontaneous fun → high
 * - Emperor + Empress: Structured care → high
 * - Magician + Fool: Creative adventure → high
 * - Hermit + Sun: Different rhythms → low
 */
const COMPATIBILITY_MATRIX: Record<Archetype, Record<Archetype, number>> = {
    Sun: {
        Sun: 0.9,
        Hermit: 0.4,
        Emperor: 0.6,
        Fool: 0.9,
        Empress: 0.7,
        Magician: 0.8,
        HighPriestess: 0.5,
        Lovers: 0.85,
        Unknown: 0.5,
    },
    Hermit: {
        Sun: 0.4,
        Hermit: 0.85,
        Emperor: 0.6,
        Fool: 0.3,
        Empress: 0.7,
        Magician: 0.5,
        HighPriestess: 0.95,
        Lovers: 0.7,
        Unknown: 0.5,
    },
    Emperor: {
        Sun: 0.6,
        Hermit: 0.6,
        Emperor: 0.7,
        Fool: 0.4,
        Empress: 0.9,
        Magician: 0.7,
        HighPriestess: 0.6,
        Lovers: 0.75,
        Unknown: 0.5,
    },
    Fool: {
        Sun: 0.9,
        Hermit: 0.3,
        Emperor: 0.4,
        Fool: 0.85,
        Empress: 0.5,
        Magician: 0.9,
        HighPriestess: 0.4,
        Lovers: 0.7,
        Unknown: 0.5,
    },
    Empress: {
        Sun: 0.7,
        Hermit: 0.7,
        Emperor: 0.9,
        Fool: 0.5,
        Empress: 0.8,
        Magician: 0.6,
        HighPriestess: 0.85,
        Lovers: 0.9,
        Unknown: 0.5,
    },
    Magician: {
        Sun: 0.8,
        Hermit: 0.5,
        Emperor: 0.7,
        Fool: 0.9,
        Empress: 0.6,
        Magician: 0.8,
        HighPriestess: 0.6,
        Lovers: 0.75,
        Unknown: 0.5,
    },
    HighPriestess: {
        Sun: 0.5,
        Hermit: 0.95,
        Emperor: 0.6,
        Fool: 0.4,
        Empress: 0.85,
        Magician: 0.6,
        HighPriestess: 0.9,
        Lovers: 0.85,
        Unknown: 0.5,
    },
    Lovers: {
        Sun: 0.85,
        Hermit: 0.7,
        Emperor: 0.75,
        Fool: 0.7,
        Empress: 0.9,
        Magician: 0.75,
        HighPriestess: 0.85,
        Lovers: 0.95,
        Unknown: 0.5,
    },
    Unknown: {
        Sun: 0.5,
        Hermit: 0.5,
        Emperor: 0.5,
        Fool: 0.5,
        Empress: 0.5,
        Magician: 0.5,
        HighPriestess: 0.5,
        Lovers: 0.5,
        Unknown: 0.5,
    },
};

/**
 * Get compatibility analysis between two archetypes.
 */
export function getArchetypeCompatibility(
    userArchetype: Archetype,
    friendArchetype: Archetype
): ArchetypeCompatibility {
    const score = COMPATIBILITY_MATRIX[userArchetype]?.[friendArchetype] ?? 0.5;

    let level: ArchetypeCompatibility['level'];
    let emoji: string;

    if (score >= 0.8) {
        level = 'high';
        emoji = '✨';
    } else if (score >= 0.6) {
        level = 'medium';
        emoji = '🌙';
    } else {
        level = 'low';
        emoji = '🌊';
    }

    const userArchetypeInfo = archetypeData[userArchetype];
    const friendArchetypeInfo = archetypeData[friendArchetype];

    const description = generateCompatibilityDescription(
        userArchetype,
        friendArchetype,
        userArchetypeInfo?.name || userArchetype,
        friendArchetypeInfo?.name || friendArchetype,
        level
    );

    return {
        level,
        score,
        description,
        emoji,
    };
}

function generateCompatibilityDescription(
    userArchetype: Archetype,
    friendArchetype: Archetype,
    userName: string,
    friendName: string,
    level: 'high' | 'medium' | 'low'
): string {
    if (userArchetype === friendArchetype) {
        return `You both share ${userName} energy – a natural understanding`;
    }

    const descriptions: Record<string, string> = {
        'high': `Your ${userName} energy complements their ${friendName} beautifully`,
        'medium': `Your ${userName} and their ${friendName} create interesting dynamics`,
        'low': `Your ${userName} and their ${friendName} offer different perspectives`,
    };

    return descriptions[level] || `${userName} meets ${friendName}`;
}

/**
 * Get a short compatibility label for UI badges.
 */
export function getCompatibilityLabel(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
        case 'high':
            return 'Great chemistry';
        case 'medium':
            return 'Complementary';
        case 'low':
            return 'Different energies';
    }
}
