import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet, FlatList, Image, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { ArrowLeft, Check, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRelationshipsStore } from '@/modules/relationships';
import { useTheme } from '@/hooks/useTheme';
import { normalizeContactImageUri } from '@/lib/image-utils';

export default function BatchAddFriends() {
  const router = useRouter();
  const { tier } = useLocalSearchParams<{ tier: 'inner' | 'close' | 'community' }>();
  const { colors } = useTheme();
  const { batchAddFriends } = useRelationshipsStore();

  const [selectedContacts, setSelectedContacts] = useState<Contacts.Contact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedContacts.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      // Convert tier to proper format
      const tierMap = {
        inner: 'InnerCircle',
        close: 'CloseFriends',
        community: 'Community',
      };

      await batchAddFriends(
        selectedContacts.map(contact => ({
          name: contact.name || 'Unknown',
          photoUrl: contact.imageAvailable && contact.image
            ? normalizeContactImageUri(contact.image.uri)
            : undefined,
        })),
        tierMap[tier as 'inner' | 'close' | 'community'] as 'InnerCircle' | 'CloseFriends' | 'Community'
      );

      if (router.canGoBack()) {
        router.back();
      }
    } catch (error) {
      console.error('Error batch adding friends:', error);
      setIsSubmitting(false);
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
    </SafeAreaView>
  );
}

// Batch-specific contact picker (no max limit)
// We create a custom wrapper to hide the ContactPickerGrid's header
// since we have our own header in the parent component
function BatchContactPicker({
  onSelectionChange,
  selectedCount
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
    const selected = contacts.filter(c => selectedContactIds.includes(c.id));
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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedContactIds.includes(item.id);
          const avatarColor = getAvatarColor(item.name || '');

          return (
            <TouchableOpacity
              onPress={() => handleSelectContact(item.id)}
              style={{ alignItems: 'center', padding: 12, width: '33.33%' }}
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
                  {item.imageAvailable && item.image && !imageError[item.id] ? (
                    <Image
                      source={{ uri: normalizeContactImageUri(item.image.uri) }}
                      style={{ width: '100%', height: '100%', borderRadius: 40 }}
                      resizeMode="cover"
                      onError={() => setImageError(prev => ({ ...prev, [item.id]: true }))}
                    />
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: '600', color: 'white' }}>
                      {getInitials(item.name)}
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
                style={{ marginTop: 8, textAlign: 'center', fontSize: 14, color: '#374151', fontWeight: '500' }}
                numberOfLines={2}
              >
                {item.name || 'Unknown'}
              </Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 90, paddingTop: 10 }}
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
