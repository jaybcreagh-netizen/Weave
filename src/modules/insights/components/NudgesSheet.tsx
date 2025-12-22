import React from 'react';
import { View } from 'react-native';
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

interface NudgesSheetProps {
  isVisible: boolean;
  suggestions: Suggestion[];
  intentions: Intention[];
  onClose: () => void;
  onAct: (suggestion: Suggestion) => void;
  onLater: (suggestionId: string) => void;
  onIntentionPress: (intention: Intention) => void;
}

export function NudgesSheet({
  isVisible,
  suggestions,
  intentions,
  onClose,
  onAct,
  onLater,
  onIntentionPress,
}: NudgesSheetProps) {
  const { colors } = useTheme();

  // Debug: Switch to BottomSheetFlatList to verify renderScrollContent works
  const BottomSheetList = React.useMemo(() => {
    return BottomSheetFlatList;
  }, []);

  const CustomTitle = (
    <View className="flex-row items-center gap-3">
      <WeaveIcon size={28} color={colors.primary} />
      <View>
        <Text variant="h2" style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}>
          Nudges
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
    <View className="mb-6 mt-2">
      <IntentionsList intentions={intentions} onIntentionPress={onIntentionPress} />

      {suggestions.length > 0 && (
        <View className="flex-row items-center gap-2 mb-4 px-1">
          <Text variant="h3" style={{ color: colors.foreground }}>
            Suggested Actions
          </Text>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.secondary }}>
            <Text variant="label" style={{ color: colors.foreground }}>{suggestions.length}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center py-[60px] mt-5">
      <View className="w-[100px] h-[100px] rounded-full items-center justify-center mb-6" style={{ backgroundColor: colors.secondary }}>
        <Sparkles size={48} color={colors.primary} className="opacity-80" />
      </View>
      <Text variant="h2" className="mb-3 font-lora-bold" style={{ color: colors.foreground }}>
        All caught up!
      </Text>
      <Text variant="body" className="text-center px-10 leading-6" style={{ color: colors['muted-foreground'] }}>
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
          contentContainerClassName="pb-10 px-4"
          showsVerticalScrollIndicator={false}
        />
      )}
    >
      {null}
    </StandardBottomSheet>
  );
}
