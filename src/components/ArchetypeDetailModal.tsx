import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { theme } from '../theme';
import { X } from 'lucide-react-native';
import { type Archetype } from './types';
import { archetypeData } from '../lib/constants';

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