import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PortalHost } from '@gorhom/portal';
import { useUIStore } from '@/shared/stores/uiStore';
import { ToastNotification } from './toast_notification';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toastData, hideToast } = useUIStore();

  return (
    <>
      {children}
      {/* Dedicated Portal Host for Toasts to ensure they are always on top and correctly positioned */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents="box-none">
        <PortalHost name="toast_layer" />
      </View>

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

