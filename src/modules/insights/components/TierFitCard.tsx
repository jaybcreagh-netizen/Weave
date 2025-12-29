// src/modules/insights/components/TierFitCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTierFit } from '../hooks/useTierFit';

interface TierFitCardProps {
  friendId: string;
  onPress?: () => void;
}

/**
 * Subtle warning card showing severe tier misalignment.
 * Only appears when the deviation is critical (>300% or <33% of expected interval).
 */
export const TierFitCard = React.memo(({ friendId, onPress }: TierFitCardProps) => {
  const { analysis, isLoading } = useTierFit(friendId);

  // Don't render if loading or no analysis
  if (isLoading || !analysis || (analysis.fitCategory !== 'over_investing' && analysis.fitCategory !== 'under_investing')) {
    return null;
  }

  // Calculate deviation ratio
  // Avoid division by zero
  const ratio = analysis.expectedIntervalDays > 0
    ? analysis.actualIntervalDays / analysis.expectedIntervalDays
    : 1;

  // Define "Severe" threshold:
  // > 3.0x expected interval (e.g. 21 days for weekly friend)
  // < 0.33x expected interval (e.g. daily for monthly friend)
  const isSevere = ratio > 3.0 || ratio < 0.33;

  if (!isSevere) {
    return null;
  }

  return (
    <TouchableOpacity
      className="mx-1 mt-2 rounded-lg py-2.5 px-3"
      style={{ backgroundColor: '#F59E0B15' }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-center gap-2">
        <AlertTriangle size={16} color="#F59E0B" />
        <Text className="text-[13px] font-medium" style={{ color: '#B45309' }}>
          Connection rhythm is off track. <Text className="font-semibold">Review Status</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
});
