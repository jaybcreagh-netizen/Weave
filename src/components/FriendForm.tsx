import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, StyleSheet, Modal } from 'react-native';
import { ArrowLeft, Camera, X, Calendar, Heart, Users, AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useFriends } from '../hooks/useFriends';
import FriendModel from '../db/models/Friend';
import { type Archetype, type FriendFormData, type Tier, type RelationshipType } from './types';
import { ArchetypeCard } from './archetype-card';
import { ArchetypeDetailModal } from './ArchetypeDetailModal';
import { ContactPickerGrid } from './onboarding/ContactPickerGrid';
import { getTierCapacity, getTierDisplayName, isTierAtCapacity } from '../lib/constants';

interface FriendFormProps {
  onSave: (friendData: FriendFormData) => void;
  friend?: FriendModel;
  initialTier?: 'inner' | 'close' | 'community';
}

export function FriendForm({ onSave, friend, initialTier }: FriendFormProps) {
  const router = useRouter();
  const { colors } = useTheme(); // Use the hook
  const allFriends = useFriends(); // Get all friends to check tier counts

  // Helper function to map DB tier to form tier
  const getFormTier = (dbTier?: Tier | string) => {
    if (dbTier === 'InnerCircle') return 'inner';
    if (dbTier === 'CloseFriends') return 'close';
    if (dbTier === 'Community') return 'community';
    return 'close'; // Default
  };

  const [formData, setFormData] = useState<FriendFormData>({
    name: friend?.name || "",
    tier: friend ? getFormTier(friend.dunbarTier) : initialTier || 'close',
    archetype: friend?.archetype || "Emperor",
    notes: friend?.notes || "",
    photoUrl: friend?.photoUrl || "",
    birthday: friend?.birthday,
    anniversary: friend?.anniversary,
    relationshipType: friend?.relationshipType as RelationshipType | undefined,
  });

  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [showAnniversaryPicker, setShowAnniversaryPicker] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showCapacityWarning, setShowCapacityWarning] = useState(false);

  // Calculate current tier counts
  const tierCounts = useMemo(() => {
    const counts = { inner: 0, close: 0, community: 0 };
    allFriends.forEach(f => {
      if (f.isDormant) return; // Don't count dormant friends
      // Skip the current friend being edited
      if (friend && f.id === friend.id) return;

      const tier = getFormTier(f.dunbarTier);
      counts[tier as keyof typeof counts]++;
    });
    return counts;
  }, [allFriends, friend]);

  // Reset image error when friend changes or photoUrl updates
  useEffect(() => {
    setImageError(false);
  }, [friend?.id, formData.photoUrl]);

  const handleSave = () => {
    if (!formData.name.trim()) return;

    // Check if tier is at capacity (only for new friends or tier changes)
    const selectedTier = formData.tier as 'inner' | 'close' | 'community';
    const isChangingTier = friend && getFormTier(friend.dunbarTier) !== selectedTier;
    const isNewFriend = !friend;

    if ((isNewFriend || isChangingTier) && isTierAtCapacity(tierCounts[selectedTier], selectedTier)) {
      // Show capacity warning modal
      setShowCapacityWarning(true);
      return;
    }

    // Proceed with save
    proceedWithSave();
  };

  const proceedWithSave = () => {
    setShowCapacityWarning(false);
    onSave(formData);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setFormData({ ...formData, photoUrl: result.assets[0].uri });
      setImageError(false); // Reset error state when new image is picked
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photoUrl: "" });
  };

  const handleContactSelection = (selectedContacts: Contacts.Contact[]) => {
    if (selectedContacts.length > 0) {
      const contact = selectedContacts[0];
      const contactName = contact.name || '';
      const contactPhoto = contact.imageAvailable && contact.image ? contact.image.uri : '';

      setFormData({
        ...formData,
        name: contactName,
        photoUrl: contactPhoto
      });
      setShowContactPicker(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={colors['muted-foreground']} />
          <Text style={[styles.backButtonText, { color: colors['muted-foreground'] }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {friend ? "Edit Friend" : "Add Friend"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={{ gap: 24 }}>
          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Portrait</Text>
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity onPress={pickImage}>
                <View style={[styles.avatarContainer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  {formData.photoUrl && !imageError ? (
                    <Image
                      source={{ uri: formData.photoUrl }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <Camera size={24} color={colors['muted-foreground']} />
                  )}
                </View>
              </TouchableOpacity>
              {formData.photoUrl && (
                <TouchableOpacity onPress={removePhoto} style={styles.removeImageButton}>
                  <X size={12} color="white" />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <TouchableOpacity onPress={pickImage} style={[styles.addPhotoButton, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground }}>{formData.photoUrl ? "Change Photo" : "Add Photo"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowContactPicker(true)}
                  style={[styles.importContactsButton, { borderColor: colors.border, backgroundColor: colors.muted }]}
                >
                  <Users size={16} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: 14 }}>Import from Contacts</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Name</Text>
            <TextInput
              value={formData.name}
              onChangeText={(name) => setFormData({ ...formData, name })}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Enter friend's name"
              placeholderTextColor={colors['muted-foreground']}
            />
          </View>

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Connection Tier</Text>
            <View style={styles.tierSelectorContainer}>
              {[
                { id: "inner", label: "Inner" },
                { id: "close", label: "Close" },
                { id: "community", label: "Community" }
              ].map((tier) => (
                <TouchableOpacity
                  key={tier.id}
                  onPress={() => setFormData({ ...formData, tier: tier.id })}
                  style={[
                    styles.tierButton, 
                    { backgroundColor: colors.card, borderColor: colors.border }, 
                    formData.tier === tier.id && [styles.tierButtonSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]
                  ]}
                >
                  <Text style={[
                    styles.tierButtonText, 
                    { color: colors.foreground }, 
                    formData.tier === tier.id && [styles.tierButtonTextSelected, { color: colors.primary }]
                  ]}>{tier.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Archetype</Text>
            <Text style={[styles.helperText, { color: colors['muted-foreground'] }]}>
              Tap to select • Long-press to learn more
            </Text>
            <View style={styles.archetypeGrid}>
              {(['Emperor', 'Empress', 'HighPriestess', 'Fool', 'Sun', 'Hermit', 'Magician', 'Lovers'] as Archetype[]).map((archetype) => (
                <View key={archetype} style={styles.archetypeCardWrapper}>
                  <ArchetypeCard
                    archetype={archetype}
                    isSelected={formData.archetype === archetype}
                    onSelect={(arch) => setFormData({ ...formData, archetype: arch })}
                  />
                </View>
              ))}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Relationship Type (Optional)</Text>
            <View style={styles.relationshipTypeContainer}>
              {[
                { id: "friend", label: "Friend", icon: "🤝" },
                { id: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
                { id: "partner", label: "Partner", icon: "❤️" },
                { id: "colleague", label: "Colleague", icon: "💼" },
                { id: "neighbor", label: "Neighbor", icon: "🏘️" },
                { id: "mentor", label: "Mentor", icon: "🎓" },
                { id: "creative", label: "Creative", icon: "🎨" }
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setFormData({ ...formData, relationshipType: type.id as RelationshipType })}
                  style={[
                    styles.relationshipTypeButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    formData.relationshipType === type.id && [styles.relationshipTypeButtonSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]
                  ]}
                >
                  <Text style={[
                    styles.relationshipTypeButtonText,
                    { color: colors.foreground },
                    formData.relationshipType === type.id && { color: colors.primary }
                  ]}>{type.icon} {type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Birthday (Optional)</Text>
            <TouchableOpacity
              onPress={() => setShowBirthdayPicker(true)}
              style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Calendar size={20} color={colors['muted-foreground']} />
              <Text style={[styles.dateButtonText, { color: formData.birthday ? colors.foreground : colors['muted-foreground'] }]}>
                {formData.birthday ? formData.birthday.toLocaleDateString() : "Set birthday"}
              </Text>
              {formData.birthday && (
                <TouchableOpacity onPress={() => setFormData({ ...formData, birthday: undefined })}>
                  <X size={16} color={colors['muted-foreground']} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {showBirthdayPicker && (
              <DateTimePicker
                value={formData.birthday || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowBirthdayPicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setFormData({ ...formData, birthday: selectedDate });
                  }
                }}
              />
            )}
          </View>

          {/* Only show anniversary field for partners */}
          {formData.relationshipType === 'partner' && (
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Anniversary</Text>
              <Text style={[styles.helperText, { color: colors['muted-foreground'] }]}>Romantic relationship anniversary</Text>
              <TouchableOpacity
                onPress={() => setShowAnniversaryPicker(true)}
                style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Heart size={20} color={colors['muted-foreground']} />
                <Text style={[styles.dateButtonText, { color: formData.anniversary ? colors.foreground : colors['muted-foreground'] }]}>
                  {formData.anniversary ? formData.anniversary.toLocaleDateString() : "Set anniversary"}
                </Text>
                {formData.anniversary && (
                  <TouchableOpacity onPress={() => setFormData({ ...formData, anniversary: undefined })}>
                    <X size={16} color={colors['muted-foreground']} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {showAnniversaryPicker && (
                <DateTimePicker
                  value={formData.anniversary || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowAnniversaryPicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setFormData({ ...formData, anniversary: selectedDate });
                    }
                  }}
                />
              )}
            </View>
          )}

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Notes (Optional)</Text>
            <TextInput
              value={formData.notes}
              onChangeText={(notes) => setFormData({ ...formData, notes })}
              style={[styles.input, { height: 96, paddingTop: 16, backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any special notes about this person..."
              placeholderTextColor={colors['muted-foreground']}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!formData.name.trim()}
            style={[styles.saveButton, { backgroundColor: colors.primary }, !formData.name.trim() && { opacity: 0.5 }]}
          >
            <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>
              {friend ? "Save Changes" : "Add Friend"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Archetype Detail Modal */}
      <ArchetypeDetailModal />

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Import from Contacts</Text>
            <TouchableOpacity onPress={() => setShowContactPicker(false)}>
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>
          <ContactPickerGrid
            maxSelection={1}
            onSelectionChange={handleContactSelection}
          />
        </SafeAreaView>
      </Modal>

      {/* Capacity Warning Modal */}
      <Modal
        visible={showCapacityWarning}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCapacityWarning(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.capacityWarningContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Warning Icon */}
            <View style={[styles.warningIconContainer, { backgroundColor: '#F59E0B20' }]}>
              <AlertCircle size={32} color="#F59E0B" />
            </View>

            {/* Title */}
            <Text style={[styles.warningTitle, { color: colors.foreground }]}>
              {getTierDisplayName(formData.tier)} is at Capacity
            </Text>

            {/* Description */}
            <Text style={[styles.warningDescription, { color: colors['muted-foreground'] }]}>
              Your {getTierDisplayName(formData.tier)} is designed for about {getTierCapacity(formData.tier)} {formData.tier === 'inner' ? 'closest' : formData.tier === 'close' ? 'important' : ''} relationships.
              You currently have {tierCounts[formData.tier as 'inner' | 'close' | 'community']}/{getTierCapacity(formData.tier)}.
            </Text>

            <Text style={[styles.warningDescription, { color: colors['muted-foreground'] }]}>
              {formData.tier === 'inner'
                ? 'Adding more than 5 friends to your Inner Circle may make it harder to maintain these closest bonds. Consider if this friend might fit better in Close Friends, or if another friend should be moved.'
                : formData.tier === 'close'
                ? 'Close Friends is for your most important ongoing relationships. Consider whether some existing friends might fit better in Community, or if this new friend should start there.'
                : 'Community is for meaningful acquaintances and broader connections. You can add more friends here, but remember that quality matters more than quantity.'}
            </Text>

            {/* Action Buttons */}
            <View style={styles.warningButtonContainer}>
              <TouchableOpacity
                onPress={() => setShowCapacityWarning(false)}
                style={[styles.warningButtonSecondary, { borderColor: colors.border, backgroundColor: colors.muted }]}
              >
                <Text style={[styles.warningButtonSecondaryText, { color: colors.foreground }]}>
                  Let me reconsider
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={proceedWithSave}
                style={[styles.warningButtonPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.warningButtonPrimaryText, { color: colors['primary-foreground'] }]}>
                  Proceed anyway
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButtonText: {},
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        fontFamily: 'Lora_700Bold',
    },
    scrollViewContent: {
        padding: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 12,
        fontFamily: 'Lora_400Regular',
    },
    imagePickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    removeImageButton: {
        position: 'absolute',
        top: -8,
        left: 68, // Position at top-right corner of 80px avatar (80 - 12)
        width: 24,
        height: 24,
        backgroundColor: '#ef4444',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPhotoButton: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        height: 56,
        fontSize: 18,
        paddingHorizontal: 16,
    },
    tierSelectorContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    tierButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    tierButtonSelected: {},
    tierButtonText: {
        fontWeight: '500',
    },
    tierButtonTextSelected: {},
    archetypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
    },
    archetypeCardWrapper: {
        width: '48%',
    },
    helperText: {
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
        marginBottom: 8,
    },
    relationshipTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        rowGap: 10,
    },
    relationshipTypeButton: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 24,
        borderWidth: 1.5,
        minWidth: 100,
        alignItems: 'center',
    },
    relationshipTypeButtonSelected: {},
    relationshipTypeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
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
    saveButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: '500',
    },
    importContactsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        fontFamily: 'Lora_700Bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    capacityWarningContainer: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        gap: 16,
    },
    warningIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    warningTitle: {
        fontSize: 22,
        fontWeight: '600',
        fontFamily: 'Lora_700Bold',
        textAlign: 'center',
    },
    warningDescription: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    warningButtonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    warningButtonSecondary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    warningButtonSecondaryText: {
        fontSize: 15,
        fontWeight: '500',
    },
    warningButtonPrimary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    warningButtonPrimaryText: {
        fontSize: 15,
        fontWeight: '600',
    },
});