import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Sparkles, Link2, Send, ChevronRight } from 'lucide-react-native';
import { Suggestion } from '@/shared/types/common';
import { SuggestionCard } from '@/modules/interactions/components/SuggestionCard';
import { IntentionsList } from '@/modules/relationships/components/IntentionsList';
import { useTheme } from '@/shared/hooks/useTheme';
import Intention from '@/db/models/Intention';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { Text } from '@/shared/ui/Text';
import { FeatureFlags } from '@/shared/config/feature-flags';
import { usePendingWeaves, ActivityInboxSheet } from '@/modules/sync';
import { getPendingRequestCount } from '@/modules/relationships/services/friend-linking.service';
import { useReachOut, ContactLinker } from '@/modules/messaging';
import { SuggestionActionSheet } from '@/modules/interactions/components/SuggestionActionSheet';
import withObservables from '@nozbe/with-observables';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SeasonAnalyticsService } from '@/modules/intelligence';

interface NudgesSheetProps {
  isVisible: boolean;
  suggestions: Suggestion[];
  intentions: Intention[];
  onClose: () => void;
  onAct: (suggestion: Suggestion) => void;
  onLater: (suggestionId: string) => void;
  onIntentionPress: (intention: Intention) => void;
  friends: FriendModel[];
}

const NudgesSheetComponent = function ({
  isVisible,
  suggestions,
  intentions,
  onClose,
  onAct,
  onLater,
  onIntentionPress,
  friends,
}: NudgesSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { reachOut } = useReachOut();
  const [showActivityInbox, setShowActivityInbox] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [reachOutFriend, setReachOutFriend] = useState<FriendModel | null>(null);
  const [showContactLinker, setShowContactLinker] = useState(false);

  // Handlers for SuggestionActionSheet
  const handleSuggestionPress = (suggestion: Suggestion) => {
    const friend = friends.find(f => f.id === suggestion.friendId);
    if (!friend) return;
    setSelectedSuggestion(suggestion);
  };

  const handlePlanSuggestion = (suggestion: Suggestion, friend: FriendModel) => {
    onClose(); // Close the sheet first

    // Navigate to weave logger (Plan mode)
    router.push({
      pathname: '/weave-logger',
      params: {
        friendId: friend.id,
        initialCategory: suggestion.category,
        mode: 'plan'
      }
    });

    // ANALYTICS: Track acceptance
    SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
  };

  const handleReachOutSuccess = (suggestion: Suggestion) => {
    onClose();
    // ANALYTICS: Track acceptance
    SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
  };

  const handleSuggestionDismiss = (suggestion: Suggestion) => {
    setSelectedSuggestion(null);
    // Optional: Call onLater if we want to dismiss it from the list too
    // onLater(suggestion.id); 
  };

  // Pending activity counts (only if accounts enabled)
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const { pendingWeaves } = usePendingWeaves();
  const pendingWeaveCount = FeatureFlags.ACCOUNTS_ENABLED
    ? pendingWeaves.filter(w => w.status === 'pending').length
    : 0;
  const totalPendingCount = pendingRequestCount + pendingWeaveCount;

  // Fetch request count when sheet opens
  useEffect(() => {
    if (!FeatureFlags.ACCOUNTS_ENABLED || !isVisible) return;
    getPendingRequestCount().then(setPendingRequestCount);
  }, [isVisible]);

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
      onAct={() => handleSuggestionPress(item)}
      onLater={() => onLater(item.id)}
    />
  );

  const renderHeader = () => (
    <View className="mb-6 mt-2">
      {/* Activity Banner - only show if accounts enabled and pending items */}
      {FeatureFlags.ACCOUNTS_ENABLED && totalPendingCount > 0 && (
        <TouchableOpacity
          className="flex-row items-center p-3 rounded-xl mb-4"
          style={{ backgroundColor: colors.primary + '15' }}
          onPress={() => setShowActivityInbox(true)}
        >
          <View className="flex-row items-center flex-1 gap-3">
            <View
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary + '25' }}
            >
              {pendingRequestCount > 0 ? (
                <Link2 size={18} color={colors.primary} />
              ) : (
                <Send size={18} color={colors.primary} />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-semibold" style={{ color: colors.foreground }}>
                {pendingRequestCount > 0 && pendingWeaveCount > 0
                  ? `${pendingRequestCount} requests · ${pendingWeaveCount} shared weaves`
                  : pendingRequestCount > 0
                    ? `${pendingRequestCount} pending link request${pendingRequestCount > 1 ? 's' : ''}`
                    : `${pendingWeaveCount} shared weave${pendingWeaveCount > 1 ? 's' : ''}`}
              </Text>
              <Text className="text-xs" style={{ color: colors['muted-foreground'] }}>
                Tap to review
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.primary} />
        </TouchableOpacity>
      )}

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
    <>
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

      <SuggestionActionSheet
        isOpen={!!selectedSuggestion}
        onClose={() => setSelectedSuggestion(null)}
        suggestion={selectedSuggestion}
        friend={selectedSuggestion ? friends.find(f => f.id === selectedSuggestion.friendId) || null : null}
        onPlan={handlePlanSuggestion}
        onDismiss={handleSuggestionDismiss}
        onReachOutSuccess={handleReachOutSuccess}
      />

      <ActivityInboxSheet
        visible={showActivityInbox}
        onClose={() => setShowActivityInbox(false)}
        onRequestHandled={() => {
          getPendingRequestCount().then(setPendingRequestCount);
        }}
      />
    </>
  );
}

const enhance = withObservables([], () => ({
  friends: database.get<FriendModel>('friends').query().observe(),
}));

export const NudgesSheet = enhance(NudgesSheetComponent);

