import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { InteractionModal } from '../src/components/InteractionModal';
import { ArchetypeDetailModal } from '../src/components/ArchetypeDetailModal';

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="friend-profile" />
        <Stack.Screen name="add-friend" />
        <Stack.Screen name="edit-friend" />
      </Stack>
      <InteractionModal />
      <ArchetypeDetailModal />
    </View>
  );
}