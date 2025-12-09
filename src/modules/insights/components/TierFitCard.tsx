// src/modules/insights/components/TierFitCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useTierFit } from '../hooks/useTierFit';

interface TierFitCardProps {
  friendId: string;
  onPress?: () => void;
}

/**
 * Subtle warning card showing severe tier misalignment.
 * Only appears when the deviation is critical (>300% or <33% of expected interval).
 */
export function TierFitCard({ friendId, onPress }: TierFitCardProps) {
  const { colors } = useTheme();
  const { analysis, isLoading } = useTierFit(friendId);

  // Don't render if loading or no analysis
  if (isLoading || !analysis || analysis.fitCategory !== 'mismatch') {
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
      style={[styles.container, { backgroundColor: '#F59E0B15' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <AlertTriangle size={16} color="#F59E0B" />
        <Text style={[styles.warningText, { color: '#B45309' }]}>
          Connection rhythm is off track. <Text style={{ fontWeight: '600' }}>Review Status</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 4,
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
