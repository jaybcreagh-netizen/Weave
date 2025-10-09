import React from 'react';
import { View, Text, TouchableOpacity, Image, Vibration, StyleSheet } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { type Tier, type Archetype, type Status } from './types';
import { theme } from '../theme';

interface GlyphProps {
  name: string;
  statusText: string;
  tier: Tier;
  archetype: Archetype;
  status: Status;
  photoUrl?: string;
  onClick?: () => void;
  variant?: 'compact' | 'full';
}

const tierColors = {
    InnerCircle: "#D4AF37",
    CloseFriends: "#C0C0C0",
    Community: "#CD7F32",
};
  
const archetypeIcons = {
    Emperor: "👑", Empress: "🌹", HighPriestess: "🌙", Fool: "🃏", Sun: "☀️", Hermit: "🏮", Magician: "⚡",
};
  
const archetypeData = {
    Emperor: { essence: "The Architect of Order", careStyle: "A promise honored, a plan fulfilled." },
    Empress: { essence: "The Nurturer of Comfort", careStyle: "Where care flows, where beauty is made." },
    HighPriestess: { essence: "The Keeper of Depth", careStyle: "In quiet corners, in the truths beneath words." },
    Fool: { essence: "The Spirit of Play", careStyle: "With laughter, with a door left open." },
    Sun: { essence: "The Bringer of Joy", careStyle: "In celebration, in the radiance of being seen." },
    Hermit: { essence: "The Guardian of Solitude", careStyle: "In patience, in the glow of stillness." },
    Magician: { essence: "The Spark of Possibility", careStyle: "At thresholds, where sparks leap into being." },
};

export function Glyph({
  name,
  statusText,
  tier,
  archetype,
  status,
  photoUrl,
  onClick,
  variant = "compact",
}: GlyphProps) {
  const { setArchetypeModal } = useUIStore();

  const tierColor = tierColors[tier];
  const archetypeIcon = archetypeIcons[archetype];
  const archetypeDetails = archetypeData[archetype];

  const handleArchetypeLongPress = () => {
    setArchetypeModal(archetype);
    Vibration.vibrate(50);
  };

  const statusStyle = styles[status];

  return (
    <TouchableOpacity
      onPress={onClick}
      style={[styles.container, statusStyle]}
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
          <TouchableOpacity
            onLongPress={handleArchetypeLongPress}
            style={styles.archetypeButton}
          >
            <Text style={styles.archetypeIcon}>{archetypeIcon}</Text>
          </TouchableOpacity>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: theme.colors.card,
        overflow: 'hidden',
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
        fontSize: 12,
        color: theme.colors.primary,
    },
    detailText: {
        fontSize: 14,
        color: theme.colors['muted-foreground'],
        lineHeight: 20,
    }
});