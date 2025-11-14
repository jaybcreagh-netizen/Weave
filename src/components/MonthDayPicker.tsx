import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { X, Calendar } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

interface MonthDayPickerProps {
  value?: string; // Format: "MM-DD" (stored format)
  onChange: (value: string) => void;
  label?: string;
  displayFormat?: 'MM-DD' | 'DD-MM'; // Display format (defaults to DD-MM for UK)
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const getDaysInMonth = (month: string): number => {
  const daysMap: Record<string, number> = {
    '01': 31, '02': 29, '03': 31, '04': 30, '05': 31, '06': 30,
    '07': 31, '08': 31, '09': 30, '10': 31, '11': 30, '12': 31,
  };
  return daysMap[month] || 31;
};

export function MonthDayPicker({ value, onChange, label = 'Set birthday', displayFormat = 'DD-MM' }: MonthDayPickerProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  // Parse current value (stored as MM-DD)
  const [month, day] = value ? value.split('-') : ['01', '01'];
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedDay, setSelectedDay] = useState(day);

  const handleSave = () => {
    // Always store as MM-DD
    onChange(`${selectedMonth}-${selectedDay}`);
    setShowPicker(false);
  };

  const handleClear = () => {
    onChange('');
    setShowPicker(false);
  };

  const formatDisplay = (value?: string) => {
    if (!value) return label;
    const [m, d] = value.split('-');
    const monthLabel = MONTHS.find(month => month.value === m)?.label || '';
    const dayNum = parseInt(d);

    // Format based on display preference
    if (displayFormat === 'MM-DD') {
      return `${monthLabel} ${dayNum}`;
    } else {
      // DD-MM format: "15 January"
      return `${dayNum} ${monthLabel}`;
    }
  };

  // Get available days for selected month
  const daysInMonth = getDaysInMonth(selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return { value: day, label: (i + 1).toString() };
  });

  // Adjust selected day if it exceeds days in new month
  React.useEffect(() => {
    if (parseInt(selectedDay) > daysInMonth) {
      setSelectedDay(daysInMonth.toString().padStart(2, '0'));
    }
  }, [selectedMonth, daysInMonth, selectedDay]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Calendar size={20} color={colors['muted-foreground']} />
        <Text style={[styles.dateButtonText, { color: value ? colors.foreground : colors['muted-foreground'] }]}>
          {formatDisplay(value)}
        </Text>
        {value && (
          <TouchableOpacity onPress={(e) => {
            e.stopPropagation();
            handleClear();
          }}>
            <X size={16} color={colors['muted-foreground']} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Select Birthday</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            {/* Picker Content */}
            <View style={styles.pickersRow}>
              {/* Show Day first for DD-MM, Month first for MM-DD */}
              {displayFormat === 'DD-MM' ? (
                <>
                  {/* Day Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={[styles.columnLabel, { color: colors['muted-foreground'] }]}>Day</Text>
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                      {days.map((dayItem) => (
                        <TouchableOpacity
                          key={dayItem.value}
                          onPress={() => setSelectedDay(dayItem.value)}
                          style={[
                            styles.pickerItem,
                            selectedDay === dayItem.value && [
                              styles.pickerItemSelected,
                              { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                            ]
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              { color: colors.foreground },
                              selectedDay === dayItem.value && [
                                styles.pickerItemTextSelected,
                                { color: colors.primary }
                              ]
                            ]}
                          >
                            {dayItem.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Month Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={[styles.columnLabel, { color: colors['muted-foreground'] }]}>Month</Text>
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                      {MONTHS.map((monthItem) => (
                        <TouchableOpacity
                          key={monthItem.value}
                          onPress={() => setSelectedMonth(monthItem.value)}
                          style={[
                            styles.pickerItem,
                            selectedMonth === monthItem.value && [
                              styles.pickerItemSelected,
                              { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                            ]
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              { color: colors.foreground },
                              selectedMonth === monthItem.value && [
                                styles.pickerItemTextSelected,
                                { color: colors.primary }
                              ]
                            ]}
                          >
                            {monthItem.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </>
              ) : (
                <>
                  {/* Month Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={[styles.columnLabel, { color: colors['muted-foreground'] }]}>Month</Text>
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                      {MONTHS.map((monthItem) => (
                        <TouchableOpacity
                          key={monthItem.value}
                          onPress={() => setSelectedMonth(monthItem.value)}
                          style={[
                            styles.pickerItem,
                            selectedMonth === monthItem.value && [
                              styles.pickerItemSelected,
                              { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                            ]
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              { color: colors.foreground },
                              selectedMonth === monthItem.value && [
                                styles.pickerItemTextSelected,
                                { color: colors.primary }
                              ]
                            ]}
                          >
                            {monthItem.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Day Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={[styles.columnLabel, { color: colors['muted-foreground'] }]}>Day</Text>
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                      {days.map((dayItem) => (
                        <TouchableOpacity
                          key={dayItem.value}
                          onPress={() => setSelectedDay(dayItem.value)}
                          style={[
                            styles.pickerItem,
                            selectedDay === dayItem.value && [
                              styles.pickerItemSelected,
                              { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                            ]
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              { color: colors.foreground },
                              selectedDay === dayItem.value && [
                                styles.pickerItemTextSelected,
                                { color: colors.primary }
                              ]
                            ]}
                          >
                            {dayItem.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>

            {/* Footer Buttons */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={[styles.button, styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.muted }]}
              >
                <Text style={[styles.buttonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.buttonText, { color: colors['primary-foreground'] }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    height: 500, // Fixed height to ensure pickers are visible
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  pickersRow: {
    flexDirection: 'row',
    flex: 1,
  },
  pickerColumn: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  columnLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerItemSelected: {
    borderWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
