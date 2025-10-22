import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { ToastNotification } from './toast_notification';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toastData, hideToast } = useUIStore();

  return (
    <>
      {children}
      {toastData && (
        <ToastNotification
          message={toastData.message}
          friendName={toastData.friendName}
          onDismiss={hideToast}
        />
      )}
    </>
  );
}

