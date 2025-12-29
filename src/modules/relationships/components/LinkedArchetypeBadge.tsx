/**
 * LinkedArchetypeBadge
 * 
 * Displays the archetype of a linked Weave user.
 * Shows their selected archetype if they've set one and visibility allows.
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Sparkles, User } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';
import { getLinkedFriendArchetype } from '@/modules/auth/services/archetype-sync.service';
import { archetypeData } from '@/shared/constants/constants';
import type { Archetype } from '@/shared/types/common';
import FriendModel from '@/db/models/Friend';

interface LinkedArchetypeBadgeProps {
    friend: FriendModel;
    onSuggestArchetype?: (archetype: Archetype) => void;
}

export function LinkedArchetypeBadge({ friend, onSuggestArchetype }: LinkedArchetypeBadgeProps) {
    const { colors } = useTheme();
    const [linkedArchetype, setLinkedArchetype] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchArchetype = async () => {
            // Only fetch if this friend is linked to a Weave user
            if (!friend.linkedUserId || friend.linkStatus !== 'linked') {
                return;
            }

            setLoading(true);
            try {
                const archetype = await getLinkedFriendArchetype(friend.linkedUserId);
                setLinkedArchetype(archetype);
            } catch (error) {
                console.error('Failed to fetch linked archetype:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchArchetype();
    }, [friend.linkedUserId, friend.linkStatus]);

    // Don't render if not linked or no archetype
    if (!friend.linkedUserId || friend.linkStatus !== 'linked') {
        return null;
    }

    if (loading) {
        return null; // Don't show loading state for this small detail
    }

    if (!linkedArchetype) {
        return null; // They haven't set an archetype
    }

    const archetypeInfo = archetypeData[linkedArchetype as Archetype];
    const archetypeName = archetypeInfo?.name || linkedArchetype;
    // Use primary color - archetypeData doesn't have color property
    const archetypeColor = colors.primary;

    return (
        <TouchableOpacity
            onPress={() => onSuggestArchetype?.(linkedArchetype as Archetype)}
            activeOpacity={0.7}
            disabled={!onSuggestArchetype}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: archetypeColor + '15',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: archetypeColor + '30',
                }}
            >
                <User size={14} color={archetypeColor} />
                <Text
                    style={{
                        fontSize: 12,
                        color: archetypeColor,
                        fontWeight: '500',
                    }}
                >
                    Their archetype: {archetypeName}
                </Text>
                {onSuggestArchetype && (
                    <Sparkles size={12} color={archetypeColor} />
                )}
            </View>
        </TouchableOpacity>
    );
}
