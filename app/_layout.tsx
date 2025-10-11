import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ArchetypeDetailModal } from '../src/components/ArchetypeDetailModal';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="friend-profile" />
          <Stack.Screen name="add-friend" />
          <Stack.Screen name="edit-friend" />
          <Stack.Screen name="interaction-form" />
        </Stack>
        <ArchetypeDetailModal />
      </View>
    </GestureHandlerRootView>
  );
}