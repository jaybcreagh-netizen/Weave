import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, StyleSheet, Modal, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { ArrowLeft, Camera, X, Users, AlertCircle, RotateCw, Handshake, Heart, Briefcase, Home, GraduationCap, Palette, type LucideIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import { type Archetype, type FriendFormData, type Tier, type RelationshipType } from '@/shared/types/legacy-types';
import { ArchetypeCard } from '@/modules/intelligence';
import { ArchetypeDetailModal } from '@/modules/intelligence';
import { ContactPickerGrid } from '@/shared/components/onboarding/ContactPickerGrid';
import { MonthDayPicker } from '@/shared/components/MonthDayPicker';
import { getTierCapacity, getTierDisplayName, isTierAtCapacity } from '@/shared/constants/constants';
import { normalizeContactImageUri } from '../utils/image.utils';
import { SimpleTutorialTooltip } from '@/shared/components/SimpleTutorialTooltip';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { validateMMDDFormat } from '@/shared/utils/validation-helpers';
import { processAndStoreImage, getRelativePath, resolveImageUri, rotateImage } from '../services/image.service';

interface FriendFormProps {
  onSave: (friendData: FriendFormData) => void;
  friend?: FriendModel;
  initialTier?: 'inner' | 'close' | 'community';
  fromOnboarding?: boolean;
  onSkip?: () => void;
}


export function FriendForm({ onSave, friend, initialTier, fromOnboarding, onSkip }: FriendFormProps) {
  const router = useRouter();
  const { colors } = useTheme(); // Use the hook

  // Tutorial state - simple approach
  const hasAddedFirstFriend = useTutorialStore((state) => state.hasAddedFirstFriend);
  const markFirstFriendAdded = useTutorialStore((state) => state.markFirstFriendAdded);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);

  // Tutorial handlers
  const showTutorial = fromOnboarding && !hasAddedFirstFriend && !friend;

  const handleTutorialNext = useCallback(() => {
    if (currentTutorialStep < 1) {
      setCurrentTutorialStep(prev => prev + 1);
    } else {
      // Tutorial complete
      setCurrentTutorialStep(-1);
    }
  }, [currentTutorialStep]);

  const handleTutorialSkip = useCallback(async () => {
    await markFirstFriendAdded();
    setCurrentTutorialStep(-1);
  }, [markFirstFriendAdded]);

  // Helper function to map DB tier to form tier
  const getFormTier = (dbTier?: Tier | string) => {
    if (dbTier === 'InnerCircle') return 'inner';
    if (dbTier === 'CloseFriends') return 'close';
    if (dbTier === 'Community') return 'community';
    return 'close'; // Default
  };

  const [formData, setFormData] = useState<FriendFormData>({
    name: friend?.name || "",
    tier: friend ? getFormTier(friend.dunbarTier) : initialTier || 'inner',
    archetype: (friend?.archetype as Archetype) || "Emperor",
    notes: friend?.notes || "",
    photoUrl: friend?.photoUrl || "",
    birthday: friend?.birthday,
    anniversary: friend?.anniversary,
    relationshipType: friend?.relationshipType as RelationshipType | undefined,
  });

  // Resolve initial photo URL if it's a relative path
  useEffect(() => {
    if (friend?.photoUrl) {
      resolveImageUri(friend.photoUrl).then(resolvedUri => {
        if (resolvedUri !== friend.photoUrl) {
          setFormData(prev => ({ ...prev, photoUrl: resolvedUri }));
        }
      });
    }
  }, [friend?.photoUrl]);

  const [imageError, setImageError] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showCapacityWarning, setShowCapacityWarning] = useState(false);

  // State for tier counts
  const [tierCounts, setTierCounts] = useState({ inner: 0, close: 0, community: 0 });
  const [allFriendNames, setAllFriendNames] = useState<string[]>([]);

  // Fetch friend data for validation/capacity
  useEffect(() => {
    const fetchFriendData = async () => {
      try {
        const friends = await database.get<FriendModel>('friends').query().fetch();

        const counts = { inner: 0, close: 0, community: 0 };
        const names: string[] = [];

        friends.forEach(f => {
          if (f.isDormant) return;

          // Add to names list for duplicate check (excluding current friend)
          if (!friend || f.id !== friend.id) {
            names.push(f.name);
          }

          // Skip counting the current friend for capacity if we are editing them
          // But we DO want to know the *other* friends in the tier to see if there's room
          if (friend && f.id === friend.id) return;

          const tier = getFormTier(f.dunbarTier);
          counts[tier as keyof typeof counts]++;
        });

        setTierCounts(counts);
        setAllFriendNames(names);
      } catch (e) {
        console.error("Error fetching friend data for form:", e);
      }
    };

    fetchFriendData();
  }, [friend]);

  // Reset image error when friend changes or photoUrl updates
  useEffect(() => {
    setImageError(false);
  }, [friend?.id, formData.photoUrl]);

  // Validation helper functions
  const validateBirthdayFormat = (birthday?: string): boolean => {
    if (!birthday) return true; // Birthday is optional
    return validateMMDDFormat(birthday);
  };

  const validateAnniversaryFormat = (anniversary?: string): boolean => {
    if (!anniversary) return true; // Anniversary is optional
    return validateMMDDFormat(anniversary);
  };

  const checkDuplicateName = (name: string): boolean => {
    if (!name.trim()) return false;
    // Check if name already exists (case-insensitive) using the fetched names list
    const isDuplicate = allFriendNames.some(existingName =>
      existingName.toLowerCase() === name.trim().toLowerCase()
    );
    return isDuplicate;
  };

  const proceedWithSave = async () => {
    setShowCapacityWarning(false);

    // Convert absolute path to relative path before saving
    const dataToSave = {
      ...formData,
      photoUrl: getRelativePath(formData.photoUrl)
    };

    onSave(dataToSave);

    // Mark first friend added if this is from onboarding
    if (showTutorial && !friend) {
      await markFirstFriendAdded();
    }

    // Navigation is now handled by the parent component via onSave
    // if (router.canGoBack()) {
    //   router.back();
    // } else {
    //   router.replace('/(tabs)');
    // }
  };

  const handleSave = useDebounceCallback(() => {
    // 1. Validate name
    if (!formData.name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your friend.');
      return;
    }

    // 2. Check for duplicate names
    if (checkDuplicateName(formData.name)) {
      Alert.alert(
        'Duplicate Name',
        `You already have a friend named "${formData.name}". Please use a different name or nickname.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // 3. Validate birthday format (should always be valid from MonthDayPicker)
    if (formData.birthday && !validateBirthdayFormat(formData.birthday)) {
      Alert.alert(
        'Invalid Birthday',
        'Please select a valid birthday using the date picker.',
        [{ text: 'OK' }]
      );
      return;
    }

    // 4. Validate anniversary format (should always be valid from MonthDayPicker)
    if (formData.anniversary && !validateAnniversaryFormat(formData.anniversary)) {
      Alert.alert(
        'Invalid Anniversary',
        'Please select a valid anniversary using the date picker.',
        [{ text: 'OK' }]
      );
      return;
    }

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
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8, // Reduced from 1 for better performance
    });

    if (!result.canceled) {
      setImageProcessing(true);

      try {
        // Generate a temporary ID for new friends, or use existing friend ID
        const imageId = friend?.id || `temp_${Date.now()}`;

        // Process and store the image using ImageService
        const imageResult = await processAndStoreImage({
          uri: result.assets[0].uri,
          type: 'profilePicture',
          imageId,
          // userId will be populated when accounts are enabled
          // For now it's undefined and only local storage is used
        });

        if (imageResult.success) {
          // Store the persistent local URI (not the temporary picker URI)
          setFormData({ ...formData, photoUrl: imageResult.localUri });
          setImageError(false);

        } else {
          console.error('[FriendForm] Image processing failed:', imageResult.error);
          Alert.alert(
            'Image Processing Failed',
            'Could not save the image. Please try again.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('[FriendForm] Error processing image:', error);
        Alert.alert(
          'Image Processing Failed',
          'Could not save the image. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setImageProcessing(false);
      }
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photoUrl: "" });
  };

  const handleRotate = async () => {
    if (!formData.photoUrl || imageProcessing) return;

    setImageProcessing(true);
    try {
      const resolvedUri = await resolveImageUri(formData.photoUrl);
      const imageId = friend?.id || `temp_${Date.now()}`;

      const result = await rotateImage(resolvedUri, 'profilePicture', imageId);

      if (result.success) {
        setFormData(prev => ({ ...prev, photoUrl: result.localUri }));
        setImageError(false);
      } else {
        console.error('[FriendForm] Rotation failed:', result.error);
        Alert.alert('Rotation Failed', 'Could not rotate the image. Please try again.');
      }
    } catch (error) {
      console.error('[FriendForm] Error rotating image:', error);
      Alert.alert('Error', 'An unexpected error occurred while rotating the image.');
    } finally {
      setImageProcessing(false);
    }
  };

  const handleContactSelection = useCallback(async (selectedContacts: Contacts.Contact[]) => {
    if (selectedContacts.length > 0) {
      // 1. Close modal immediately to prevent stuck state
      setShowContactPicker(false);

      const contact = selectedContacts[0];
      const contactName = contact.name || '';
      let contactPhotoUrl = '';

      // Process contact photo if available
      if (contact.imageAvailable && contact.image) {
        setImageProcessing(true);

        try {
          const normalizedUri = normalizeContactImageUri(contact.image.uri || '');
          const imageId = friend?.id || `temp_${Date.now()}`;

          if (normalizedUri) {
            const imageResult = await processAndStoreImage({
              uri: normalizedUri,
              type: 'profilePicture',
              imageId,
            });

            if (imageResult.success) {
              contactPhotoUrl = imageResult.localUri;

            }
          }
        } catch (error) {
          console.error('[FriendForm] Error processing contact photo:', error);
        } finally {
          setImageProcessing(false);
        }
      }

      setFormData(prev => ({
        ...prev,
        name: contactName,
        photoUrl: contactPhotoUrl
      }));
      // setShowContactPicker(false); // Moved to top
    }
  }, [friend?.id]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        {fromOnboarding ? (
          <TouchableOpacity onPress={onSkip} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors['muted-foreground'] }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors['muted-foreground']} />
            <Text style={[styles.backButtonText, { color: colors['muted-foreground'] }]}>Back</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {friend ? "Edit Friend" : "Add Friend"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={{ gap: 24 }}>
          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Portrait</Text>
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity onPress={pickImage} disabled={imageProcessing}>
                <View style={[styles.avatarContainer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  {imageProcessing ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                  ) : formData.photoUrl && !imageError ? (
                    <Image
                      source={{ uri: normalizeContactImageUri(formData.photoUrl) }}
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
                <>
                  <TouchableOpacity onPress={removePhoto} style={styles.removeImageButton}>
                    <X size={12} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRotate}
                    style={[styles.rotateImageButton, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    disabled={imageProcessing}
                  >
                    <RotateCw size={14} color={colors.foreground} />
                  </TouchableOpacity>
                </>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={imageProcessing}
                  style={[styles.addPhotoButton, { borderColor: colors.border, opacity: imageProcessing ? 0.5 : 1 }]}
                >
                  <Text style={{ color: colors.foreground }}>
                    {imageProcessing ? "Processing..." : formData.photoUrl ? "Change Photo" : "Add Photo"}
                  </Text>
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
              {([
                { id: "friend", label: "Friend", Icon: Handshake },
                { id: "family", label: "Family", Icon: Users },
                { id: "partner", label: "Partner", Icon: Heart },
                { id: "colleague", label: "Colleague", Icon: Briefcase },
                { id: "neighbor", label: "Neighbor", Icon: Home },
                { id: "mentor", label: "Mentor", Icon: GraduationCap },
                { id: "creative", label: "Creative", Icon: Palette }
              ] as Array<{ id: string; label: string; Icon: LucideIcon }>).map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setFormData({ ...formData, relationshipType: type.id as RelationshipType })}
                  style={[
                    styles.relationshipTypeButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    formData.relationshipType === type.id && [styles.relationshipTypeButtonSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <type.Icon size={16} color={formData.relationshipType === type.id ? colors.primary : colors.foreground} />
                    <Text style={[
                      styles.relationshipTypeButtonText,
                      { color: colors.foreground },
                      formData.relationshipType === type.id && { color: colors.primary }
                    ]}>{type.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Birthday (Optional)</Text>
            <MonthDayPicker
              value={formData.birthday}
              onChange={(birthday) => setFormData({ ...formData, birthday })}
              label="Set birthday"
            />
          </View>

          {/* Only show anniversary field for partners */}
          {formData.relationshipType === 'partner' && (
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Anniversary (Optional)</Text>
              <Text style={[styles.helperText, { color: colors['muted-foreground'] }]}>Romantic relationship anniversary</Text>
              <MonthDayPicker
                value={formData.anniversary}
                onChange={(anniversary) => setFormData({ ...formData, anniversary })}
                label="Set anniversary"
              />
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

          {/* Debug: Reset Score Feature */}
          {friend && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Reset Score',
                  'Are you sure you want to reset this friend\'s score to 50?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await database.write(async () => {
                            await friend.update(f => {
                              f.weaveScore = 50;
                            });
                          });
                          Alert.alert('Success', 'Score reset to 50.');
                        } catch (error) {
                          console.error('Failed to reset score:', error);
                          Alert.alert('Error', 'Failed to reset score.');
                        }
                      }
                    }
                  ]
                );
              }}
              style={{
                marginTop: 8,
                marginBottom: 8,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.destructive,
                borderRadius: 12,
                backgroundColor: 'transparent',
              }}
            >
              <Text style={{ color: colors.destructive, fontSize: 16, fontWeight: '500' }}>Reset Score to 50</Text>
            </TouchableOpacity>
          )}

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
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ContactPickerGrid
            maxSelection={1}
            onSelectionChange={handleContactSelection}
            title="Select a Contact"
            subtitle="Choose a friend to import their details."
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

      {/* Tutorial Tooltip */}
      {showTutorial && currentTutorialStep === 0 && (
        <SimpleTutorialTooltip
          visible={true}
          title="Choose their circle"
          description="Inner circles are your closest bonds (up to 5). Close friends are important relationships (up to 15). Community holds enriching connections (up to 50)."
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
          currentStep={0}
          totalSteps={2}
        />
      )}

      {showTutorial && currentTutorialStep === 1 && (
        <SimpleTutorialTooltip
          visible={true}
          title="Discover their archetype"
          description="Each friend has a unique way of connecting. Tap to choose, or press and hold any archetype to learn more about their patterns."
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
          currentStep={1}
          totalSteps={2}
        />
      )}
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
  rotateImageButton: {
    position: 'absolute',
    bottom: -8,
    left: 68,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
