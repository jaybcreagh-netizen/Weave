import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Suggestion } from '@/shared/types/common';
import { SuggestionCard } from './SuggestionCard';
import { IntentionsList } from './IntentionsList';
import { useTheme } from '@/shared/hooks/useTheme';
import Intention from '@/db/models/Intention';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

interface InsightsSheetProps {
  isVisible: boolean;
  suggestions: Suggestion[];
  intentions: Intention[];
  onClose: () => void;
  onAct: (suggestion: Suggestion) => void;
  onLater: (suggestionId: string) => void;
  onIntentionPress: (intention: Intention) => void;
}

export function InsightsSheet({
  isVisible,
  suggestions,
  intentions,
  onClose,
  onAct,
  onLater,
  onIntentionPress,
}: InsightsSheetProps) {
  const { colors, isDarkMode } = useTheme();
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = withSpring(0, { damping: 50, stiffness: 400 });
    }
  }, [isVisible]);

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => animateOut(onClose)}
      >
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }]}>
          <BlurView intensity={isDarkMode ? 20 : 10} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.muted },
          sheetStyle,
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            🧵 Insights for Your Weave
          </Text>
          <TouchableOpacity onPress={() => animateOut(onClose)}>
            <Text style={[styles.closeButton, { color: colors['muted-foreground'] }]}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Always show intentions section at top */}
          <IntentionsList intentions={intentions} onIntentionPress={onIntentionPress} />

          {suggestions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                All caught up!
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
                Your weave is looking strong. Keep nurturing your connections.
              </Text>
            </View>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAct={() => onAct(suggestion)}
                onLater={() => onLater(suggestion.id)}
              />
            ))
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.closeFooter}
            onPress={() => animateOut(onClose)}
          >
            <Text style={[styles.closeFooterText, { color: colors['muted-foreground'] }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  closeButton: {
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeFooterText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
