/**
 * ReachOutButton
 *
 * A button component that triggers the reach out flow.
 * Can open directly to a messaging app or show the app picker.
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import { MessageCircle, ChevronDown, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { useReachOut } from '../hooks/useReachOut';
import { useMessagingApps } from '../hooks/useMessagingApps';
import { MessagingAppPicker } from './MessagingAppPicker';
import { MessagingApp } from '../types';
import Friend from '@/db/models/Friend';

interface ReachOutButtonProps {
  friend: Friend;
  /** Optional pre-filled message */
  contextMessage?: string;
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Called after successfully opening a messaging app */
  onSuccess?: () => void;
  /** Called when contact linking is needed (no phone/email) */
  onLinkContact?: () => void;
  /** Custom label override */
  label?: string;
  /** Show loading state */
  loading?: boolean;
}

export function ReachOutButton({
  friend,
  contextMessage,
  variant = 'primary',
  size = 'md',
  onSuccess,
  onLinkContact,
  label,
  loading = false,
}: ReachOutButtonProps) {
  const { colors } = useTheme();
  const { reachOut } = useReachOut();
  const { availableApps } = useMessagingApps();
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasContactInfo = !!(friend.phoneNumber || friend.email);
  const hasMultipleApps = availableApps.length > 1;
  const hasPreference = !!friend.preferredMessagingApp;

  // Determine button appearance
  const buttonLabel =
    label || (hasContactInfo ? 'Reach Out' : 'Link Contact');
  const showChevron = hasContactInfo && hasMultipleApps && !hasPreference;

  const handlePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If no contact info, trigger link contact flow
    if (!hasContactInfo) {
      onLinkContact?.();
      return;
    }

    // If multiple apps and no preference, show picker
    if (hasMultipleApps && !hasPreference) {
      setShowPicker(true);
      return;
    }

    // Direct reach out
    setIsLoading(true);
    try {
      const result = await reachOut(friend, contextMessage);
      if (result.success) {
        onSuccess?.();
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    hasContactInfo,
    hasMultipleApps,
    hasPreference,
    friend,
    contextMessage,
    reachOut,
    onSuccess,
    onLinkContact,
  ]);

  const handleAppSelected = useCallback(
    async (appId: MessagingApp) => {
      setShowPicker(false);
      setIsLoading(true);
      try {
        const result = await reachOut(friend, contextMessage, appId);
        if (result.success) {
          onSuccess?.();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [friend, contextMessage, reachOut, onSuccess]
  );

  // Style calculations
  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.muted
        : 'transparent';

  const textColor =
    variant === 'primary' ? colors['primary-foreground'] : colors.foreground;

  const borderWidth = variant === 'ghost' ? 1 : 0;
  const borderColor = variant === 'ghost' ? colors.border : undefined;

  const paddingVertical = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const paddingHorizontal = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

  const isDisabled = loading || isLoading;

  const Icon = hasContactInfo ? MessageCircle : UserPlus;

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={{
          backgroundColor,
          borderWidth,
          borderColor,
          borderRadius: 12,
          paddingVertical,
          paddingHorizontal,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {isDisabled ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            <Icon size={iconSize} color={textColor} />
            <Text style={{ color: textColor, fontSize, fontWeight: '600' }}>
              {buttonLabel}
            </Text>
            {showChevron && <ChevronDown size={14} color={textColor} />}
          </>
        )}
      </TouchableOpacity>

      <MessagingAppPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleAppSelected}
        friend={friend}
      />
    </>
  );
}
