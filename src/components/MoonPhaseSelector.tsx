import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { moonPhasesData } from '../lib/constants';
import { type Vibe } from './types';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface MoonPhaseSelectorProps {
  onSelect: (vibe: Vibe) => void;
  selectedVibe: Vibe | null;
}

export function MoonPhaseSelector({ onSelect, selectedVibe }: MoonPhaseSelectorProps) {
  const activePhaseData = moonPhasesData.find(moon => moon.phase === selectedVibe);
  const displayText = activePhaseData?.microcopy || "How did this weave feel?";

  return (
    <View style={styles.container}>
      <Animated.View key={displayText} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.microcopyContainer}>
        <Text style={styles.microcopyText}>{displayText}</Text>
      </Animated.View>

      <View style={styles.phasesContainer}>
        {moonPhasesData.map((moon) => {
          const isSelected = selectedVibe === moon.phase;
          return (
            <TouchableOpacity
              key={moon.phase}
              onPress={() => onSelect(moon.phase as Vibe)}
              style={[styles.phaseButton, isSelected && styles.phaseButtonSelected]}
            >
              <Animated.View style={[{ transform: [{ scale: isSelected ? 1.25 : 1 }] }]}>
                <Text style={styles.phaseIcon}>{moon.icon}</Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  microcopyContainer: {
    height: 24,
    justifyContent: 'center',
  },
  microcopyText: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
  },
  phasesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  phaseButton: {
    padding: 8,
    borderRadius: 999,
  },
  phaseButtonSelected: {
    backgroundColor: theme.colors.primary + '1A', // primary with 10% opacity
  },
  phaseIcon: {
    fontSize: 32,
  },
});
