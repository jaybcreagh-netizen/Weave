/**
 * ContactLinker
 *
 * A bottom sheet that allows users to link a device contact to a friend,
 * extracting phone number and email for messaging integration.
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import { Users, Phone, Mail, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { database } from '@/db';
import Friend from '@/db/models/Friend';

interface ContactLinkerProps {
  visible: boolean;
  onClose: () => void;
  friend: Friend;
  onLinked?: () => void;
}

type Mode = 'choice' | 'manual' | 'permission';

export function ContactLinker({
  visible,
  onClose,
  friend,
  onLinked,
}: ContactLinkerProps) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('choice');
  const [phoneNumber, setPhoneNumber] = useState(friend.phoneNumber || '');
  const [email, setEmail] = useState(friend.email || '');
  const [loading, setLoading] = useState(false);

  const pendingActionRef = useRef<'save' | null>(null);

  const resetState = useCallback(() => {
    setMode('choice');
    setPhoneNumber(friend.phoneNumber || '');
    setEmail(friend.email || '');
    setLoading(false);
  }, [friend.phoneNumber, friend.email]);

  const handlePickFromContacts = useCallback(async () => {
    try {
      // Request permission
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        setMode('permission');
        return;
      }

      // Open native contact picker (presentContactPickerAsync is iOS only)
      // For cross-platform, we'll use getContactsAsync with a search
      if (Platform.OS === 'ios') {
        // iOS has a native contact picker
        const contact = await Contacts.presentContactPickerAsync();
        if (contact) {
          processContact(contact);
        }
      } else {
        // Android: Show all contacts and let user search
        // For simplicity, we'll switch to manual mode with a prompt
        Alert.alert(
          'Link Contact',
          `Enter ${friend.name}'s phone number or email manually, or copy from your contacts app.`,
          [
            { text: 'Enter Manually', onPress: () => setMode('manual') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      Alert.alert('Error', 'Failed to access contacts. Please enter manually.');
      setMode('manual');
    }
  }, [friend.name]);

  const processContact = useCallback(
    (contact: Contacts.Contact) => {
      const phone = contact.phoneNumbers?.[0]?.number;
      const emailAddr = contact.emails?.[0]?.email;

      if (!phone && !emailAddr) {
        Alert.alert(
          'No Contact Info',
          'This contact has no phone number or email. Please enter manually.',
          [{ text: 'OK', onPress: () => setMode('manual') }]
        );
        return;
      }

      // Update state with contact info
      if (phone) setPhoneNumber(phone);
      if (emailAddr) setEmail(emailAddr);

      // Save directly
      saveContactInfo(phone, emailAddr, contact.id);
    },
    []
  );

  const saveContactInfo = useCallback(
    async (phone?: string, emailAddr?: string, contactId?: string) => {
      if (!phone && !emailAddr) {
        Alert.alert('Required', 'Please enter a phone number or email.');
        return;
      }

      setLoading(true);
      try {
        await database.write(async () => {
          await friend.update((f) => {
            if (phone) f.phoneNumber = phone;
            if (emailAddr) f.email = emailAddr;
            if (contactId) f.contactId = contactId;
          });
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pendingActionRef.current = 'save';
        onClose();
      } catch (error) {
        console.error('Error saving contact info:', error);
        Alert.alert('Error', 'Failed to save contact information.');
      } finally {
        setLoading(false);
      }
    },
    [friend, onClose]
  );

  const handleManualSave = useCallback(() => {
    saveContactInfo(phoneNumber || undefined, email || undefined);
  }, [phoneNumber, email, saveContactInfo]);

  const handleCloseComplete = useCallback(() => {
    if (pendingActionRef.current === 'save') {
      onLinked?.();
    }
    pendingActionRef.current = null;
    resetState();
  }, [onLinked, resetState]);

  const renderChoiceMode = () => (
    <View className="gap-3">
      <Text className="text-center mb-2" style={{ color: colors['muted-foreground'] }}>
        Link contact information to reach out via messaging apps
      </Text>

      <TouchableOpacity
        onPress={handlePickFromContacts}
        className="flex-row items-center p-4 rounded-xl"
        style={{ backgroundColor: colors.primary }}
        activeOpacity={0.8}
      >
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
        >
          <Users size={20} color={colors['primary-foreground']} />
        </View>
        <View className="flex-1">
          <Text
            className="text-base font-semibold"
            style={{ color: colors['primary-foreground'] }}
          >
            Choose from Contacts
          </Text>
          <Text className="text-sm opacity-80" style={{ color: colors['primary-foreground'] }}>
            Import phone & email automatically
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMode('manual')}
        className="flex-row items-center p-4 rounded-xl border"
        style={{ backgroundColor: colors.muted, borderColor: colors.border }}
        activeOpacity={0.8}
      >
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: colors.primary + '20' }}
        >
          <Phone size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
            Enter Manually
          </Text>
          <Text className="text-sm" style={{ color: colors['muted-foreground'] }}>
            Type phone number or email
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderManualMode = () => (
    <View className="gap-4">
      <View>
        <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
          Phone Number
        </Text>
        <View
          className="flex-row items-center px-4 py-3 rounded-xl"
          style={{ backgroundColor: colors.muted }}
        >
          <Phone size={18} color={colors['muted-foreground']} />
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+1 234 567 8900"
            placeholderTextColor={colors['muted-foreground']}
            keyboardType="phone-pad"
            className="flex-1 ml-3 text-base"
            style={{ color: colors.foreground }}
          />
        </View>
      </View>

      <View>
        <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
          Email
        </Text>
        <View
          className="flex-row items-center px-4 py-3 rounded-xl"
          style={{ backgroundColor: colors.muted }}
        >
          <Mail size={18} color={colors['muted-foreground']} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="friend@example.com"
            placeholderTextColor={colors['muted-foreground']}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 ml-3 text-base"
            style={{ color: colors.foreground }}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={handleManualSave}
        disabled={loading || (!phoneNumber && !email)}
        className="flex-row items-center justify-center p-4 rounded-xl mt-2"
        style={{
          backgroundColor: colors.primary,
          opacity: loading || (!phoneNumber && !email) ? 0.5 : 1,
        }}
        activeOpacity={0.8}
      >
        <Check size={20} color={colors['primary-foreground']} />
        <Text
          className="text-base font-semibold ml-2"
          style={{ color: colors['primary-foreground'] }}
        >
          {loading ? 'Saving...' : 'Save Contact Info'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode('choice')} className="py-2">
        <Text className="text-center" style={{ color: colors.primary }}>
          ← Back to options
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissionMode = () => (
    <View className="gap-4 py-4">
      <Text className="text-center text-base" style={{ color: colors.foreground }}>
        Contact access is required to import phone numbers and emails.
      </Text>
      <Text className="text-center" style={{ color: colors['muted-foreground'] }}>
        Please enable contact access in your device settings, or enter the information manually.
      </Text>

      <TouchableOpacity
        onPress={() => setMode('manual')}
        className="flex-row items-center justify-center p-4 rounded-xl"
        style={{ backgroundColor: colors.primary }}
        activeOpacity={0.8}
      >
        <Text className="text-base font-semibold" style={{ color: colors['primary-foreground'] }}>
          Enter Manually
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AnimatedBottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={handleCloseComplete}
      height="form"
      title={`Link Contact for ${friend.name}`}
    >
      {mode === 'choice' && renderChoiceMode()}
      {mode === 'manual' && renderManualMode()}
      {mode === 'permission' && renderPermissionMode()}
    </AnimatedBottomSheet>
  );
}
