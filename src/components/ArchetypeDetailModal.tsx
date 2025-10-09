import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { theme } from '../theme';
import { X } from 'lucide-react-native';
import { type Archetype } from './types';

const archetypeData: Record<Archetype, { icon: string; name: string; essence: string; careStyle: string; }> = {
    Emperor: { icon: "👑", name: "The Emperor", essence: "The Architect of Order", careStyle: "A promise honored, a plan fulfilled." },
    Empress: { icon: "🌹", name: "The Empress", essence: "The Nurturer of Comfort", careStyle: "Where care flows, where beauty is made." },
    HighPriestess: { icon: "🌙", name: "The High Priestess", essence: "The Keeper of Depth", careStyle: "In quiet corners, in the truths beneath words." },
    Fool: { icon: "🃏", name: "The Fool", essence: "The Spirit of Play", careStyle: "With laughter, with a door left open." },
    Sun: { icon: "☀️", name: "The Sun", essence: "The Bringer of Joy", careStyle: "In celebration, in the radiance of being seen." },
    Hermit: { icon: "🏮", name: "The Hermit", essence: "The Guardian of Solitude", careStyle: "In patience, in the glow of stillness." },
    Magician: { icon: "⚡", name: "The Magician", essence: "The Spark of Possibility", careStyle: "At thresholds, where sparks leap into being." },
};

export function ArchetypeDetailModal() {
  const { archetypeModal, setArchetypeModal } = useUIStore();

  if (!archetypeModal) {
    return null;
  }

  const data = archetypeData[archetypeModal];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={!!archetypeModal}
      onRequestClose={() => setArchetypeModal(null)}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setArchetypeModal(null)}>
            <X color={theme.colors['muted-foreground']} size={24} />
          </TouchableOpacity>
          <Text style={styles.icon}>{data.icon}</Text>
          <Text style={styles.title}>{data.name}</Text>
          <Text style={styles.subtitle}>{data.essence}</Text>
          <View style={styles.divider} />
          <Text style={styles.heading}>Best Way to Connect</Text>
          <Text style={styles.body}>{data.careStyle}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: theme.spacing.lg,
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
    },
    icon: {
        fontSize: 60,
        marginBottom: theme.spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: theme.colors.foreground,
        marginBottom: theme.spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.primary,
        marginBottom: theme.spacing.md,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        width: '100%',
        marginVertical: theme.spacing.md,
    },
    heading: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.foreground,
        marginBottom: theme.spacing.sm,
    },
    body: {
        fontSize: 16,
        color: theme.colors['muted-foreground'],
        textAlign: 'center',
    }
});
