import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Bell, Calendar, Heart, Sparkles, X } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';

const { height } = Dimensions.get('window');

interface NotificationPermissionModalProps {
  visible: boolean;
  onRequestPermission: () => Promise<void>;
  onDismiss: () => void;
}

export function NotificationPermissionModal({
  visible,
  onRequestPermission,
  onDismiss,
}: NotificationPermissionModalProps) {
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = React.useState(false);

  const sheetTranslateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      sheetTranslateY.value = withSpring(0, { damping: 40, stiffness: 250 });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else if (shouldRender) {
      sheetTranslateY.value = withTiming(height, { duration: 300 });
      backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible, shouldRender]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleEnable = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onRequestPermission();
  };

  const handleMaybeLater = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  if (!shouldRender) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View className="flex-1">
        {/* Backdrop */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            },
            animatedBackdropStyle,
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleMaybeLater}
            className="flex-1"
          />
        </Animated.View>

        {/* Modal Sheet */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.background,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingBottom: 40,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            animatedSheetStyle,
          ]}
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-6">
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
              }}
            />
          </View>

          {/* Content */}
          <View className="px-6">
            {/* Icon */}
            <Animated.View
              entering={FadeIn.delay(200).duration(600)}
              className="items-center mb-6"
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: `${colors.primary}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={40} color={colors.primary} />
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View entering={FadeIn.delay(300).duration(600)}>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: 'serif',
                  textAlign: 'center',
                  color: colors.foreground,
                  marginBottom: 8,
                }}
              >
                You just logged your first weave! 🎉
              </Text>
            </Animated.View>

            {/* Subtitle */}
            <Animated.View entering={FadeIn.delay(400).duration(600)}>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: 'center',
                  color: colors['muted-foreground'],
                  marginBottom: 32,
                  lineHeight: 24,
                }}
              >
                Want gentle reminders to stay connected?
              </Text>
            </Animated.View>

            {/* Benefits */}
            <Animated.View entering={FadeIn.delay(500).duration(600)} className="mb-8 gap-4">
              <View className="flex-row items-start gap-3">
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: `${colors.primary}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Calendar size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '600' }}>
                    Get notified before important moments
                  </Text>
                  <Text style={{ fontSize: 14, color: colors['muted-foreground'], marginTop: 2 }}>
                    Never miss a planned connection
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: `${colors.primary}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Heart size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '600' }}>
                    Reflect after meaningful connections
                  </Text>
                  <Text style={{ fontSize: 14, color: colors['muted-foreground'], marginTop: 2 }}>
                    Deepen your weaves with thoughtful reflection
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: `${colors.primary}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '600' }}>
                    Weekly check-ins on friendship health
                  </Text>
                  <Text style={{ fontSize: 14, color: colors['muted-foreground'], marginTop: 2 }}>
                    Stay aware of your social well-being
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={FadeIn.delay(600).duration(600)} className="gap-3">
              <TouchableOpacity
                onPress={handleEnable}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 17,
                    fontWeight: 'bold',
                  }}
                >
                  Enable Reminders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleMaybeLater}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
                activeOpacity={0.6}
              >
                <Text
                  style={{
                    color: colors['muted-foreground'],
                    fontSize: 16,
                  }}
                >
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
