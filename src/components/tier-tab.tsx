import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

interface TierTabProps {
  label: string;
  shortLabel?: string;
  count?: number;
  maxCount?: number;
  isActive: boolean;
  onClick: () => void;
  tier: 'inner' | 'close' | 'community';
}

const tierColors = {
  inner: "#D4AF37", // Gold
  close: "#C0C0C0", // Silver
  community: "#CD7F32" // Bronze
};

const tierIcons = {
  inner: "⭐",
  close: "💫",
  community: "🌐"
};

export function TierTab({ label, shortLabel, count, maxCount, isActive, onClick, tier }: TierTabProps) {
  const tierColor = tierColors[tier];
  const tierIcon = tierIcons[tier];
  const percentage = count && maxCount ? (count / maxCount) * 100 : 0;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClick();
      }}
      style={({ pressed }) => [
        styles.container, 
        isActive && styles.containerActive,
        { transform: [{ scale: pressed ? 0.98 : 1 }] }
      ]}
    >
      {isActive && count !== undefined && maxCount && (
        <View
          style={[styles.progressBar, { width: `${percentage}%` }]}
        />
      )}
      
      {!isActive && (
        <View
          style={[styles.accentBar, { backgroundColor: tierColor }]}
        />
      )}

      <View style={styles.content}>
        <Text style={[styles.icon, { opacity: isActive ? 0.9 : 0.75 }]}>
          {tierIcon}
        </Text>
        
        <Text style={[styles.label, { color: isActive ? 'white' : theme.colors['muted-foreground'] }]}>
          {shortLabel || label}
        </Text>
        
        {count !== undefined && (
          <Text style={[styles.count, { color: isActive ? 'rgba(255, 255, 255, 0.8)' : theme.colors['muted-foreground'] }]}>
            {count}
          </Text>
        )}
        
        {!isActive && (
          <View
            style={[styles.dot, { backgroundColor: tierColor }]} 
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 16,
        borderRadius: 12,
        position: 'relative',
        backgroundColor: 'transparent',
    },
    containerActive: {
        backgroundColor: theme.colors.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    progressBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 2,
    },
    accentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 2,
        borderRadius: 1,
        opacity: 0.5,
    },
    content: {
        alignItems: 'center',
        gap: 6,
    },
    icon: {
        fontSize: 16,
    },
    label: {
        fontWeight: '500',
        fontSize: 14,
        lineHeight: 18,
    },
    count: {
        fontSize: 12,
        lineHeight: 16,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        opacity: 0.6,
    }
});