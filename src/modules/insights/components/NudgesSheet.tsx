/**
 * NudgesSheet - Displays suggestions and intentions
 * 
 * OPTIMIZATION: Migrated from withObservables to FriendsObservableContext.
 * Uses centralized context for friends instead of creating a separate subscription.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { Sparkles, Link2, Send, ChevronRight, Flame, Star, MessageCircle } from 'lucide-react-native';
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
import { SuggestionActionSheet } from '@/modules/interactions/components/SuggestionActionSheet';
import { useFriendsObservable } from '@/shared/context/FriendsObservableContext';
import FriendModel from '@/db/models/Friend';
import { useRouter } from 'expo-router';
import { SeasonAnalyticsService } from '@/modules/intelligence';

interface NudgesSheetProps {
  isVisible: boolean;
  suggestions: Suggestion[];
  intentions: Intention[];
  onClose: () => void;
  onAct: (suggestion: Suggestion) => void;
  onLater: (suggestionId: string) => void;
  onIntentionPress: (intention: Intention) => void;
  portalHost?: string;
}

// Urgency group configuration
const URGENCY_GROUPS = [
  {
    key: 'needs-attention',
    title: 'Needs Attention',
    icon: Flame,
    urgencies: ['critical', 'high'] as const,
  },
  {
    key: 'worth-a-thought',
    title: 'Worth a Thought',
    icon: Star,
    urgencies: ['medium'] as const,
  },
  {
    key: 'nice-to-have',
    title: 'Nice to Have',
    icon: MessageCircle,
    urgencies: ['low'] as const,
  },
] as const;

interface SuggestionSection {
  key: string;
  title: string;
  icon: typeof Flame;
  data: Suggestion[];
}

export const NudgesSheet: React.FC<NudgesSheetProps> = ({
  isVisible,
  suggestions,
  intentions,
  onClose,
  onAct,
  onLater,
  onIntentionPress,
  portalHost,
}) => {
  const { colors, tokens } = useTheme();
  const router = useRouter();
  const { friends } = useFriendsObservable();
  const [showActivityInbox, setShowActivityInbox] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  // Group suggestions by urgency
  const groupedSuggestions = useMemo((): SuggestionSection[] => {
    return URGENCY_GROUPS
      .map((group) => ({
        key: group.key,
        title: group.title,
        icon: group.icon,
        data: suggestions.filter((s) => {
          const urgency = s.urgency || 'low';
          return (group.urgencies as readonly string[]).includes(urgency);
        }),
      }))
      .filter((section) => section.data.length > 0);
  }, [suggestions]);

  // Create friend lookup map for quick access
  const friendsMap = useMemo(() => {
    const map = new Map<string, FriendModel>();
    friends.forEach((f) => map.set(f.id, f));
    return map;
  }, [friends]);

  // Handlers for SuggestionActionSheet
  const handleSuggestionPress = (suggestion: Suggestion) => {
    const friend = friendsMap.get(suggestion.friendId);
    if (!friend) return;
    setSelectedSuggestion(suggestion);
  };

  const handlePlanSuggestion = (suggestion: Suggestion, friend: FriendModel) => {
    onClose();
    router.push({
      pathname: '/weave-logger',
      params: {
        friendId: friend.id,
        initialCategory: suggestion.category,
        mode: 'plan',
      },
    });
    SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
  };

  const handleReachOutSuccess = (suggestion: Suggestion) => {
    onClose();
    SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
  };

  const handleSuggestionDismiss = (suggestion: Suggestion) => {
    setSelectedSuggestion(null);
  };

  // Pending activity counts (only if accounts enabled)
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const { pendingWeaves } = usePendingWeaves();
  const pendingWeaveCount = FeatureFlags.ACCOUNTS_ENABLED
    ? pendingWeaves.filter((w) => w.status === 'pending').length
    : 0;
  const totalPendingCount = pendingRequestCount + pendingWeaveCount;

  useEffect(() => {
    if (!FeatureFlags.ACCOUNTS_ENABLED || !isVisible) return;
    getPendingRequestCount().then(setPendingRequestCount);
  }, [isVisible]);

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
      friend={friendsMap.get(item.friendId)}
      index={index}
      onAct={() => handleSuggestionPress(item)}
      onLater={() => onLater(item.id)}
    />
  );

  const renderSectionHeader = ({ section }: { section: SuggestionSection }) => {
    const IconComponent = section.icon;
    const isHighPriority = section.key === 'needs-attention';

    return (
      <View
        className="flex-row items-center gap-2 py-2 px-1 mb-2"
        style={{ marginTop: section.key === 'needs-attention' ? 0 : 8 }}
      >
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{
            backgroundColor: isHighPriority ? colors.accent + '20' : colors.secondary,
          }}
        >
          <IconComponent
            size={14}
            color={isHighPriority ? colors.accent : colors['muted-foreground']}
          />
        </View>
        <Text
          variant="label"
          weight="semibold"
          style={{ color: isHighPriority ? colors.accent : colors['muted-foreground'] }}
        >
          {section.title}
        </Text>
        <View
          className="px-1.5 py-0.5 rounded-full ml-1"
          style={{ backgroundColor: colors.secondary }}
        >
          <Text
            variant="caption"
            style={{ color: colors['muted-foreground'], fontSize: 11 }}
          >
            {section.data.length}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View className="mb-4 mt-2">
      {/* Activity Banner */}
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
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center py-[60px] mt-5">
      <View
        className="w-[100px] h-[100px] rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: colors.secondary }}
      >
        <Sparkles size={48} color={colors.primary} className="opacity-80" />
      </View>
      <Text variant="h2" className="mb-3 font-lora-bold" style={{ color: colors.foreground }}>
        All caught up!
      </Text>
      <Text
        variant="body"
        className="text-center px-10 leading-6"
        style={{ color: colors['muted-foreground'] }}
      >
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
        portalHost={portalHost}
        renderScrollContent={() => (
          <BottomSheetSectionList
            sections={groupedSuggestions}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item: Suggestion) => item.id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )}
      >
        {null}
      </StandardBottomSheet>

      <SuggestionActionSheet
        isOpen={!!selectedSuggestion}
        onClose={() => setSelectedSuggestion(null)}
        suggestion={selectedSuggestion}
        friend={
          selectedSuggestion
            ? friendsMap.get(selectedSuggestion.friendId) || null
            : null
        }
        onPlan={handlePlanSuggestion}
        onDismiss={handleSuggestionDismiss}
        onReachOutSuccess={handleReachOutSuccess}
      />

      <ActivityInboxSheet
        visible={showActivityInbox}
        onClose={() => setShowActivityInbox(false)}
        portalHost={portalHost}
        onRequestHandled={() => {
          getPendingRequestCount().then(setPendingRequestCount);
        }}
      />
    </>
  );
};

