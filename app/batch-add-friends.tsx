import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet, FlatList, Image, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { ArrowLeft, Check, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { normalizeContactImageUri, batchAddFriends } from '@/modules/relationships';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { DuplicateResolverModal } from '@/components/DuplicateResolverModal';

export default function BatchAddFriends() {
  const router = useRouter();
  const { tier } = useLocalSearchParams<{ tier: 'inner' | 'close' | 'community' }>();
  const { colors } = useTheme();

  const [selectedContacts, setSelectedContacts] = useState<Contacts.Contact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResolver, setShowResolver] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const processBatchAdd = async (contactsToAdd: Array<{ name: string; photoUrl: string; contactId?: string }>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      // Convert tier to proper format
      const tierMap = {
        inner: 'InnerCircle',
        close: 'CloseFriends',
        community: 'Community',
      };
      const dbTier = tierMap[tier as 'inner' | 'close' | 'community'] || 'CloseFriends';

      // Use the service function to add friends (handles all defaults correctly)
      await batchAddFriends(
        contactsToAdd.map(c => ({ name: c.name, photoUrl: c.photoUrl })),
        dbTier
      );

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Error batch adding friends:', error);
      setIsSubmitting(false);
    }
  };

  const handleResolveConflicts = (resolutions: Array<{ contactId: string; newName: string; skipped: boolean }>) => {
    setShowResolver(false);

    const finalContacts: Array<{ name: string; photoUrl: string; contactId?: string }> = [];

    // Process all selected contacts
    selectedContacts.forEach(contact => {
      const resolution = resolutions.find(r => r.contactId === contact.id);

      // If this contact had a resolution
      if (resolution) {
        if (!resolution.skipped) {
          finalContacts.push({
            name: resolution.newName || 'Unknown', // Use the new resolved name
            photoUrl: (contact.imageAvailable && contact.image ? normalizeContactImageUri(contact.image.uri) : '') || '',
            contactId: contact.id,
          });
        }
      } else {
        // No resolution needed (wasn't a conflict), add as is
        // BUT wait, we need to make sure we don't add duplicates that WEREN'T resolved because they were the "first" occurrence
        // Actually, my checkConflicts logic below flags subsequent duplicates.
        // If I have "Alex" (existing) and I select "Alex" (new), that's a conflict.

        // However, if I select "Alex" (id: 1) and "Alex" (id: 2).
        // My check logic will flag one of them.

        // Let's refine the logic: checkConflicts returns a list of contacts that HAVE issues.
        // Contacts NOT in that list are safe to add AS IS.

        const isConflict = conflicts.some(c => c.contact.id === contact.id);
        if (!isConflict) {
          finalContacts.push({
            name: contact.name || 'Unknown',
            photoUrl: (contact.imageAvailable && contact.image ? normalizeContactImageUri(contact.image.uri) : '') || '',
            contactId: contact.id,
          });
        }
      }
    });

    if (finalContacts.length > 0) {
      processBatchAdd(finalContacts);
    }
  };

  const handleSubmit = async () => {
    if (selectedContacts.length === 0) return;

    // 1. Check for conflicts
    const existingFriends = await database.get<FriendModel>('friends').query().fetch();
    const existingNames = new Set(existingFriends.map(f => (f.name || '').toLowerCase().trim()));

    const newConflicts: any[] = [];
    const seenNamesInBatch = new Set<string>(); // Track names in this batch to detect internal duplicates

    for (const contact of selectedContacts) {
      const name = (contact.name || 'Unknown').trim();
      const lowerName = name.toLowerCase();

      let type: 'existing_friend' | 'batch_duplicate' | null = null;
      let suggestedName = name;

      if (existingNames.has(lowerName)) {
        type = 'existing_friend';
        suggestedName = `${name} 2`; // Simple suggestion
      } else if (seenNamesInBatch.has(lowerName)) {
        type = 'batch_duplicate';
        suggestedName = `${name} ${seenNamesInBatch.size + 1}`; // e.g. Alex 2
      } else {
        seenNamesInBatch.add(lowerName);
      }

      if (type) {
        newConflicts.push({
          contact,
          type,
          originalName: name,
          suggestedName,
        });
      }
    }

    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      setShowResolver(true);
    } else {
      // No conflicts, proceed immediately
      const contactsToAdd = selectedContacts.map(c => ({
        name: c.name || 'Unknown',
        photoUrl: (c.imageAvailable && c.image ? normalizeContactImageUri(c.image.uri) : '') || '',
        contactId: c.id,
      }));
      processBatchAdd(contactsToAdd);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          }
        }} style={styles.backButton}>
          <ArrowLeft color={colors.foreground} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: colors.foreground }]}>Batch Add Friends</Text>
          <Text style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
            Select contacts to add to {tier === 'inner' ? 'Inner Circle' : tier === 'close' ? 'Close Friends' : 'Community'}
          </Text>
        </View>
      </View>

      {/* Contact Picker */}
      <View style={styles.content}>
        <BatchContactPicker
          onSelectionChange={setSelectedContacts}
          selectedCount={selectedContacts.length}
        />
      </View>

      {/* Submit Button */}
      {selectedContacts.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors['primary-foreground']} />
            ) : (
              <>
                <Check color={colors['primary-foreground']} size={20} />
                <Text style={[styles.submitText, { color: colors['primary-foreground'] }]}>
                  Add {selectedContacts.length} Friend{selectedContacts.length !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.footerNote, { color: colors['muted-foreground'] }]}>
            Friends will be added with Unknown archetype. You can assign archetypes later.
          </Text>
        </View>
      )}
      <DuplicateResolverModal
        isVisible={showResolver}
        conflicts={conflicts}
        onResolve={handleResolveConflicts}
        onCancel={() => setShowResolver(false)}
      />
    </SafeAreaView>
  );
}

// Batch-specific contact picker (no max limit)
// We create a custom wrapper to hide the ContactPickerGrid's header
// since we have our own header in the parent component
const ITEM_HEIGHT = 160;

function BatchContactPicker({
  onSelectionChange,
}: {
  onSelectionChange: (contacts: Contacts.Contact[]) => void;
  selectedCount: number;
}) {
  const { colors, isDarkMode } = useTheme();
  const [contacts, setContacts] = React.useState<Contacts.Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [permissionDenied, setPermissionDenied] = React.useState(false);
  const [imageError, setImageError] = React.useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    (async () => {
      // Check if already granted first
      let { status } = await Contacts.getPermissionsAsync();

      // Only request if not already granted
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
        setContacts(sorted);
      }

      setLoading(false);
    })();
  }, []);

  React.useEffect(() => {
    const selected = contacts.filter(c => c.id && selectedContactIds.includes(c.id));
    onSelectionChange(selected);
  }, [selectedContactIds, contacts, onSelectionChange]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactIds(prevSelectedIds => {
      if (prevSelectedIds.includes(contactId)) {
        return prevSelectedIds.filter(id => id !== contactId);
      } else {
        return [...prevSelectedIds, contactId];
      }
    });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    const firstName = names[0] || '';
    const lastName = names.length > 1 ? names[names.length - 1] : '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#6366f1',
      '#14b8a6',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Filter contacts based on search query
  const filteredContacts = React.useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(contact =>
      (contact.name || '').toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Memoize renderItem to prevent unnecessary re-renders
  const renderItem = React.useCallback(({ item, index }: { item: Contacts.Contact, index: number }) => {
    const isSelected = item.id ? selectedContactIds.includes(item.id) : false;
    const avatarColor = getAvatarColor(item.name || '');

    return (
      <TouchableOpacity
        onPress={() => item.id && handleSelectContact(item.id)}
        style={{
          alignItems: 'center',
          padding: 12,
          width: '33.33%',
          height: ITEM_HEIGHT
        }}
        activeOpacity={0.7}
      >
        <View style={{ position: 'relative' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: isSelected ? '#10b981' : avatarColor,
              borderWidth: isSelected ? 4 : 0,
              borderColor: '#10b981',
            }}
          >
            {item.imageAvailable && item.image && item.id && !imageError[item.id] ? (
              <Image
                source={{ uri: normalizeContactImageUri(item.image.uri) }}
                style={{ width: '100%', height: '100%', borderRadius: 40 }}
                resizeMode="cover"
                onError={() => item.id && setImageError(prev => ({ ...prev, [item.id as string]: true }))}
              />
            ) : (
              <Text style={{ fontSize: 24, fontWeight: '600', color: 'white' }}>
                {getInitials(item.name || '')}
              </Text>
            )}
          </View>
          {isSelected && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: '#10b981',
                borderRadius: 10,
                padding: 4,
              }}
            >
              <Check color="white" size={16} strokeWidth={3} />
            </View>
          )}
        </View>

        <Text
          style={{
            marginTop: 8,
            textAlign: 'center',
            fontSize: 14,
            color: '#374151',
            fontWeight: '500',
            height: 48, // Fixed height for 2 lines of text
            lineHeight: 20 // Ensure consistent line height
          }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item.name || 'Unknown'}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedContactIds, imageError, selectedContactIds.length]); // Added dependencies

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ color: '#6b7280', marginTop: 16 }}>Loading your contacts...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 48 }}>📇</Text>
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' }}>
          Contacts Access Needed
        </Text>
        <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
          Weave needs access to your contacts for batch importing. Please enable it in Settings.
        </Text>
      </View>
    );
  }

  if (contacts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 48 }}>📇</Text>
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' }}>
          No Contacts Found
        </Text>
        <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
          Add some contacts to your device first.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Search Bar */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Search color={colors['muted-foreground']} size={20} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contacts..."
            placeholderTextColor={colors['muted-foreground']}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 16,
              color: colors.foreground,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: colors['muted-foreground'], fontSize: 14, fontWeight: '500' }}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Contacts Grid */}
      <FlatList
        data={filteredContacts}
        numColumns={3}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={renderItem}
        getItemLayout={(data, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * Math.floor(index / 3),
          index,
        })}
        contentContainerStyle={{ paddingBottom: 90, paddingTop: 10 }}
        removeClippedSubviews={true}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
            <Search size={48} color={colors['muted-foreground']} />
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginTop: 16, textAlign: 'center' }}>
              No contacts found
            </Text>
            <Text style={{ fontSize: 14, color: colors['muted-foreground'], marginTop: 8, textAlign: 'center' }}>
              Try a different search term
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
