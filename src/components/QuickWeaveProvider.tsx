import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { QuickWeaveOverlay } from './QuickWeaveOverlay';

export function QuickWeaveProvider({ children }: { children: React.ReactNode }) {
  const isQuickWeaveOpen = useUIStore(state => state.isQuickWeaveOpen);

  return (
    <>
      {children}
      {isQuickWeaveOpen && <QuickWeaveOverlay />}
    </>
  );
}