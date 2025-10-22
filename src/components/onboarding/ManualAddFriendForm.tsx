
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { User, Camera } from 'lucide-react-native';
import { theme } from '../../theme';
import { FriendFormData } from '../types';

interface ManualAddFriendFormProps {
  onComplete: (friendData: FriendFormData) => void;
}

export function ManualAddFriendForm({ onComplete }: ManualAddFriendFormProps) {
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleChoosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (name.trim()) {
      onComplete({
        name: name.trim(),
        photoUrl: photoUri || '',
        tier: 'inner', // Defaulting to inner circle for the first manually added friend
        archetype: 'The Fool', // Placeholder, will be set in the next step
        notes: '',
      });
    }
  };

  return (
    <Animated.View style={styles.container} entering={FadeInUp.duration(600)}>
      <Text style={styles.title}>Add a Friend</Text>
      <Text style={styles.subtitle}>Start by adding one person who matters to you.</Text>

      <TouchableOpacity style={styles.photoContainer} onPress={handleChoosePhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <Camera size={40} color={theme.colors['muted-foreground']} />
        )}
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <User size={20} color={theme.colors['muted-foreground']} />
        <TextInput
          style={styles.input}
          placeholder="Friend's Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor={theme.colors['muted-foreground']}
        />
      </View>

      <TouchableOpacity style={[styles.button, !name.trim() && styles.buttonDisabled]} onPress={handleSubmit} disabled={!name.trim()}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'serif',
    textAlign: 'center',
    color: theme.colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginBottom: 32,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 18,
    marginLeft: 12,
    color: theme.colors.foreground,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
  },
});
