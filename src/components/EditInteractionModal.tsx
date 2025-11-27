import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { type Interaction, type InteractionCategory, type Vibe, type StructuredReflection } from './types';
import { getAllCategories, getCategoryMetadata, type CategoryMetadata } from '@/shared/constants/interaction-categories';
import { MoonPhaseSelector } from './MoonPhaseSelector';
import { CustomCalendar } from '@/components/CustomCalendar';
import { CalendarDays } from 'lucide-react-native';
import { format } from 'date-fns';
import { BlurView } from 'expo-blur';
import { ReciprocitySelector, InitiatorType } from '@/components/ReciprocitySelector';

interface EditInteractionModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (interactionId: string, updates: {
    title?: string;
    category?: InteractionCategory;
    vibe?: Vibe | null;
    reflection?: StructuredReflection;
    interactionDate?: Date;
    initiator?: InitiatorType;
  }) => Promise<void>;
}

const categories: CategoryMetadata[] = getAllCategories().map(cat => getCategoryMetadata(cat));

export function EditInteractionModal({
  interaction,
  isOpen,
  onClose,
  onSave,
}: EditInteractionModalProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [initiator, setInitiator] = useState<InitiatorType | undefined>(undefined);
  const { isDarkMode } = useTheme();

  // Update state when interaction changes
  React.useEffect(() => {
    if (interaction) {
      setTitle(interaction.title || '');
      setSelectedCategory((interaction.interactionCategory || interaction.activity) as InteractionCategory);
      setSelectedVibe(interaction.vibe || null);
      setCustomNotes(interaction.reflection?.customNotes || interaction.note || '');
      setSelectedDate(interaction.interactionDate);
      setInitiator(interaction.initiator as InitiatorType | undefined);
    }
  }, [interaction]);

  const handleSave = async () => {
    if (!interaction) return;

    setIsSaving(true);
    try {
      const updates: any = {};

      if (title !== interaction.title) {
        updates.title = title;
      }

      if (selectedCategory && selectedCategory !== (interaction.interactionCategory || interaction.activity)) {
        updates.category = selectedCategory;
      }

      if (selectedVibe !== interaction.vibe) {
        updates.vibe = selectedVibe;
      }

      // Update reflection if custom notes changed
      if (customNotes !== (interaction.reflection?.customNotes || interaction.note || '')) {
        updates.reflection = {
          ...interaction.reflection,
          customNotes,
        };
      }

      if (selectedDate && selectedDate.getTime() !== interaction.interactionDate.getTime()) {
        updates.interactionDate = selectedDate;
      }

      if (initiator !== interaction.initiator) {
        updates.initiator = initiator;
      }

      await onSave(interaction.id, updates);
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
          showsVerticalScrollIndicator={false}
        >
          {/* Title Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Title
            </Text>
            <TextInput
              style={[
                styles.titleInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }
              ]}
              placeholder='e.g., "Coffee at Blue Bottle"'
              placeholderTextColor={colors['muted-foreground']}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateInput,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={styles.dateContent}>
                <CalendarDays size={20} color={colors.primary} />
                <Text style={[styles.dateText, { color: colors.foreground }]}>
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select date'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Category
            </Text>
            <View style={styles.gridContainer}>
              {categories.map((cat, index) => (
                <Animated.View
                  key={cat.id}
                  style={{ width: '48%' }}
                  entering={FadeInUp.duration(500).delay(index * 50)}
                >
                  <TouchableOpacity
                    style={[
                      styles.gridItem,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      selectedCategory === cat.id && [
                        styles.gridItemSelected,
                        { borderColor: colors.primary }
                      ]
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
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
          </View>

          {/* Vibe Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Vibe
            </Text>
            <MoonPhaseSelector onSelect={setSelectedVibe} selectedVibe={selectedVibe} />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Notes
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }
              ]}
              placeholder="Add notes about this moment..."
              placeholderTextColor={colors['muted-foreground']}
              value={customNotes}
              onChangeText={setCustomNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Reciprocity Section */}
          <View style={styles.section}>
            <ReciprocitySelector
              value={initiator}
              onChange={setInitiator}
            />
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

      {/* Calendar Modal */}
      {showDatePicker && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <BlurView intensity={isDarkMode ? 20 : 40} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            >
              <Animated.View
                entering={FadeInUp.duration(200).springify()}
                style={[
                  styles.calendarContainer,
                  {
                    backgroundColor: isDarkMode ? colors.background + 'F5' : colors.background + 'F8',
                  }
                ]}
                onStartShouldSetResponder={() => true}
              >
                <View style={styles.calendarHeader}>
                  <Text style={[styles.calendarTitle, { color: colors.foreground }]}>
                    Pick a Date
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeCalendarButton}>
                    <X color={colors['muted-foreground']} size={22} />
                  </TouchableOpacity>
                </View>

                <CustomCalendar
                  selectedDate={selectedDate || new Date()}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    setShowDatePicker(false);
                  }}
                // Let's allow any date for now as it's an edit.
                />
              </Animated.View>
            </TouchableOpacity>
          </BlurView>
        </Modal>
      )}
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
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '100%',
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  dateInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Lora-Bold',
  },
  closeCalendarButton: {
    padding: 8,
    marginRight: -8,
  },
});
