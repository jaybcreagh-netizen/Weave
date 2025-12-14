import React from 'react';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '@/shared/stores/uiStore';
import { QuickWeaveOverlay } from '@/modules/interactions';
import { MicroReflectionSheet } from './MicroReflectionSheet';
import { useInteractions } from '@/modules/interactions';

export function QuickWeaveProvider({ children }: { children: React.ReactNode }) {
  const isQuickWeaveOpen = useUIStore(state => state.isQuickWeaveOpen);
  const microReflectionData = useUIStore(state => state.microReflectionData);
  const hideMicroReflectionSheet = useUIStore(state => state.hideMicroReflectionSheet);
  const showToast = useUIStore(state => state.showToast);
  const { updateInteraction } = useInteractions();

  const handleSave = async (data: { vibe?: any; notes?: string; title?: string }) => {
    if (!microReflectionData) return;

    try {
      // Construct updates object
      const updates: any = {
        vibe: data.vibe,
        note: data.notes
      };

      // Update title if changed
      if (data.title && data.title !== microReflectionData.activityLabel) {
        updates.title = data.title;
      }

      // Always save reflection data to mark as "deepened" even if just title changed
      // This ensures the icon changes from Sparkles to Check
      // Always save reflection data when user hits Save, even if partial
      updates.reflectionJSON = JSON.stringify({
        vibe: data.vibe,
        notes: data.notes,
        timestamp: Date.now()
      });

      await updateInteraction(microReflectionData.interactionId, updates);

      // Provide haptic feedback for successful save
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success toast
      showToast("Reflection saved", microReflectionData.friendName);
    } catch (error) {
      console.error('Error saving micro-reflection:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast("Failed to save reflection", microReflectionData.friendName);
    } finally {
      // Always close the sheet
      hideMicroReflectionSheet();
    }
  };

  return (
    <>
      {children}
      {isQuickWeaveOpen && <QuickWeaveOverlay />}
      {microReflectionData && (
        <MicroReflectionSheet
          isVisible={!!microReflectionData}
          friendName={microReflectionData.friendName}
          activityLabel={microReflectionData.activityLabel}
          activityId={microReflectionData.activityId}
          friendArchetype={microReflectionData.friendArchetype}
          onSave={handleSave}
          onSkip={hideMicroReflectionSheet}
        />
      )}
    </>
  );
}