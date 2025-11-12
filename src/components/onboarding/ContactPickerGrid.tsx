/// <reference types="nativewind/types" />
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as Contacts from 'expo-contacts';
import { CheckCircle2, Users, Plus } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { normalizeContactImageUri } from '../../lib/image-utils';

interface ContactPickerGridProps {
  maxSelection: number;
  onSelectionChange: (selectedContacts: Contacts.Contact[]) => void;
  onAddManually?: () => void;
}

const ContactItem = ({
  item,
  isSelected,
  onSelect
}: {
  item: Contacts.Contact;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    const firstName = names[0] || '';
    const lastName = names.length > 1 ? names[names.length - 1] : '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-indigo-100 text-indigo-700',
      'bg-teal-100 text-teal-700',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const colorClasses = getAvatarColor(item.name || '');

  return (
    <TouchableOpacity onPress={onSelect} className="items-center p-3 w-1/3">
      <View className="relative">
        <View
          className={`w-20 h-20 rounded-full justify-center items-center ${isSelected ? 'bg-emerald-500 border-4 border-emerald-500' : colorClasses}`}>
          {item.imageAvailable && item.image && !imageError ? (
            <Image
              source={{ uri: normalizeContactImageUri(item.image.uri) }}
              className="w-full h-full rounded-full"
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <Text className={`text-2xl font-semibold ${isSelected ? 'text-white' : ''}`}>
              {getInitials(item.name)}
            </Text>
          )}
        </View>
        {isSelected && (
          <Animated.View 
            entering={FadeIn.springify()}
            className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-1"
          >
            <CheckCircle2 color="white" size={20} strokeWidth={3} />
          </Animated.View>
        )}
      </View>
      
      <Text 
        className="mt-2 text-center text-sm text-gray-700 font-medium" 
        numberOfLines={2}
      >
        {item.name || 'Unknown'}
      </Text>
    </TouchableOpacity>
  );
};

export function ContactPickerGrid({ maxSelection, onSelectionChange, onAddManually }: ContactPickerGridProps) {
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName, 
          Contacts.Fields.LastName, 
          Contacts.Fields.Image
        ],
      });

      if (data.length > 0) {
        const sorted = data.sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        setContacts(sorted);
      }
      
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const selected = contacts.filter(c => selectedContactIds.includes(c.id));
    onSelectionChange(selected);
  }, [selectedContactIds, contacts, onSelectionChange]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactIds(prevSelectedIds => {
      if (prevSelectedIds.includes(contactId)) {
        return prevSelectedIds.filter(id => id !== contactId);
      } else {
        if (prevSelectedIds.length < maxSelection) {
          return [...prevSelectedIds, contactId];
        }
        return prevSelectedIds;
      }
    });
  };

  const handleAddManually = () => {
    onAddManually?.();
  };
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-20">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="text-gray-500 mt-4">Loading your contacts...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View className="flex-1 justify-center items-center py-20 px-6">
        <Users size={48} color="#9ca3af" />
        <Text className="text-xl font-semibold text-gray-700 mt-4 text-center">
          Contacts Access Needed
        </Text>
        <Text className="text-base text-gray-600 mt-2 text-center">
          Weave needs access to your contacts to help you select your Inner Circle. 
          Please enable it in Settings.
        </Text>
      </View>
    );
  }

  return (
    <Animated.View className="flex-1" entering={FadeIn.duration(300)}>
      <View className="pt-8 pb-4 px-6">
        <Text className="text-2xl font-bold text-center text-gray-800 mb-2">Who's in your Inner Circle?</Text>
        <Text className="text-base text-gray-600 text-center mb-4">Select up to 3 people you trust the most.</Text>
        <TouchableOpacity onPress={handleAddManually} className="flex-row items-center justify-center bg-gray-100 p-3 rounded-lg">
          <Plus size={16} color="#374151" />
          <Text className="text-gray-700 font-medium ml-2">Add Manually</Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 py-3 bg-emerald-50 border-y border-emerald-100">
        <Text className="text-sm text-emerald-700 text-center font-medium">
          {selectedContactIds.length} / {maxSelection} selected
        </Text>
      </View>
      
      {contacts.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 px-6">
          <Users size={48} color="#9ca3af" />
          <Text className="text-xl font-semibold text-gray-700 mt-4 text-center">
            No Contacts Found
          </Text>
          <Text className="text-base text-gray-600 mt-2 text-center">
            Add some contacts to your device first, or add one manually.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactItem
              item={item}
              isSelected={selectedContactIds.includes(item.id)}
              onSelect={() => handleSelectContact(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 90, paddingTop: 10 }}
        />
      )}
    </Animated.View>
  );
}