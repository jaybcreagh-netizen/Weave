import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert, Keyboard, TouchableWithoutFeedback, Vibration } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { useInteractionStore } from '../stores/interactionStore';
import { theme } from '../theme';
import { X, Calendar } from 'lucide-react-native';
import { CalendarView } from './CalendarView';
import { format } from 'date-fns';

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

type ViewStep = 'mode' | 'activity' | 'reflection' | 'calendar';

export function InteractionModal() {
  const { interactionModal, closeInteractionModal, selectedFriendId } = useUIStore();
  const { addInteraction } = useInteractionStore();

  const [currentView, setCurrentView] = useState<ViewStep>('mode');
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (interactionModal.isOpen) {
      setCurrentView('mode');
      setSelectedMode(null);
      setSelectedActivity(null);
      setSelectedDate(new Date()); // Default to today
      setNotes('');
    }
  }, [interactionModal.isOpen]);

  const handleModeSelect = (modeId: string) => {
    setSelectedMode(modeId);
    setCurrentView('activity');
  };

  const handleActivitySelect = (activity: string) => {
    setSelectedActivity(activity);
    setCurrentView('reflection');
  };

  const handleDateSelect = (date: Date) => {
      setSelectedDate(date);
      setCurrentView('reflection');
  }

  const handleSave = async () => {
    if (!selectedActivity || !selectedMode || !selectedFriendId || !interactionModal.mode || !selectedDate) return;

    await addInteraction({
      friendIds: [selectedFriendId],
      activity: selectedActivity,
      notes,
      date: selectedDate,
      type: interactionModal.mode,
      status: interactionModal.mode === 'log' ? 'completed' : 'planned',
      mode: selectedMode,
    });
    Vibration.vibrate();
    closeInteractionModal();
  };

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={styles.header}>
        <TouchableOpacity onPress={closeInteractionModal} style={styles.closeButton}>
            <X color={theme.colors['muted-foreground']} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
        <View style={{width: 40}} />
    </View>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'mode':
        return (
            <>
                {renderHeader(interactionModal.mode === 'log' ? 'Mark the Moment' : 'Set an Intention', 'What was the energy?')}
                <ScrollView contentContainerStyle={styles.gridContainer}>
                    {modes.map(mode => (
                        <TouchableOpacity key={mode.id} style={styles.gridItem} onPress={() => handleModeSelect(mode.id)}>
                            <Text style={styles.gridItemIcon}>{mode.icon}</Text>
                            <Text style={styles.gridItemLabel}>{mode.label}</Text>
                            <Text style={styles.gridItemSublabel}>{mode.sublabel}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </>
        );
      case 'activity':
        const availableActivities = forms[selectedMode || ''] || [];
        return (
            <>
                {renderHeader('How did it take shape?')}
                <ScrollView contentContainerStyle={styles.gridContainer}>
                    {availableActivities.map(act => (
                        <TouchableOpacity key={act.activity} style={styles.gridItem} onPress={() => handleActivitySelect(act.activity)}>
                            <Text style={styles.gridItemIcon}>{act.icon}</Text>
                            <Text style={styles.gridItemLabel}>{act.activity}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </>
        );
      case 'reflection':
        return (
            <>
                {renderHeader('Add Details')}
                <View style={styles.formContainer}>
                    <Text style={styles.reflectionInfo}>Activity: {selectedActivity}</Text>
                    <TouchableOpacity style={styles.datePickerButton} onPress={() => setCurrentView('calendar')}>
                        <Calendar size={16} color={theme.colors['muted-foreground']} />
                        <Text style={styles.datePickerButtonText}>
                            {selectedDate ? format(selectedDate, 'MMMM dd, yyyy') : 'Select a date'}
                        </Text>
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        placeholder="Notes..."
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                    />
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                </View>
            </>
        );
        case 'calendar':
            return (
                <>
                    {renderHeader('Select a Date')}
                    <View style={styles.formContainer}>
                        <CalendarView onDateSelect={handleDateSelect} />
                    </View>
                </>
            )
      default: return null;
    }
  };

  return (
    <Modal animationType="slide" transparent={true} visible={interactionModal.isOpen} onRequestClose={closeInteractionModal}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContainer}>
                {renderContent()}
            </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContainer: { height: '90%', backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    header: { padding: 20, paddingTop: 16, borderBottomWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitles: { alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.foreground },
    headerSubtitle: { fontSize: 14, color: theme.colors['muted-foreground'], marginTop: 4 },
    closeButton: { padding: 8, position: 'absolute', top: 12, right: 12, zIndex: 1 },
    gridContainer: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
    gridItem: { width: '48%', aspectRatio: 1, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    gridItemIcon: { fontSize: 32, marginBottom: 8 },
    gridItemLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.foreground, textAlign: 'center' },
    gridItemSublabel: { fontSize: 12, color: theme.colors['muted-foreground'], marginTop: 2, textAlign: 'center' },
    formContainer: { padding: 20, gap: 16, flex: 1 },
    reflectionInfo: { fontSize: 16, color: theme.colors['muted-foreground'], textAlign: 'center', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 16, fontSize: 16, backgroundColor: theme.colors.card },
    multilineInput: { height: 120, textAlignVertical: 'top' },
    saveButton: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    datePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 16 },
    datePickerButtonText: { fontSize: 16, color: theme.colors.foreground },
});