import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { WeaveLoading } from '@/shared/components/WeaveLoading';
import * as Contacts from 'expo-contacts';
import { CheckCircle2, Users, Plus, Search, X } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { normalizeContactImageUri } from '@/modules/relationships';
import { useTheme } from '@/shared/hooks/useTheme';
import { CachedImage } from '@/shared/ui';

// Consts for layout to prevent jumping
const NUM_COLUMNS = 3;
const ITEM_HEIGHT = 150; // Increased height to prevent clipping

interface ContactPickerGridProps {
  maxSelection: number;
  onSelectionChange: (selectedContacts: Contacts.Contact[]) => void;
  onAddManually?: () => void;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
  showAddManually?: boolean;
  selectedIds?: string[]; // Allow parent to control selection if needed, though mostly internal
  externalSearchQuery?: string;
}

const ContactItem = React.memo(({
  item,
  isSelected,
  onSelect,
  colors
}: {
  item: Contacts.Contact;
  isSelected: boolean;
  onSelect: () => void;
  colors: any;
}) => {
  const [imageError, setImageError] = useState(false);

  // ... (ContactItem implementation remains the same)
  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    const firstName = names[0] || '';
    const lastName = names.length > 1 ? names[names.length - 1] : '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const avatarColors = [
      '#d1fae5', // emerald-100
      '#fef3c7', // amber-100
      '#ffe4e6', // rose-100
      '#e0e7ff', // indigo-100
      '#ccfbf1', // teal-100
    ];
    const textColors = [
      '#047857', // emerald-700
      '#b45309', // amber-700
      '#be123c', // rose-700
      '#4338ca', // indigo-700
      '#0f766e', // teal-700
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % avatarColors.length;
    return { bg: avatarColors[index], text: textColors[index] };
  };

  const colorStyle = getAvatarColor(item.name || '');
  const shouldShowImage = item.imageAvailable && item.image && !imageError;

  return (
    <TouchableOpacity
      onPress={onSelect}
      className="items-center p-2 w-full"
      style={{ height: ITEM_HEIGHT }}
      activeOpacity={0.7}
    >
      <View className="relative">
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: isSelected ? colors.primary : colorStyle.bg,
            borderWidth: isSelected ? 4 : 0,
            borderColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}
        >
          {/* Always render initials as the base layer */}
          <View className="absolute inset-0 justify-center items-center w-full h-full">
            <Text
              style={{
                fontSize: 24,
                fontWeight: '600',
                color: isSelected ? 'white' : colorStyle.text
              }}
            >
              {getInitials(item.name)}
            </Text>
          </View>

          {/* Render image on top if available. It will cover initials when loaded. */}
          {shouldShowImage && (
            <CachedImage
              source={{ uri: normalizeContactImageUri(item.image?.uri || '') }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              onError={() => setImageError(true)}
            />
          )}
        </View>

        {isSelected && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="absolute -top-1 -right-1 rounded-full p-1"
            style={{ backgroundColor: colors.primary }}
          >
            <CheckCircle2 color="white" size={20} strokeWidth={3} />
          </Animated.View>
        )}
      </View>

      <Text
        style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: '500',
          color: colors.foreground
        }}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
});

export function ContactPickerGrid({
  maxSelection,
  onSelectionChange,
  onAddManually,
  title = "Who's in your Inner Circle?",
  subtitle = "Select up to 3 people you trust the most.",
  hideHeader = false,
  showAddManually = true,
  selectedIds: propSelectedIds,
  externalSearchQuery,
}: ContactPickerGridProps) {
  const { colors, isDarkMode } = useTheme();
  const [allContacts, setAllContacts] = useState<Contacts.Contact[]>([]);
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  // Use effective search query (external has priority if passed, but usually intended for when header is hidden)
  // If externalSearchQuery is strictly undefined, use internal. If it is a string (even empty), use it.
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;

  // Use either controlled or internal state
  const selectedContactIds = propSelectedIds || internalSelectedIds;

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
        // Filter out contacts without names or "Unknown"
        const validContacts = data.filter(c => {
          const name = c.name?.trim();
          return name && name.toLowerCase() !== 'unknown' && name.toLowerCase() !== 'null';
        });

        const sorted = validContacts.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        setAllContacts(sorted);
      }

      setLoading(false);
    })();
  }, []);

  // Only call onSelectionChange when internal state changes (if not controlled)
  useEffect(() => {
    if (!propSelectedIds) {
      const selected = allContacts.filter(c => c.id && internalSelectedIds.includes(c.id));
      onSelectionChange(selected);
    }
  }, [internalSelectedIds, allContacts, onSelectionChange, propSelectedIds]);

  // If controlled, we might need to notify parent when we *would* change selection
  // But usually onSelectionChange is the callback for *actions*

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return allContacts;
    return allContacts.filter(c =>
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allContacts, searchQuery]);

  const handleSelectContact = useCallback((contactId: string) => {
    // If controlled, we just calculate the new selection and call the callback
    // If uncontrolled, we update local state

    let newSelection: string[];
    const currentSelection = propSelectedIds || internalSelectedIds;

    if (currentSelection.includes(contactId)) {
      newSelection = currentSelection.filter(id => id !== contactId);
    } else {
      if (maxSelection === 1) {
        newSelection = [contactId];
      } else if (currentSelection.length < maxSelection) {
        newSelection = [...currentSelection, contactId];
      } else {
        newSelection = currentSelection; // Max reached
      }
    }

    if (!propSelectedIds) {
      setInternalSelectedIds(newSelection);
    } else {
      // If controlled, we find the contact objects and pass them up
      // The parent is responsible for updating the `selectedIds` prop
      const selectedContacts = allContacts.filter(c => c.id && newSelection.includes(c.id));
      onSelectionChange(selectedContacts);
    }
  }, [propSelectedIds, internalSelectedIds, maxSelection, allContacts, onSelectionChange]);

  const handleAddManually = () => {
    onAddManually?.();
  };

  const renderItem = useCallback(({ item }: { item: Contacts.Contact }) => (
    <ContactItem
      item={item}
      isSelected={!!item.id && selectedContactIds.includes(item.id)}
      onSelect={() => item.id && handleSelectContact(item.id)}
      colors={colors}
    />
  ), [selectedContactIds, handleSelectContact, colors]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-20">
        <WeaveLoading size={48} color={colors.primary} />
        <Text style={{ color: colors['muted-foreground'], marginTop: 16 }}>Loading your contacts...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View className="flex-1 justify-center items-center py-20 px-6">
        <Users size={48} color={colors['muted-foreground']} />
        <Text style={{ fontSize: 20, fontWeight: '600', color: colors.foreground, marginTop: 16, textAlign: 'center' }}>
          Contacts Access Needed
        </Text>
        <Text style={{ fontSize: 16, color: colors['muted-foreground'], marginTop: 8, textAlign: 'center' }}>
          Weave needs access to your contacts to help you select your friends.
          Please enable it in Settings.
        </Text>
      </View>
    );
  }

  return (
    <Animated.View className="flex-1" entering={FadeIn.duration(300)}>
      {!hideHeader && (
        <View style={{ paddingTop: 16, paddingBottom: 16, paddingHorizontal: 24, backgroundColor: colors.background, zIndex: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: colors.foreground, marginBottom: 4 }}>{title}</Text>
          <Text style={{ fontSize: 16, color: colors['muted-foreground'], textAlign: 'center', marginBottom: 16 }}>{subtitle}</Text>

          {/* Search Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Search size={20} color={colors['muted-foreground']} />
            <TextInput
              style={{ flex: 1, marginLeft: 12, fontSize: 16, color: colors.foreground, paddingVertical: 4 }}
              placeholder="Search contacts..."
              placeholderTextColor={colors['muted-foreground']}
              value={searchQuery}
              onChangeText={setInternalSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setInternalSearchQuery('')}>
                <X size={18} color={colors['muted-foreground']} />
              </TouchableOpacity>
            )}
          </View>

          {showAddManually && (
            <TouchableOpacity onPress={handleAddManually} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted }}>
              <Plus size={16} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: '500', marginLeft: 8 }}>Add Manually</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Embedded Search (if header hidden but we still want search? Or assume parent handles it?)
          For now, if header is hidden, we assume parent handles search or we don't have it?
          Wait, ContactPickerGrid usually encapsulates search.
          If I hide header, I might still want search.
          Let's make search part of the list header if hideHeader is true?
          Or just expose a prop to enforce search visibility.
          Actually, for batch-add, we want the search to be sticky at top.
          Let's assume if hideHeader is true, the parent creates the UI around it, including search.
          BUT ContactPickerGrid manages the filtering.
          So we need to expose `setSearchQuery` or accept `searchQuery` as prop if we want parent to control it.
          Let's stick to the current plan: simple refactor.
          If hideHeader is true, we probably still want the search bar?
          The original batch-add had search bar.
          Let's add a `searchable` prop?
          Actually, let's keep it simple: If hideHeader is true, we ONLY render the list.
          But then how do we search?
          The `batch-add` screen has a search bar. It needs to pass the query down.
          So let's add `searchQuery` prop (optional).
      */}

      {!hideHeader && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary + '10', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.primary + '20' }}>
          <Text style={{ fontSize: 14, color: colors.primary, textAlign: 'center', fontWeight: '500' }}>
            {selectedContactIds.length} / {maxSelection > 100 ? '∞' : maxSelection} selected
          </Text>
        </View>
      )}

      {/* If header is hidden, we expect the parent might want to inject a search bar,
          but passing query down is cleaner.
          Let's just duplicate the search bar inside the list header if hideHeader is false.
          Wait, I'll update the component to accept an optional `externalSearchQuery` prop.
      */}

      {filteredContacts.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 px-6">
          <Users size={48} color={colors['muted-foreground']} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: colors.foreground, marginTop: 16, textAlign: 'center' }}>
            {searchQuery ? 'No matching contacts' : 'No Contacts Found'}
          </Text>
          <Text style={{ fontSize: 16, color: colors['muted-foreground'], marginTop: 8, textAlign: 'center' }}>
            {searchQuery ? 'Try a different search term.' : 'Add some contacts to your device first.'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredContacts}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item, index) => item.id || `contact-${index}-${item.name}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 90, paddingTop: 10 }}
          estimatedItemSize={ITEM_HEIGHT}
          extraData={selectedContactIds}
        />
      )}
    </Animated.View>
  );
}