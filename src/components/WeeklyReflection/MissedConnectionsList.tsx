/**
 * MissedConnectionsList
 * 
 * Component to display friends who might need re-connection.
 * Used in "Weave Plans" or "Insights".
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';
import { Archetype } from '@/components/types';
import { Clock, ArrowRight } from 'lucide-react-native';
import { MissedFriend } from '@/modules/reflection';

interface MissedConnectionsListProps {
  missedFriends: MissedFriend[];
  onWeave: (friendId: string) => void;
  onViewProfile: (friendId: string) => void;
}

export function MissedConnectionsList({ missedFriends, onWeave, onViewProfile }: MissedConnectionsListProps) {
  const { colors } = useTheme();

  if (!missedFriends || missedFriends.length === 0) {
    return (
      <Card className="p-6 items-center justify-center bg-muted/20 border-dashed">
        <Text variant="body" className="text-muted-foreground text-center">
          You're all caught up! No missed connections this week.
        </Text>
      </Card>
    );
  }

  const formatDays = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    className = "mb-3 rounded-2xl overflow-hidden"
              style = {{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
}
            >
  {/* Friend Info */ }
  < View className = "p-4" >
    <View className="flex-row items-center mb-3">
      {/* Archetype Icon */}
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: colors.muted }}
      >
        <ArchetypeIcon
          archetype={missed.friend.archetype as Archetype}
          size={24}
          color={colors.foreground}
        />
      </View>

      {/* Name and Score */}
      <View className="flex-1">
        <Text
          className="text-lg font-semibold mb-1"
          style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
        >
          {missed.friend.name}
        </Text>
        <View className="flex-row items-center gap-2">
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: scoreColor + '20' }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: scoreColor, fontFamily: 'Inter_500Medium' }}
            >
              {Math.round(missed.weaveScore)} / 100
            </Text>
          </View>
          <Text
            className="text-xs"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            {missed.daysSinceLastContact < 999
              ? `${missed.daysSinceLastContact}d since last contact`
              : 'No recent contact'}
          </Text>
        </View>
      </View>
    </View>

{/* Suggestion */ }
<View
  className="p-3 rounded-xl mb-3"
  style={{ backgroundColor: colors.secondary + '10' }}
>
  <Text
    className="text-xs mb-1"
    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
  >
    They value {missed.archetypeValue}. Try:
  </Text>
  <Text
    className="text-sm font-medium"
    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
  >
    {missed.suggestedAction}
  </Text>
</View>

{/* Action Button */ }
<TouchableOpacity
  onPress={() => handleLogWeave(missed.friend.id, missed.friend.name)}
  className="flex-row items-center justify-center py-3 rounded-xl"
  style={{ backgroundColor: colors.primary }}
>
  <Heart size={16} color={colors['primary-foreground']} fill={colors['primary-foreground']} />
  <Text
    className="text-sm font-semibold ml-2"
    style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
  >
    Log a Weave with {missed.friend.name}
  </Text>
</TouchableOpacity>
              </View >
            </Animated.View >
          );
        })}
      </ScrollView >

  {/* Bottom Actions */ }
  < View className = "gap-3" >
        <TouchableOpacity
          onPress={onNext}
          className="py-4 rounded-xl items-center"
          style={{ backgroundColor: colors.primary }}
        >
          <View className="flex-row items-center">
            <Text
              className="text-base font-semibold mr-2"
              style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
            >
              Continue to Reflection
            </Text>
            <ChevronRight size={20} color={colors['primary-foreground']} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSkip}
          className="py-3 items-center"
        >
          <Text
            className="text-sm font-medium"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      </View >
    </View >
  );
}
