import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { Bell, Users, CalendarDays, CheckCircle2, XCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '@/shared/hooks/useTheme';
import { useNotificationPermissions } from '@/modules/notifications';

const PERMISSIONS_COMPLETED_KEY = '@weave:permissions_completed';
const NOTIFICATION_PERMISSION_ASKED_KEY = '@weave:notification_permission_asked';

type PermissionStatus = 'pending' | 'granted' | 'denied';

interface Permission {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  status: PermissionStatus;
}

export default function PermissionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requestPermission: requestNotificationPermission } = useNotificationPermissions();
  const [isRequesting, setIsRequesting] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedRef = useRef(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'contacts',
      title: 'Contacts',
      description: 'Helps you quickly find and add friends from your address book',
      icon: <Users size={28} color={colors.primary} />,
      required: true,
      status: 'pending',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Gentle reminders to nurture your relationships',
      icon: <Bell size={28} color={colors.primary} />,
      required: false,
      status: 'pending',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'Sync planned interactions and detect past events to log',
      icon: <CalendarDays size={28} color={colors.primary} />,
      required: false,
      status: 'pending',
    },
  ]);

  const updatePermissionStatus = (id: string, status: PermissionStatus) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  };

  const requestPermissions = async () => {
    setIsRequesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Request Contacts
      const contactsResult = await Contacts.requestPermissionsAsync();
      updatePermissionStatus(
        'contacts',
        contactsResult.status === 'granted' ? 'granted' : 'denied'
      );

      // Request Notifications
      const notificationGranted = await requestNotificationPermission();
      updatePermissionStatus(
        'notifications',
        notificationGranted ? 'granted' : 'denied'
      );

      // Request Calendar
      const calendarResult = await Calendar.requestCalendarPermissionsAsync();
      updatePermissionStatus(
        'calendar',
        calendarResult.status === 'granted' ? 'granted' : 'denied'
      );

      // Mark permissions flow as completed
      await AsyncStorage.setItem(PERMISSIONS_COMPLETED_KEY, 'true');
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');

      // Short delay to show status updates
      navigationTimeoutRef.current = setTimeout(() => {
        if (!hasNavigatedRef.current) {
          handleContinue();
        }
      }, 800);
    } catch (error) {
      console.error('[Permissions] Error requesting permissions:', error);
      Alert.alert(
        'Permission Error',
        'There was an issue requesting permissions. You can grant them later in Settings.',
        [{ text: 'Continue', onPress: handleContinue }]
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const handleContinue = () => {
    if (hasNavigatedRef.current) return; // Prevent double navigation
    hasNavigatedRef.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/add-friend?fromOnboarding=true');
  };

  const handleSkip = async () => {
    // Cancel any pending navigation
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Mark as completed so we don't show this screen again
    await AsyncStorage.setItem(PERMISSIONS_COMPLETED_KEY, 'true');
    handleContinue();
  };

  const allGranted = permissions.every((p) => p.status === 'granted');
  const someGranted = permissions.some((p) => p.status === 'granted');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(600).delay(100)}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Let's Set Up Weave
          </Text>
          <Text style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
            To help you nurture your relationships, Weave needs a few permissions.
          </Text>
        </Animated.View>

        <View style={styles.permissionsContainer}>
          {permissions.map((permission, index) => (
            <Animated.View
              key={permission.id}
              entering={FadeInDown.duration(600).delay(300 + index * 100)}
              style={[
                styles.permissionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.permissionHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  {permission.icon}
                </View>
                <View style={styles.permissionInfo}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
                      {permission.title}
                    </Text>
                    {permission.required && (
                      <View style={[styles.requiredBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.requiredText}>Required</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.permissionDescription, { color: colors['muted-foreground'] }]}>
                    {permission.description}
                  </Text>
                </View>
                {permission.status !== 'pending' && (
                  <View style={styles.statusIcon}>
                    {permission.status === 'granted' ? (
                      <CheckCircle2 size={24} color="#10b981" />
                    ) : (
                      <XCircle size={24} color={colors['muted-foreground']} />
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View
          entering={FadeInDown.duration(600).delay(800)}
          style={styles.actionsContainer}
        >
          {!someGranted ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={requestPermissions}
                disabled={isRequesting}
              >
                <Text style={styles.primaryButtonText}>
                  {isRequesting ? 'Requesting...' : 'Allow Permissions'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSkip}
                disabled={isRequesting}
              >
                <Text style={[styles.secondaryButtonText, { color: colors['muted-foreground'] }]}>
                  Skip for now
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleContinue}
            >
              <Text style={styles.primaryButtonText}>
                {allGranted ? 'All set! Continue' : 'Continue'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(1000)}>
          <Text style={[styles.footnote, { color: colors['muted-foreground'] }]}>
            You can change these permissions anytime in Settings
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  permissionsContainer: {
    flex: 1,
    gap: 16,
  },
  permissionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  permissionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  permissionDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  statusIcon: {
    marginLeft: 8,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    fontWeight: '500',
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
