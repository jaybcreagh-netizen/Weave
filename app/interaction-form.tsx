import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Keyboard, TouchableWithoutFeedback, Vibration, Modal } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useInteractionStore } from '../src/stores/interactionStore';
import { Calendar as CalendarIcon, X, ArrowUp } from 'lucide-react-native';
import { CalendarView } from '../src/components/CalendarView';
import { MoonPhaseSelector } from '../src/components/MoonPhaseSelector';
import { format, addDays, nextSaturday, isSameDay } from 'date-fns';
import { type Vibe, type InteractionCategory } from '../src/components/types';
import { useTheme } from '../src/hooks/useTheme';
import { getAllCategories, type CategoryMetadata } from '../src/lib/interaction-categories';

// NEW: 8 universal interaction categories
const categories: CategoryMetadata[] = getAllCategories();

const dateOptions = [
    { id: 'today', icon: '☀️', label: 'Today', getDate: () => new Date() },
    { id: 'tomorrow', icon: '🌑', label: 'Tomorrow', getDate: () => addDays(new Date(), 1) },
    { id: 'weekend', icon: '🌓', label: 'This Weekend', getDate: () => nextSaturday(new Date()) },
];

export default function InteractionFormScreen() {
  const router = useRouter();
  const { friendId, mode } = useLocalSearchParams<{ friendId: string, mode: 'log' | 'plan' }>();
  const { addInteraction } = useInteractionStore();
  const { colors } = useTheme(); // Use the hook

  const isLogging = mode === 'log';

  const filteredDateOptions = isLogging
    ? dateOptions.filter(opt => opt.id === 'today')
    : dateOptions;

  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [notes, setNotes] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const [detailsSectionY, setDetailsSectionY] = useState(0);

  // Auto-scroll to details section when category is selected
  useEffect(() => {
    if (selectedCategory && detailsSectionY > 0) {
      scrollViewRef.current?.scrollTo({ y: detailsSectionY, animated: true });
    }
  }, [selectedCategory, detailsSectionY]);

  const handleCategorySelect = (category: InteractionCategory) => {
    setSelectedCategory(category);
    Vibration.vibrate(50);
  };

  const handleDateSelect = (date: Date) => {
      setSelectedDate(date);
      setShowCalendar(false);
  }

  const handleQuickDateSelect = (date: Date) => {
    setSelectedDate(date);
    Vibration.vibrate(50);
  }

  const handleSave = async () => {
    if (!selectedCategory || !friendId || !mode || !selectedDate) return;

    await addInteraction({
      friendIds: [friendId],
      category: selectedCategory, // NEW: Use category instead of activity
      activity: selectedCategory, // Keep for backward compatibility
      notes,
      date: selectedDate,
      type: mode,
      status: mode === 'log' ? 'completed' : 'planned',
      mode: 'one-on-one', // Deprecated field, use default
      vibe: selectedVibe,
    });
    Vibration.vibrate();
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: mode === 'log' ? 'Mark the Moment' : 'Set an Intention' }} />

        <Modal
            visible={showCalendar}
            animationType="slide"
            onRequestClose={() => setShowCalendar(false)}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={[styles.modalHeader, { borderColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select a Date</Text>
                    <TouchableOpacity onPress={() => setShowCalendar(false)} style={styles.closeButton}>
                        <X color={colors['muted-foreground']} size={24} />
                    </TouchableOpacity>
                </View>
                <CalendarView onDateSelect={handleDateSelect} selectedDate={selectedDate} maxDate={isLogging ? new Date() : undefined} />
            </SafeAreaView>
        </Modal>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView ref={scrollViewRef} style={{ flex: 1}} contentContainerStyle={styles.scrollContainer}>
                {/* NEW: Single-step category selection */}
                <Animated.View style={[styles.section, { borderColor: colors.border }]} entering={FadeInUp.duration(500)}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How did you connect?</Text>
                    <View style={styles.gridContainer}>
                        {categories.map((cat, index) => (
                            <Animated.View
                                key={cat.category}
                                style={{ width: '48%' }}
                                entering={FadeInUp.duration(500).delay(100 + index * 50)}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border },
                                        selectedCategory === cat.category && [styles.gridItemSelected, { borderColor: colors.primary }]
                                    ]}
                                    onPress={() => handleCategorySelect(cat.category)}
                                >
                                    <Text style={styles.gridItemIcon}>{cat.icon}</Text>
                                    <Text style={[styles.gridItemLabel, { color: colors.foreground }]}>{cat.label}</Text>
                                    <Text style={[styles.gridItemSublabel, { color: colors['muted-foreground'] }]}>{cat.description}</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>
                </Animated.View>

                {selectedCategory && (
                    <Animated.View style={[styles.section, { borderColor: colors.border }]} entering={FadeInUp.duration(500)} onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        setDetailsSectionY(y);
                    }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add Details</Text>
                            <TouchableOpacity onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }) }>
                                <ArrowUp size={24} color={colors['muted-foreground']} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.formContainer}>
                            <View style={styles.gridContainer}>
                                {filteredDateOptions.map((opt, index) => {
                                    const date = opt.getDate();
                                    const isSelected = isSameDay(selectedDate, date);
                                    return (
                                        <Animated.View key={opt.id} style={{ width: '48%' }} entering={FadeInUp.duration(500).delay(100 + index * 50)}>
                                            <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border }, isSelected && [styles.gridItemSelected, { borderColor: colors.primary }]]} onPress={() => handleQuickDateSelect(date)}>
                                                <Text style={styles.gridItemIcon}>{opt.icon}</Text>
                                                <Text style={[styles.gridItemLabel, { color: colors.foreground }]}>{opt.label}</Text>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    );
                                })}
                                <Animated.View style={{ width: '48%' }} entering={FadeInUp.duration(500).delay(100 + filteredDateOptions.length * 50)}>
                                    <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowCalendar(true)}>
                                        <Text style={styles.gridItemIcon}><CalendarIcon size={32} color={colors.foreground} /></Text>
                                        <Text style={[styles.gridItemLabel, { color: colors.foreground }]}>Pick date</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                            <Text style={[styles.selectedDateText, { color: colors.foreground }]}>When: {format(selectedDate, 'MMMM dd, yyyy')}</Text>
                            {isLogging && (
                                <View style={{ marginTop: 16, marginBottom: 16 }}>
                                    <MoonPhaseSelector onSelect={setSelectedVibe} selectedVibe={selectedVibe} />
                                </View>
                            )}
                            <TextInput
                                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                                placeholder="Notes..."
                                placeholderTextColor={colors['muted-foreground']}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                            />
                        </View>
                    </Animated.View>
                )}

            </ScrollView>
        </TouchableWithoutFeedback>
        {selectedCategory && (
            <View style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
                    <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>Save</Text>
                </TouchableOpacity>
            </View>
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    scrollContainer: { paddingBottom: 120, paddingHorizontal: 4 },
    section: { borderTopWidth: 1, paddingTop: 32, paddingBottom: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 24, fontWeight: '600', textAlign: 'center', width: '100%' },
    gridContainer: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridItem: { width: '100%', aspectRatio: 1, borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
    gridItemSelected: { borderWidth: 2 },
    gridItemIcon: { fontSize: 32, marginBottom: 8 },
    gridItemLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
    gridItemSublabel: { fontSize: 12, marginTop: 2, textAlign: 'center' },
    formContainer: { paddingHorizontal: 20, gap: 16 },
    input: { borderWidth: 1, borderRadius: 8, padding: 16, fontSize: 16 },
    multilineInput: { height: 120, textAlignVertical: 'top' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, borderTopWidth: 1 },
    saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
    saveButtonText: { fontSize: 16, fontWeight: '600' },
    selectedDateText: { textAlign: 'center', fontSize: 16, marginBottom: 16 },
    modalHeader: { padding: 20, paddingTop: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: '600' },
    closeButton: { padding: 8 },
});