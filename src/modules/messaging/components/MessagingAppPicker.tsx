/**
 * MessagingAppPicker
 *
 * A bottom sheet that lets users choose which messaging app to use
 * for reaching out to a friend.
 */

import React, { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MessageCircle, Send, MessageSquare, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { useMessagingApps } from '../hooks/useMessagingApps';
import { MessagingApp, MessagingAppConfig } from '../types';
import Friend from '@/db/models/Friend';

interface MessagingAppPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (appId: MessagingApp) => void;
  friend: Friend;
}

const ICON_MAP: Record<string, typeof MessageCircle> = {
  MessageCircle,
  Send,
  MessageSquare,
  Mail,
};

export function MessagingAppPicker({
  visible,
  onClose,
  onSelect,
  friend,
}: MessagingAppPickerProps) {
  const { colors } = useTheme();
  const { availableApps, loading } = useMessagingApps();
  const pendingAppRef = useRef<MessagingApp | null>(null);

  const hasPhone = !!friend.phoneNumber;
  const hasEmail = !!friend.email;

  // Filter to apps that can actually be used with this friend's contact info
  const usableApps = availableApps.filter((app) => {
    if (app.requiresPhone && !hasPhone) return false;
    if (!app.requiresPhone && !hasEmail) return false;
    return true;
  });

  const handleSelect = (appId: MessagingApp) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pendingAppRef.current = appId;
    onClose();
  };

  const handleCloseComplete = () => {
    if (pendingAppRef.current) {
      onSelect(pendingAppRef.current);
      pendingAppRef.current = null;
    }
  };

  const renderAppButton = (app: MessagingAppConfig) => {
    const IconComponent = ICON_MAP[app.icon] || MessageCircle;

    return (
      <TouchableOpacity
        key={app.id}
        onPress={() => handleSelect(app.id)}
        className="flex-row items-center p-4 rounded-xl"
        style={{ backgroundColor: colors.muted }}
        activeOpacity={0.7}
      >
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: colors.primary + '20' }}
        >
          <IconComponent size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium" style={{ color: colors.foreground }}>
            {app.name}
          </Text>
          <Text className="text-sm" style={{ color: colors['muted-foreground'] }}>
            {app.requiresPhone ? friend.phoneNumber : friend.email}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AnimatedBottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={handleCloseComplete}
      height="action"
      title={`Message ${friend.name}`}
    >
      <View className="gap-3">
        {loading ? (
          <Text style={{ color: colors['muted-foreground'] }}>Detecting apps...</Text>
        ) : usableApps.length === 0 ? (
          <View className="py-4">
            <Text className="text-center" style={{ color: colors['muted-foreground'] }}>
              {!hasPhone && !hasEmail
                ? 'No contact information available'
                : 'No compatible messaging apps found'}
            </Text>
          </View>
        ) : (
          usableApps.map(renderAppButton)
        )}
      </View>
    </AnimatedBottomSheet>
  );
}
