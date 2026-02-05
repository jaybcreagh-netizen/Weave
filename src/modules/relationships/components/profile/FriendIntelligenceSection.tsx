import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import FriendModel from '@/db/models/Friend';
import { useTheme } from '@/shared/hooks/useTheme';

interface FriendIntelligenceSectionProps {
  friend: FriendModel;
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function FriendIntelligenceSection({ friend }: FriendIntelligenceSectionProps) {
  const { colors } = useTheme();

  const detectedThemes = useMemo(() => friend.detectedThemes.slice(0, 8), [friend.detectedThemesRaw]);
  const preferredWeaveTypes = useMemo(() => friend.preferredWeaveTypes.slice(0, 6), [friend.preferredWeaveTypesRaw]);
  const topTopicClusters = useMemo(() => {
    return Object.entries(friend.topicClusters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [friend.topicClustersRaw]);

  const hasAnySignals = detectedThemes.length > 0 || preferredWeaveTypes.length > 0 || topTopicClusters.length > 0;

  if (!hasAnySignals) return null;

  return (
    <View className="px-5">
      <View
        className="mt-2 mb-2 p-3 rounded-xl"
        style={{
          backgroundColor: colors.muted,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-lora-bold text-[15px]" style={{ color: colors.foreground }}>
            Journal Patterns
          </Text>
          <View className="px-2 py-1 rounded-full" style={{ backgroundColor: `${colors.primary}18` }}>
            <Text className="font-inter-semibold text-[10px]" style={{ color: colors.primary }}>
              Read-only
            </Text>
          </View>
        </View>

        {detectedThemes.length > 0 && (
          <View className="mb-2">
            <Text className="font-inter-medium text-[11px] mb-1" style={{ color: colors['muted-foreground'] }}>
              Detected Themes
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {detectedThemes.map((theme) => (
                <View
                  key={`theme-${theme}`}
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}40` }}
                >
                  <Text className="font-inter-medium text-[11px]" style={{ color: colors.primary }}>
                    {formatLabel(theme)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {preferredWeaveTypes.length > 0 && (
          <View className="mb-2">
            <Text className="font-inter-medium text-[11px] mb-1" style={{ color: colors['muted-foreground'] }}>
              Preferred Weave Types
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {preferredWeaveTypes.map((weaveType) => (
                <View
                  key={`weave-${weaveType}`}
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text className="font-inter-medium text-[11px]" style={{ color: colors.foreground }}>
                    {formatLabel(weaveType)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {topTopicClusters.length > 0 && (
          <View>
            <Text className="font-inter-medium text-[11px] mb-1" style={{ color: colors['muted-foreground'] }}>
              Top Topics
            </Text>
            <View className="gap-1">
              {topTopicClusters.map(([topic, mentions]) => (
                <View key={`topic-${topic}`} className="flex-row items-center justify-between">
                  <Text className="font-inter-regular text-[12px]" style={{ color: colors.foreground }}>
                    {formatLabel(topic)}
                  </Text>
                  <Text className="font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                    {mentions} mentions
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
