import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { X, Calendar } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

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

  // Derive modal title from label (e.g., "Set birthday" -> "Select Birthday")
  const getModalTitle = () => {
    if (label.toLowerCase().includes('anniversary')) {
      return 'Select Anniversary';
    }
    return 'Select Birthday';
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

  const PickerColumn = ({
    type,
    items,
    selectedValue,
    onSelect
  }: {
    type: 'Month' | 'Day',
    items: { value: string, label: string }[],
    selectedValue: string,
    onSelect: (val: string) => void
  }) => (
    <View className="flex-1 px-3 pt-4">
      <Text className="text-sm font-semibold text-center mb-3" style={{ color: colors['muted-foreground'] }}>{type}</Text>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const isSelected = selectedValue === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              onPress={() => onSelect(item.value)}
              className={`
                        py-3.5 px-4 rounded-lg mb-2 border
                        ${isSelected ? 'border-primary bg-primary/20' : 'border-transparent'}
                    `}
              style={isSelected ? { backgroundColor: colors.primary + '20', borderColor: colors.primary } : {}}
            >
              <Text
                className={`text-base text-center ${isSelected ? 'font-semibold' : ''}`}
                style={{ color: isSelected ? colors.primary : colors.foreground }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="flex-row items-center gap-3 border rounded-xl p-4"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <Calendar size={20} color={colors['muted-foreground']} />
        <Text
          className="flex-1 text-base"
          style={{ color: value ? colors.foreground : colors['muted-foreground'] }}
        >
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
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="rounded-t-3xl border h-[500px]"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Header */}
            <View
              className="flex-row justify-between items-center p-5 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <Text
                className="text-xl font-semibold font-lora-bold"
                style={{ color: colors.foreground }}
              >
                {getModalTitle()}
              </Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            {/* Picker Content */}
            <View className="flex-row flex-1">
              {displayFormat === 'DD-MM' ? (
                <>
                  <PickerColumn type="Day" items={days} selectedValue={selectedDay} onSelect={setSelectedDay} />
                  <PickerColumn type="Month" items={MONTHS} selectedValue={selectedMonth} onSelect={setSelectedMonth} />
                </>
              ) : (
                <>
                  <PickerColumn type="Month" items={MONTHS} selectedValue={selectedMonth} onSelect={setSelectedMonth} />
                  <PickerColumn type="Day" items={days} selectedValue={selectedDay} onSelect={setSelectedDay} />
                </>
              )}
            </View>

            {/* Footer Buttons */}
            <View
              className="flex-row p-5 gap-3 border-t"
              style={{ borderTopColor: colors.border }}
            >
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                className="flex-1 py-3.5 rounded-xl items-center border"
                style={{ borderColor: colors.border, backgroundColor: colors.muted }}
              >
                <Text className="text-base font-semibold" style={{ color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="flex-1 py-3.5 rounded-xl items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-base font-semibold" style={{ color: colors['primary-foreground'] }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

