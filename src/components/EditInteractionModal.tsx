import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { type Interaction, type InteractionCategory } from './types';
import { getAllCategories, type CategoryMetadata } from '../lib/interaction-categories';

interface EditInteractionModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (interactionId: string, newCategory: InteractionCategory) => Promise<void>;
}

const categories: CategoryMetadata[] = getAllCategories();

export function EditInteractionModal({
  interaction,
  isOpen,
  onClose,
  onSave,
}: EditInteractionModalProps) {
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update selected category when interaction changes
  React.useEffect(() => {
    if (interaction) {
      setSelectedCategory((interaction.interactionCategory || interaction.activity) as InteractionCategory);
    }
  }, [interaction]);

  const handleSave = async () => {
    if (!interaction || !selectedCategory) return;

    setIsSaving(true);
    try {
      await onSave(interaction.id, selectedCategory);
      onClose();
    } catch (error) {
      console.error('Error updating interaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!interaction) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Edit Weave
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors['muted-foreground'] }]}>
              Change the interaction type
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color={colors['muted-foreground']} size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            How did you connect?
          </Text>
          <View style={styles.gridContainer}>
            {categories.map((cat, index) => (
              <Animated.View
                key={cat.category}
                style={{ width: '48%' }}
                entering={FadeInUp.duration(500).delay(index * 50)}
              >
                <TouchableOpacity
                  style={[
                    styles.gridItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedCategory === cat.category && [
                      styles.gridItemSelected,
                      { borderColor: colors.primary }
                    ]
                  ]}
                  onPress={() => setSelectedCategory(cat.category)}
                >
                  <Text style={styles.gridItemIcon}>{cat.icon}</Text>
                  <Text style={[styles.gridItemLabel, { color: colors.foreground }]}>
                    {cat.label}
                  </Text>
                  <Text style={[styles.gridItemSublabel, { color: colors['muted-foreground'] }]}>
                    {cat.description}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving || !selectedCategory}
          >
            <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  gridItemSelected: {
    borderWidth: 2,
  },
  gridItemIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  gridItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridItemSublabel: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
