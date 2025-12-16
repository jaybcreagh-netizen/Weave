import React from 'react';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import { ToastNotification } from './toast_notification';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toastData, hideToast } = useGlobalUI();

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

