import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, StyleSheet } from 'react-native';
import { ArrowLeft, Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { type Archetype, type Friend } from './types';
import { type FriendFormData } from '../stores/friendStore';
import { ArchetypeCard } from './archetype-card';

interface FriendFormProps {
  onSave: (friendData: FriendFormData) => void;
  friend?: Friend;
}

export function FriendForm({ onSave, friend }: FriendFormProps) {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    name: friend?.name || "",
    tier: friend?.tier === "InnerCircle" ? "inner" : friend?.tier === "CloseFriends" ? "close" : "community",
    archetype: friend?.archetype || "Emperor" as Archetype,
    notes: friend?.notes || "",
    photoUrl: friend?.photoUrl || ""
  });

  const handleSave = () => {
    if (formData.name.trim()) {
      onSave(formData);
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
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photoUrl: "" });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={20} color={theme.colors['muted-foreground']} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {friend ? "Edit Friend" : "Add Friend"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={{ gap: 24 }}>
          <View>
            <Text style={styles.label}>Portrait</Text>
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity onPress={pickImage}>
                <View style={styles.avatarContainer}>
                  {formData.photoUrl ? (
                    <Image source={{ uri: formData.photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <Camera size={24} color={theme.colors['muted-foreground']} />
                  )}
                </View>
              </TouchableOpacity>
              {formData.photoUrl && (
                <TouchableOpacity onPress={removePhoto} style={styles.removeImageButton}>
                  <X size={12} color="white" />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={pickImage} style={styles.addPhotoButton}>
                  <Text>{formData.photoUrl ? "Change Photo" : "Add Photo"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={formData.name}
              onChangeText={(name) => setFormData({ ...formData, name })}
              style={styles.input}
              placeholder="Enter friend's name"
            />
          </View>

          <View>
            <Text style={styles.label}>Connection Tier</Text>
            <View style={styles.tierSelectorContainer}>
              {[
                { id: "inner", label: "Inner" },
                { id: "close", label: "Close" },
                { id: "community", label: "Community" }
              ].map((tier) => (
                <TouchableOpacity
                  key={tier.id}
                  onPress={() => setFormData({ ...formData, tier: tier.id })}
                  style={[styles.tierButton, formData.tier === tier.id && styles.tierButtonSelected]}
                >
                  <Text style={[styles.tierButtonText, formData.tier === tier.id && styles.tierButtonTextSelected]}>{tier.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Archetype</Text>
            <View style={styles.archetypeGrid}>
              {["Emperor", "Empress", "HighPriestess", "Fool", "Sun", "Hermit", "Magician"].map((archetype) => (
                <View key={archetype} style={{ width: '48%' }}>
                    <ArchetypeCard
                        archetype={archetype as Archetype}
                        isSelected={formData.archetype === archetype}
                        onSelect={(selected) => setFormData({ ...formData, archetype: selected })}
                    />
                </View>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              value={formData.notes}
              onChangeText={(notes) => setFormData({ ...formData, notes })}
              style={[styles.input, { height: 96, paddingTop: 16 }]}
              placeholder="Any special notes about this person..."
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!formData.name.trim()}
            style={[styles.saveButton, !formData.name.trim() && { opacity: 0.5 }]}
          >
            <Text style={styles.saveButtonText}>
              {friend ? "Save Changes" : "Add Friend"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButtonText: {
        color: theme.colors['muted-foreground'],
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.colors.foreground,
    },
    scrollViewContent: {
        padding: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 12,
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
        backgroundColor: theme.colors.muted,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: theme.colors.border,
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
        right: 52, // manual adjustment
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
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
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
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
    },
    tierButtonSelected: {
        backgroundColor: 'rgba(181, 138, 108, 0.2)',
        borderColor: theme.colors.primary,
    },
    tierButtonText: {
        fontWeight: '500',
    },
    tierButtonTextSelected: {
        color: theme.colors.primary,
    },
    archetypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    saveButton: {
        width: '100%',
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '500',
    }
});