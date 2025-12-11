import React from 'react';
import { useUIStore } from '../stores/uiStore';
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

      // Save reflection data if vibe or notes exist (basic reflection structure)
      if (data.vibe || data.notes) {
        updates.reflectionJSON = JSON.stringify({
          vibe: data.vibe,
          notes: data.notes,
          timestamp: Date.now()
        });
      }

      await updateInteraction(microReflectionData.interactionId, updates);
      // Success feedback (optional but helpful if user says "no feedback")
      // showToast("Reflection saved", microReflectionData.friendName); 
    } catch (error) {
      console.error('Error saving micro-reflection:', error);
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