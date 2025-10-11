import React from 'react';
import { View, Text, Pressable, Image, Vibration, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '../stores/uiStore';
import { type Tier, type Archetype, type Status } from './types';
import { theme } from '../theme';
import { tierColors, archetypeIcons, archetypeData } from '../lib/constants';

interface GlyphProps {
  name: string;
  statusText: string;
  tier: Tier;
  archetype: Archetype;
  status: Status;
  photoUrl?: string;
  onClick?: () => void;
  variant?: 'compact' | 'full';
  needsAttention?: boolean;
}

export function Glyph({
    name,
    statusText,
    tier,
    archetype,
    status,
    photoUrl,
    onClick,
    variant = "compact",
    needsAttention = false,
}: GlyphProps) {
  const { setArchetypeModal } = useUIStore();

  // Safeguard against invalid props to prevent crashes
  const tierColor = tierColors[tier] || theme.colors.border; // Fallback to a neutral color
  const archetypeIcon = archetypeIcons[archetype] || '?'; // Fallback to a question mark
  const archetypeDetails = archetypeData[archetype];

  // Another safeguard: if core details are missing, render a simplified view or null
  if (!archetypeDetails) {
    // In a real-world scenario, we might log this error to a service
    return null; // Or a placeholder component
  }

  const handleArchetypeLongPress = () => {
    setArchetypeModal(archetype);
    Vibration.vibrate(50);
  };

  const statusStyle = StyleSheet.create({
    Green: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
    Yellow: { borderColor: '#fde68a', backgroundColor: '#fefce8' },
    Red: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  })[status];


  return (
    <Pressable
      onPress={() => {
        if (Haptics && typeof Haptics.impactAsync === 'function') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
            // Haptics not available or failed
          });
        }
        if (onClick) onClick();
      }}
      style={({ pressed }) => [
        styles.container,
        statusStyle,
        needsAttention && styles.needsAttentionGlow,
        { transform: [{ scale: pressed ? 0.97 : 1 }] }
      ]}
      disabled={!onClick}
    >
      <View style={styles.innerContainer}>
        <View style={[styles.header, variant === 'full' && { marginBottom: 16 }]}>
          <View style={[styles.avatarRing, { backgroundColor: tierColor }]}>
            <View style={styles.avatar}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
          <Pressable
            onLongPress={handleArchetypeLongPress}
            style={styles.archetypeButton}
          >
            <Text style={styles.archetypeIcon}>{archetypeIcon}</Text>
          </Pressable>
        </View>
        {variant === "full" && (
          <View style={styles.detailsContainer}>
            <View style={styles.detailsHeader}>
              <Text style={styles.archetypeName}>The {archetype}</Text>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>
                  {tier === "InnerCircle" ? "Inner Circle" : tier === "CloseFriends" ? "Close Friends" : "Community"}
                </Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.detailText}>
                <Text style={{ fontWeight: '500' }}>Essence:</Text>{" "}
                {archetypeDetails.essence}
              </Text>
              <Text style={styles.detailText}>
                <Text style={{ fontWeight: '500' }}>Best Way to Connect:</Text>{" "}
                {archetypeDetails.careStyle}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: theme.colors.card,
        overflow: 'hidden',
        transition: 'transform 0.1s ease-in-out',
    },
    needsAttentionGlow: {
        shadowColor: '#f59e0b', // amber-500
        shadowRadius: 10,
        shadowOpacity: 0.6,
        elevation: 8, // for Android
    },
    Green: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
    Yellow: { borderColor: '#fde68a', backgroundColor: '#fefce8' },
    Red: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
    innerContainer: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        padding: 2,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarInitial: {
        color: '#9ca3af',
        fontWeight: '500',
        fontSize: 18,
    },
    headerTextContainer: {
        flex: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.colors.foreground,
        marginBottom: 4,
    },
    statusText: {
        fontSize: 14,
        color: theme.colors['muted-foreground'],
    },
    archetypeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(181, 138, 108, 0.1)',
        borderRadius: 12,
    },
    archetypeIcon: {
        fontSize: 18,
    },
    detailsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 16,
        marginTop: 16,
        gap: 12,
    },
    detailsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    archetypeName: {
        fontWeight: '600',
        color: theme.colors.foreground,
    },
    tierBadge: {
        backgroundColor: 'rgba(181, 138, 108, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
    },
    tierBadgeText: {
        color: theme.colors.primary,
        fontSize: 12,
    },
    detailText: {
        fontSize: 14,
        color: theme.colors['muted-foreground'],
        lineHeight: 20,
    }
});