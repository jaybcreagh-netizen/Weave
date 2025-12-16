import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Modal, Alert, ActivityIndicator } from 'react-native';
import { ArrowLeft, Camera, X, Users, AlertCircle, RotateCw } from 'lucide-react-native';
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
import { useTutorial } from '@/shared/context/TutorialContext';
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
  const { hasAddedFirstFriend, markFirstFriendAdded } = useTutorial();
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row justify-between items-center p-5 border-b" style={{ borderColor: colors.border }}>
        {fromOnboarding ? (
          <TouchableOpacity onPress={onSkip} className="flex-row items-center gap-2">
            <Text style={{ color: colors['muted-foreground'] }}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2">
            <ArrowLeft size={20} color={colors['muted-foreground']} />
            <Text style={{ color: colors['muted-foreground'] }}>Back</Text>
          </TouchableOpacity>
        )}
        <Text className="text-xl font-lora-bold font-semibold" style={{ color: colors.foreground }}>
          {friend ? "Edit Friend" : "Add Friend"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="gap-6">
          <View>
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Portrait</Text>
            <View className="flex-row items-center gap-4">
              <TouchableOpacity onPress={pickImage} disabled={imageProcessing}>
                <View
                  className="w-20 h-20 rounded-full border-2 border-dashed items-center justify-center overflow-hidden"
                  style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                >
                  {imageProcessing ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                  ) : formData.photoUrl && !imageError ? (
                    <Image
                      source={{ uri: normalizeContactImageUri(formData.photoUrl) }}
                      className="w-full h-full"
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
                  <TouchableOpacity onPress={removePhoto} className="absolute -top-2 left-[68px] w-6 h-6 bg-red-500 rounded-full items-center justify-center">
                    <X size={12} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRotate}
                    className="absolute -bottom-2 left-[68px] w-6 h-6 rounded-full border items-center justify-center z-10"
                    style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                    disabled={imageProcessing}
                  >
                    <RotateCw size={14} color={colors.foreground} />
                  </TouchableOpacity>
                </>
              )}
              <View className="flex-1 gap-2">
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={imageProcessing}
                  className="w-full h-12 rounded-xl border items-center justify-center"
                  style={{ borderColor: colors.border, opacity: imageProcessing ? 0.5 : 1 }}
                >
                  <Text style={{ color: colors.foreground }}>
                    {imageProcessing ? "Processing..." : formData.photoUrl ? "Change Photo" : "Add Photo"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowContactPicker(true)}
                  className="flex-row items-center justify-center gap-2 h-10 rounded-xl border"
                  style={{ borderColor: colors.border, backgroundColor: colors.muted }}
                >
                  <Users size={16} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: 14 }}>Import from Contacts</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View>
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Name</Text>
            <TextInput
              value={formData.name}
              onChangeText={(name) => setFormData({ ...formData, name })}
              className="border rounded-xl h-14 text-lg px-4"
              style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }}
              placeholder="Enter friend's name"
              placeholderTextColor={colors['muted-foreground']}
            />
          </View>

          <View>
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Connection Tier</Text>
            <View className="flex-row gap-2">
              {[
                { id: "inner", label: "Inner" },
                { id: "close", label: "Close" },
                { id: "community", label: "Community" }
              ].map((tier) => (
                <TouchableOpacity
                  key={tier.id}
                  onPress={() => setFormData({ ...formData, tier: tier.id })}
                  className="flex-1 p-4 rounded-xl border items-center"
                  style={[
                    { backgroundColor: colors.card, borderColor: colors.border },
                    formData.tier === tier.id && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                  ]}
                >
                  <Text
                    className="font-medium"
                    style={[
                      { color: colors.foreground },
                      formData.tier === tier.id && { color: colors.primary }
                    ]}>{tier.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Archetype</Text>
            <Text className="text-xs leading-[18px] mt-1 mb-2" style={{ color: colors['muted-foreground'] }}>
              Tap to select • Long-press to learn more
            </Text>
            <View className="flex-row flex-wrap gap-3 mt-2">
              {(['Emperor', 'Empress', 'HighPriestess', 'Fool', 'Sun', 'Hermit', 'Magician', 'Lovers'] as Archetype[]).map((archetype) => (
                <View key={archetype} className="w-[48%]">
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
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Relationship Type (Optional)</Text>
            <View className="flex-row flex-wrap gap-2">
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
                  className="py-3 px-4 rounded-full border-2 min-w-[100px] items-center"
                  style={[
                    { backgroundColor: colors.card, borderColor: colors.border },
                    formData.relationshipType === type.id && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                  ]}
                >
                  <Text
                    className="text-sm font-semibold text-center"
                    style={[
                      { color: colors.foreground },
                      formData.relationshipType === type.id && { color: colors.primary }
                    ]}>{type.icon} {type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Birthday (Optional)</Text>
            <MonthDayPicker
              value={formData.birthday}
              onChange={(birthday) => setFormData({ ...formData, birthday })}
              label="Set birthday"
            />
          </View>

          {/* Only show anniversary field for partners */}
          {formData.relationshipType === 'partner' && (
            <View>
              <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Anniversary (Optional)</Text>
              <Text className="text-xs leading-[18px] mt-1 mb-2" style={{ color: colors['muted-foreground'] }}>Romantic relationship anniversary</Text>
              <MonthDayPicker
                value={formData.anniversary}
                onChange={(anniversary) => setFormData({ ...formData, anniversary })}
                label="Set anniversary"
              />
            </View>
          )}

          <View>
            <Text className="text-base mb-3 font-lora-regular" style={{ color: colors.foreground }}>Notes (Optional)</Text>
            <TextInput
              value={formData.notes}
              onChangeText={(notes) => setFormData({ ...formData, notes })}
              className="h-24 pt-4 border rounded-xl px-4 text-lg"
              style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }}
              placeholder="Any special notes about this person..."
              placeholderTextColor={colors['muted-foreground']}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!formData.name.trim()}
            className="w-full py-4 rounded-2xl items-center"
            style={[{ backgroundColor: colors.primary }, !formData.name.trim() && { opacity: 0.5 }]}
          >
            <Text className="text-lg font-medium" style={{ color: colors['primary-foreground'] }}>
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
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
          <View className="flex-row justify-between items-center px-5 py-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Text className="text-lg font-lora-bold font-semibold" style={{ color: colors.foreground }}>Import from Contacts</Text>
            <TouchableOpacity onPress={() => setShowContactPicker(false)}>
              <Text className="text-base font-semibold" style={{ color: colors.primary }}>Done</Text>
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
        <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View className="w-full max-w-[400px] rounded-3xl p-6 border gap-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            {/* Warning Icon */}
            <View className="w-16 h-16 rounded-full items-center justify-center self-center" style={{ backgroundColor: '#F59E0B20' }}>
              <AlertCircle size={32} color="#F59E0B" />
            </View>

            {/* Title */}
            <Text className="text-2xl font-lora-bold font-semibold text-center" style={{ color: colors.foreground }}>
              {getTierDisplayName(formData.tier)} is at Capacity
            </Text>

            {/* Description */}
            <Text className="text-[15px] leading-[22px] text-center" style={{ color: colors['muted-foreground'] }}>
              Your {getTierDisplayName(formData.tier)} is designed for about {getTierCapacity(formData.tier)} {formData.tier === 'inner' ? 'closest' : formData.tier === 'close' ? 'important' : ''} relationships.
              You currently have {tierCounts[formData.tier as 'inner' | 'close' | 'community']}/{getTierCapacity(formData.tier)}.
            </Text>

            <Text className="text-[15px] leading-[22px] text-center" style={{ color: colors['muted-foreground'] }}>
              {formData.tier === 'inner'
                ? 'Adding more than 5 friends to your Inner Circle may make it harder to maintain these closest bonds. Consider if this friend might fit better in Close Friends, or if another friend should be moved.'
                : formData.tier === 'close'
                  ? 'Close Friends is for your most important ongoing relationships. Consider whether some existing friends might fit better in Community, or if this new friend should start there.'
                  : 'Community is for meaningful acquaintances and broader connections. You can add more friends here, but remember that quality matters more than quantity.'}
            </Text>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setShowCapacityWarning(false)}
                className="flex-1 py-3.5 rounded-xl items-center border"
                style={{ borderColor: colors.border, backgroundColor: colors.muted }}
              >
                <Text className="text-[15px] font-medium" style={{ color: colors.foreground }}>
                  Let me reconsider
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={proceedWithSave}
                className="flex-1 py-3.5 rounded-xl items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-[15px] font-semibold" style={{ color: colors['primary-foreground'] }}>
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
