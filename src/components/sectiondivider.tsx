import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SectionDividerProps {
  fromWarmth: number;
  toWarmth: number;
}

export function SectionDivider({ fromWarmth, toWarmth }: SectionDividerProps) {
  // Interpolate colors based on warmth values
  const getColor = (warmth: number) => {
    if (warmth >= 0.7) {
      return 'rgba(181, 138, 108, 1)'; // Warm brown
    } else if (warmth >= 0.4) {
      return 'rgba(181, 138, 108, 0.6)'; // Medium
    } else {
      return 'rgba(181, 138, 108, 0.3)'; // Cool/faded
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[getColor(fromWarmth), getColor(toWarmth)]}
        style={styles.gradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 32,
    width: 2,
    alignSelf: 'center',
    marginLeft: 80, // Align with thread
    marginVertical: 8,
  },
  gradient: {
    flex: 1,
    width: 2,
  },
});