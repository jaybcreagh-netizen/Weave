import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput } from 'react-native';
import { WeaveLoading } from '@/shared/components/WeaveLoading';
import * as Contacts from 'expo-contacts';
import { CheckCircle2, Users, Plus, Search, X } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { normalizeContactImageUri } from '@/modules/relationships/utils/image.utils';

// Consts for layout to prevent jumping
const NUM_COLUMNS = 3;
const ITEM_HEIGHT = 130; // Fixed height including padding

interface ContactPickerGridProps {
  maxSelection: number;
  onSelectionChange: (selectedContacts: Contacts.Contact[]) => void;
  onAddManually?: () => void;
  title?: string;
  subtitle?: string;
}

const ContactItem = React.memo(({
  item,
  isSelected,
  onSelect
}: {
  item: Contacts.Contact;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

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
  const shouldShowImage = item.imageAvailable && item.image && !imageError;

  return (
    <TouchableOpacity
      onPress={onSelect}
      className="items-center p-2 w-1/3"
      style={{ height: ITEM_HEIGHT }}
    >
      <View className="relative">
        <View
          className={`w-20 h-20 rounded-full justify-center items-center ${isSelected ? 'bg-emerald-500 border-4 border-emerald-500' : colorClasses}`}>
          {shouldShowImage ? (
            <>
              <Image
                source={{ uri: normalizeContactImageUri(item.image?.uri || '') }}
                className="w-full h-full rounded-full"
                resizeMode="cover"
                onError={() => setImageError(true)}
                onLoad={() => setImageLoaded(true)}
                fadeDuration={0}
              />
              {!imageLoaded && (
                <View className="absolute inset-0 justify-center items-center">
                  <Text className={`text-2xl font-semibold ${isSelected ? 'text-white' : ''}`}>
                    {getInitials(item.name)}
                  </Text>
                </View>
              )}
            </>
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
});

export function ContactPickerGrid({
  maxSelection,
  onSelectionChange,
  onAddManually,
  title = "Who's in your Inner Circle?",
  subtitle = "Select up to 3 people you trust the most."
}: ContactPickerGridProps) {
  const [allContacts, setAllContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      let { status } = await Contacts.getPermissionsAsync();

      if (status !== 'granted') {
        const result = await Contacts.requestPermissionsAsync();
        status = result.status;
      }

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
        setAllContacts(sorted);
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const selected = allContacts.filter(c => c.id && selectedContactIds.includes(c.id));
    onSelectionChange(selected);
  }, [selectedContactIds, allContacts, onSelectionChange]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return allContacts;
    return allContacts.filter(c =>
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allContacts, searchQuery]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactIds(prevSelectedIds => {
      if (prevSelectedIds.includes(contactId)) {
        return prevSelectedIds.filter(id => id !== contactId);
      }
      if (maxSelection === 1) {
        return [contactId];
      }
      if (prevSelectedIds.length < maxSelection) {
        return [...prevSelectedIds, contactId];
      }
      return prevSelectedIds;
    });
  };

  const handleAddManually = () => {
    onAddManually?.();
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-20">
        <WeaveLoading size={48} color="#10b981" />
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
      <View className="pt-4 pb-4 px-6 bg-white z-10">
        <Text className="text-2xl font-bold text-center text-gray-800 mb-1">{title}</Text>
        <Text className="text-base text-gray-600 text-center mb-4">{subtitle}</Text>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2 mb-3">
          <Search size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-3 text-base text-gray-800 py-2"
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleAddManually} className="flex-row items-center justify-center bg-gray-50 p-3 rounded-lg border border-gray-200">
          <Plus size={16} color="#374151" />
          <Text className="text-gray-700 font-medium ml-2">Add Manually</Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 py-2 bg-emerald-50 border-y border-emerald-100">
        <Text className="text-sm text-emerald-700 text-center font-medium">
          {selectedContactIds.length} / {maxSelection} selected
        </Text>
      </View>

      {filteredContacts.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 px-6">
          <Users size={48} color="#9ca3af" />
          <Text className="text-xl font-semibold text-gray-700 mt-4 text-center">
            {searchQuery ? 'No matching contacts' : 'No Contacts Found'}
          </Text>
          <Text className="text-base text-gray-600 mt-2 text-center">
            {searchQuery ? 'Try a different search term.' : 'Add some contacts to your device first.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id || `contact-${Math.random()}`}
          renderItem={({ item }) => (
            <ContactItem
              item={item}
              isSelected={!!item.id && selectedContactIds.includes(item.id)}
              onSelect={() => item.id && handleSelectContact(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 90, paddingTop: 10 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          initialNumToRender={15}
          windowSize={5}
          getItemLayout={(data, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * Math.floor(index / NUM_COLUMNS),
            index,
          })}
        />
      )}
    </Animated.View>
  );
}