import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Keyboard, TouchableWithoutFeedback, Vibration, Modal } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInteractionStore } from '../src/stores/interactionStore';
import { theme } from '../src/theme';
import { Calendar as CalendarIcon, X } from 'lucide-react-native';
import { CalendarView } from '../src/components/CalendarView';
import { format, addDays, nextSaturday, isSameDay } from 'date-fns';

const modes = [
  { id: 'one-on-one', icon: '🌿', label: 'One-on-One', sublabel: 'For depth and focus' },
  { id: 'group-flow', icon: '🌊', label: 'Group Flow', sublabel: 'For shared energy' },
  { id: 'celebration', icon: '🔥', label: 'Celebration', sublabel: 'For marking moments' },
  { id: 'quick-touch', icon: '🌀', label: 'Quick Touch', sublabel: 'For light connection' },
  { id: 'cozy-time', icon: '🌙', label: 'Cozy Time', sublabel: 'For warmth and ease' },
  { id: 'out-and-about', icon: '☀️', label: 'Out & About', sublabel: 'For movement and play' },
];

const forms: Record<string, Array<{activity: string, icon: string}>> = {
  'one-on-one': [
    { activity: 'Coffee', icon: '☕' }, { activity: 'Meal', icon: '🍽️' }, { activity: 'Walk', icon: '🚶' },
    { activity: 'Chat', icon: '💬' }, { activity: 'Video Call', icon: '📹' }, { activity: 'Something else', icon: '✨' }
  ],
  'group-flow': [
    { activity: 'Event', icon: '🎪' }, { activity: 'Party', icon: '🎉' }, { activity: 'Dinner Party', icon: '🍷' },
    { activity: 'Hangout', icon: '👥' }, { activity: 'Game Night', icon: '🎲' }, { activity: 'Something else', icon: '✨' }
  ],
  'celebration': [
    { activity: 'Birthday', icon: '🎂' }, { activity: 'Anniversary', icon: '💕' }, { activity: 'Milestone', icon: '🏆' },
    { activity: 'Holiday', icon: '🎄' }, { activity: 'Achievement', icon: '🌟' }, { activity: 'Something else', icon: '✨' }
  ],
  'quick-touch': [
    { activity: 'Text', icon: '💬' }, { activity: 'Call', icon: '📞' }, { activity: 'DM', icon: '📱' },
    { activity: 'Quick Visit', icon: '🚪' }, { activity: 'Voice Note', icon: '🎤' }, { activity: 'Something else', icon: '✨' }
  ],
  'cozy-time': [
    { activity: 'Home Visit', icon: '🏠' }, { activity: 'Movie Night', icon: '🍿' }, { activity: 'Cooking', icon: '👩‍🍳' },
    { activity: 'Tea Time', icon: '🫖' }, { activity: 'Reading Together', icon: '📚' }, { activity: 'Something else', icon: '✨' }
  ],
  'out-and-about': [
    { activity: 'Hike', icon: '🥾' }, { activity: 'Concert', icon: '🎵' }, { activity: 'Museum', icon: '🖼️' },
    { activity: 'Shopping', icon: '🛍️' }, { activity: 'Adventure', icon: '🗺️' }, { activity: 'Something else', icon: '✨' }
  ],
};

const dateOptions = [
    { id: 'today', icon: '☀️', label: 'Today', getDate: () => new Date() },
    { id: 'tomorrow', icon: '🌑', label: 'Tomorrow', getDate: () => addDays(new Date(), 1) },
    { id: 'weekend', icon: '🌓', label: 'This Weekend', getDate: () => nextSaturday(new Date()) },
];

export default function InteractionFormScreen() {
  const router = useRouter();
  const { friendId, mode } = useLocalSearchParams<{ friendId: string, mode: 'log' | 'plan' }>();
  const { addInteraction } = useInteractionStore();

  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionLayouts, setSectionLayouts] = useState({ activity: 0, reflection: 0 });

  useEffect(() => {
    if (sectionLayouts.activity > 0) {
      scrollViewRef.current?.scrollTo({ y: sectionLayouts.activity, animated: true });
    }
  }, [sectionLayouts.activity]);

  useEffect(() => {
    if (sectionLayouts.reflection > 0) {
      scrollViewRef.current?.scrollTo({ y: sectionLayouts.reflection, animated: true });
    }
  }, [sectionLayouts.reflection]);

  const handleModeSelect = (modeId: string) => {
    setSelectedMode(modeId);
    setSelectedActivity(null); // Reset subsequent selections
  };

  const handleActivitySelect = (activity: string) => {
    setSelectedActivity(activity);
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
    if (!selectedActivity || !selectedMode || !friendId || !mode || !selectedDate) return;

    await addInteraction({
      friendIds: [friendId],
      activity: selectedActivity,
      notes,
      date: selectedDate,
      type: mode,
      status: mode === 'log' ? 'completed' : 'planned',
      mode: selectedMode,
    });
    Vibration.vibrate();
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack.Screen options={{ title: mode === 'log' ? 'Mark the Moment' : 'Set an Intention' }} />

        <Modal
            visible={showCalendar}
            animationType="slide"
            onRequestClose={() => setShowCalendar(false)}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select a Date</Text>
                    <TouchableOpacity onPress={() => setShowCalendar(false)} style={styles.closeButton}>
                        <X color={theme.colors['muted-foreground']} size={24} />
                    </TouchableOpacity>
                </View>
                <CalendarView onDateSelect={handleDateSelect} selectedDate={selectedDate} />
            </SafeAreaView>
        </Modal>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView ref={scrollViewRef} style={{ flex: 1}} contentContainerStyle={styles.scrollContainer}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What was the energy?</Text>
                    <View style={styles.gridContainer}>
                        {modes.map(m => (
                            <TouchableOpacity key={m.id} style={[styles.gridItem, selectedMode === m.id && styles.gridItemSelected]} onPress={() => handleModeSelect(m.id)}>
                                <Text style={styles.gridItemIcon}>{m.icon}</Text>
                                <Text style={styles.gridItemLabel}>{m.label}</Text>
                                <Text style={styles.gridItemSublabel}>{m.sublabel}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {selectedMode && (
                    <View style={styles.section} onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        setSectionLayouts(prev => ({ ...prev, activity: y }));
                    }}>
                        <Text style={styles.sectionTitle}>How did it take shape?</Text>
                        <View style={styles.gridContainer}>
                            {(forms[selectedMode] || []).map(act => (
                                <TouchableOpacity key={act.activity} style={[styles.gridItem, selectedActivity === act.activity && styles.gridItemSelected]} onPress={() => handleActivitySelect(act.activity)}>
                                    <Text style={styles.gridItemIcon}>{act.icon}</Text>
                                    <Text style={styles.gridItemLabel}>{act.activity}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {selectedActivity && (
                    <View style={styles.section} onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        setSectionLayouts(prev => ({ ...prev, reflection: y }));
                    }}>
                        <Text style={styles.sectionTitle}>Add Details</Text>
                        <View style={styles.formContainer}>
                            <View style={styles.gridContainer}>
                                {dateOptions.map(opt => {
                                    const date = opt.getDate();
                                    const isSelected = isSameDay(selectedDate, date);
                                    return (
                                        <TouchableOpacity key={opt.id} style={[styles.gridItem, isSelected && styles.gridItemSelected]} onPress={() => handleQuickDateSelect(date)}>
                                            <Text style={styles.gridItemIcon}>{opt.icon}</Text>
                                            <Text style={styles.gridItemLabel}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                                <TouchableOpacity style={styles.gridItem} onPress={() => setShowCalendar(true)}>
                                    <Text style={styles.gridItemIcon}><CalendarIcon size={32} color={theme.colors.foreground} /></Text>
                                    <Text style={styles.gridItemLabel}>Pick date</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.selectedDateText}>When: {format(selectedDate, 'MMMM dd, yyyy')}</Text>
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                placeholder="Notes..."
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                            />
                        </View>
                    </View>
                )}

            </ScrollView>
        </TouchableWithoutFeedback>
        {selectedActivity && (
            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
            </View>
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    scrollContainer: { paddingBottom: 120 },
    section: { borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 24 },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.foreground, paddingHorizontal: 20, marginBottom: 16 },
    gridContainer: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridItem: { width: '48%', aspectRatio: 1, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    gridItemSelected: { borderColor: theme.colors.primary, borderWidth: 2 },
    gridItemIcon: { fontSize: 32, marginBottom: 8 },
    gridItemLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground, textAlign: 'center' },
    gridItemSublabel: { fontSize: 12, color: theme.colors['muted-foreground'], marginTop: 2, textAlign: 'center' },
    formContainer: { paddingHorizontal: 20, gap: 16 },
    input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 16, fontSize: 16, backgroundColor: theme.colors.card },
    multilineInput: { height: 120, textAlignVertical: 'top' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.background, padding: 20, borderTopWidth: 1, borderColor: theme.colors.border },
    saveButton: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    selectedDateText: { textAlign: 'center', fontSize: 16, color: theme.colors.foreground, marginBottom: 16 },
    modalHeader: { padding: 20, paddingTop: 16, borderBottomWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.foreground },
    closeButton: { padding: 8 },
});