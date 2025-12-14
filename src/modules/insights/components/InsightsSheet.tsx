import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Sparkles } from 'lucide-react-native';
import { Suggestion } from '@/shared/types/common';
import { SuggestionCard } from '@/modules/interactions';
import { IntentionsList } from '@/modules/relationships';
import { useTheme } from '@/shared/hooks/useTheme';
import Intention from '@/db/models/Intention';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { Text } from '@/shared/ui/Text';

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

  // Debug: Switch to BottomSheetFlatList to verify renderScrollContent works
  const BottomSheetList = React.useMemo(() => {
    return BottomSheetFlatList;
  }, []);

  const CustomTitle = (
    <View style={styles.titleContainer}>
      <WeaveIcon size={28} color={colors.primary} />
      <View>
        <Text variant="h2" style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}>
          Insights
        </Text>
        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
          Nurture your connections
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item, index }: { item: Suggestion; index: number }) => (
    <SuggestionCard
      suggestion={item}
      index={index}
      onAct={() => onAct(item)}
      onLater={() => onLater(item.id)}
    />
  );

  const renderHeader = () => (
    <View style={{ marginBottom: 24, marginTop: 8 }}>
      <IntentionsList intentions={intentions} onIntentionPress={onIntentionPress} />

      {suggestions.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text variant="h3" style={{ color: colors.foreground }}>
            Suggested Actions
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text variant="label" style={{ color: colors.foreground }}>{suggestions.length}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondary }]}>
        <Sparkles size={48} color={colors.primary} style={styles.emptyIcon} />
      </View>
      <Text variant="h2" style={[styles.emptyTitle, { color: colors.foreground }]}>
        All caught up!
      </Text>
      <Text variant="body" style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
        Your weave is looking strong. Time to relax or reach out spontaneously.
      </Text>
    </View>
  );

  return (
    <StandardBottomSheet
      visible={isVisible}
      onClose={onClose}
      height="full"
      titleComponent={CustomTitle}
      disableContentPanning
      hasUnsavedChanges={false}
      renderScrollContent={() => (
        <BottomSheetList
          data={suggestions}
          renderItem={renderItem}
          keyExtractor={(item: Suggestion) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    >
      {null}
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    opacity: 0.8
  },
  emptyTitle: {
    marginBottom: 12,
    fontFamily: 'Lora_700Bold',
  },
  emptySubtitle: {
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  listContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
});
