import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { QuickWeaveOverlay } from '@/modules/interactions';
import { MicroReflectionSheet } from './MicroReflectionSheet';
import { useInteractions } from '@/modules/interactions';

export function QuickWeaveProvider({ children }: { children: React.ReactNode }) {
  const isQuickWeaveOpen = useUIStore(state => state.isQuickWeaveOpen);
  const microReflectionData = useUIStore(state => state.microReflectionData);
  const hideMicroReflectionSheet = useUIStore(state => state.hideMicroReflectionSheet);
  const { updateInteractionVibeAndNotes, updateInteraction } = useInteractions();

  const handleSave = async (data: { vibe?: any; notes?: string; title?: string }) => {
    if (!microReflectionData) return;

    try {
      // Update vibe and notes
      await updateInteractionVibeAndNotes(
        microReflectionData.interactionId,
        data.vibe,
        data.notes
      );

      // Update title if changed
      if (data.title && data.title !== microReflectionData.activityLabel) {
        await updateInteraction(microReflectionData.interactionId, { title: data.title });
      }
    } catch (error) {
      console.error('Error saving micro-reflection:', error);
      // Optional: Show error toast here
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