import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Suggestion } from '@/shared/types/common';
import { SuggestionCard } from './SuggestionCard';
import { IntentionsList } from './IntentionsList';
import { useTheme } from '@/shared/hooks/useTheme';
import Intention from '@/db/models/Intention';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { WeaveIcon } from '@/components/WeaveIcon';

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
  const { colors } = useTheme();

  const CustomTitle = (
    <View style={styles.titleContainer}>
      <WeaveIcon size={24} color={colors.primary} />
      <Text style={[styles.titleText, { color: colors.foreground }]}>
        Insights for Your Weave
      </Text>
    </View>
  );

  return (
    <StandardBottomSheet
      visible={isVisible}
      onClose={onClose}
      height="full"
      scrollable
      titleComponent={CustomTitle}
    >
      <View style={{ gap: 16, paddingBottom: 24 }}>
        {/* Always show intentions section at top */}
        <IntentionsList intentions={intentions} onIntentionPress={onIntentionPress} />

        {suggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <Sparkles size={64} color={colors.primary} style={styles.emptyIcon} />
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
      </View>
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
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
});
