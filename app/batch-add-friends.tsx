import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { ArrowLeft, Check, Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { normalizeContactImageUri, batchAddFriends } from '@/modules/relationships';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { DuplicateResolverModal } from '@/modules/relationships';
import { ContactPickerGrid } from '@/shared/components/onboarding/ContactPickerGrid';

export default function BatchAddFriends() {
  const router = useRouter();
  const { tier } = useLocalSearchParams<{ tier: 'inner' | 'close' | 'community' }>();
  const { colors, isDarkMode } = useTheme();

  const [selectedContacts, setSelectedContacts] = useState<Contacts.Contact[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResolver, setShowResolver] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedIds = useMemo(() => {
    return selectedContacts.map(c => c.id).filter(Boolean) as string[];
  }, [selectedContacts]);

  const processBatchAdd = async (contactsToAdd: Array<{ name: string; photoUrl: string; contactId?: string; phoneNumber?: string; email?: string }>) => {
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
        contactsToAdd.map(c => ({
          name: c.name,
          photoUrl: c.photoUrl,
          phoneNumber: c.phoneNumber,
          email: c.email
        })),
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

    const finalContacts: Array<{ name: string; photoUrl: string; contactId?: string; phoneNumber?: string; email?: string }> = [];

    // Process all selected contacts
    selectedContacts.forEach(contact => {
      const resolution = resolutions.find(r => r.contactId === contact.id);

      // Extract details
      const phoneNumber = contact.phoneNumbers && contact.phoneNumbers.length > 0 ? contact.phoneNumbers[0].number : undefined;
      const email = contact.emails && contact.emails.length > 0 ? contact.emails[0].email : undefined;

      // If this contact had a resolution
      if (resolution) {
        if (!resolution.skipped) {
          finalContacts.push({
            name: resolution.newName || 'Unknown', // Use the new resolved name
            photoUrl: (contact.imageAvailable && contact.image ? normalizeContactImageUri(contact.image.uri) : '') || '',
            contactId: contact.id,
            phoneNumber,
            email,
          });
        }
      } else {
        // No resolution needed (wasn't a conflict), add as is
        const isConflict = conflicts.some(c => c.contact.id === contact.id);
        if (!isConflict) {
          finalContacts.push({
            name: contact.name || 'Unknown',
            photoUrl: (contact.imageAvailable && contact.image ? normalizeContactImageUri(contact.image.uri) : '') || '',
            contactId: contact.id,
            phoneNumber,
            email,
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
      // No conflicts, proceed immediately
      const contactsToAdd = selectedContacts.map(c => {
        // Extract phone and email
        const phoneNumber = c.phoneNumbers && c.phoneNumbers.length > 0 ? c.phoneNumbers[0].number : undefined;
        const email = c.emails && c.emails.length > 0 ? c.emails[0].email : undefined;

        return {
          name: c.name || 'Unknown',
          photoUrl: (c.imageAvailable && c.image ? normalizeContactImageUri(c.image.uri) : '') || '',
          contactId: c.id,
          phoneNumber,
          email
        };
      });
      processBatchAdd(contactsToAdd);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stick Header + Search */}
      <View style={{ backgroundColor: colors.background, zIndex: 10 }}>
        {/* Navigation Header */}
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
                <X size={18} color={colors['muted-foreground']} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Contact Picker */}
      <View style={styles.content}>
        <ContactPickerGrid
          maxSelection={999} // Unlimited for batch
          onSelectionChange={setSelectedContacts}
          externalSearchQuery={searchQuery}
          hideHeader={true}
          showAddManually={false}
          title="" // Hidden anyway
          subtitle="" // Hidden anyway
          selectedIds={selectedIds}
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
