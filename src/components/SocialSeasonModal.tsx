/**
 * SocialSeasonModal
 * Comprehensive modal showing constellation view, network insights, and season context
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Network, BarChart3, Info } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { useUserProfileStore } from '../stores/userProfileStore';
import { useFriends } from '../hooks/useFriends';
import { ConstellationView } from './constellation';
import { useConstellationData, useConstellationStats } from './constellation/useConstellationData';
import { ConstellationFilter, FilterMode } from './constellation/types';
import { SeasonCalculationInput } from '../lib/social-season/season-types';
import { generateSeasonExplanation } from '../lib/narrative-generator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SocialSeasonModalProps {
  visible: boolean;
  onClose: () => void;
  seasonData: SeasonCalculationInput | null;
}

type TabType = 'constellation' | 'insights' | 'context';

export const SocialSeasonModal: React.FC<SocialSeasonModalProps> = ({
  visible,
  onClose,
  seasonData,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { profile } = useUserProfileStore();
  const friends = useFriends();
  const [activeTab, setActiveTab] = useState<TabType>('constellation');
  const [filter, setFilter] = useState<ConstellationFilter>({ mode: 'all' });

  const season = profile?.currentSocialSeason || 'balanced';
  const constellationFriends = useConstellationData(friends);
  const stats = useConstellationStats(constellationFriends);

  const explanation = seasonData
    ? generateSeasonExplanation({ ...seasonData, season })
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Your Social Network
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            <Tab
              icon={Network}
              label="Constellation"
              active={activeTab === 'constellation'}
              onPress={() => setActiveTab('constellation')}
              colors={colors}
            />
            <Tab
              icon={BarChart3}
              label="Insights"
              active={activeTab === 'insights'}
              onPress={() => setActiveTab('insights')}
              colors={colors}
            />
            <Tab
              icon={Info}
              label="Context"
              active={activeTab === 'context'}
              onPress={() => setActiveTab('context')}
              colors={colors}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {activeTab === 'constellation' && (
              <ConstellationTab
                friends={constellationFriends}
                season={season}
                filter={filter}
                setFilter={setFilter}
                stats={stats}
                colors={colors}
              />
            )}
            {activeTab === 'insights' && (
              <InsightsTab stats={stats} colors={colors} />
            )}
            {activeTab === 'context' && (
              <ContextTab
                explanation={explanation}
                season={season}
                colors={colors}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Tab button component
interface TabProps {
  icon: React.FC<any>;
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}

const Tab: React.FC<TabProps> = ({ icon: Icon, label, active, onPress, colors }) => (
  <TouchableOpacity
    style={[styles.tab, active && styles.tabActive]}
    onPress={onPress}
  >
    <Icon size={18} color={active ? colors.primary : colors['muted-foreground']} />
    <Text
      style={[
        styles.tabLabel,
        {
          color: active ? colors.primary : colors['muted-foreground'],
          fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
        },
      ]}
    >
      {label}
    </Text>
    {active && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
  </TouchableOpacity>
);

// Constellation Tab
interface ConstellationTabProps {
  friends: any[];
  season: any;
  filter: ConstellationFilter;
  setFilter: (filter: ConstellationFilter) => void;
  stats: any;
  colors: any;
}

const ConstellationTab: React.FC<ConstellationTabProps> = ({
  friends,
  season,
  filter,
  setFilter,
  stats,
  colors,
}) => (
  <View style={styles.constellationContainer}>
    {/* Constellation View */}
    <View style={styles.constellationCanvas}>
      <ConstellationView
        friends={friends}
        season={season}
        filter={filter}
        width={SCREEN_WIDTH - 48}
        height={SCREEN_HEIGHT * 0.5}
      />
    </View>

    {/* Stats bar */}
    <View style={[styles.statsBar, { backgroundColor: colors.muted }]}>
      <Text style={[styles.statText, { color: colors.foreground }]}>
        ● {stats.byTier.InnerCircle} Inner
      </Text>
      <Text style={[styles.statText, { color: colors.foreground }]}>
        ● {stats.byTier.CloseFriends} Close
      </Text>
      <Text style={[styles.statText, { color: colors.foreground }]}>
        ● {stats.byTier.Community} Community
      </Text>
    </View>

    {/* Filter chips */}
    <View style={styles.filterContainer}>
      <FilterChip
        label="All"
        active={filter.mode === 'all'}
        onPress={() => setFilter({ mode: 'all' })}
        colors={colors}
      />
      <FilterChip
        label="Fading"
        active={filter.mode === 'fading'}
        onPress={() => setFilter({ mode: 'fading' })}
        colors={colors}
        count={stats.health.fading}
      />
      <FilterChip
        label="Momentum"
        active={filter.mode === 'momentum'}
        onPress={() => setFilter({ mode: 'momentum' })}
        colors={colors}
        count={stats.health.momentum}
      />
    </View>

    {/* Instructions */}
    <Text style={[styles.instructions, { color: colors['muted-foreground'] }]}>
      Pinch to zoom • Pan to explore • Double-tap to reset
    </Text>
  </View>
);

// Filter chip component
interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
  count?: number;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, colors, count }) => (
  <TouchableOpacity
    style={[
      styles.filterChip,
      {
        backgroundColor: active ? colors.primary : colors.muted,
        borderColor: active ? colors.primary : colors.border,
      },
    ]}
    onPress={onPress}
  >
    <Text
      style={[
        styles.filterChipText,
        {
          color: active ? colors['primary-foreground'] : colors.foreground,
          fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
        },
      ]}
    >
      {label}
      {count !== undefined && count > 0 && ` (${count})`}
    </Text>
  </TouchableOpacity>
);

// Insights Tab (placeholder for network health graphs)
interface InsightsTabProps {
  stats: any;
  colors: any;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ stats, colors }) => (
  <View style={styles.insightsContainer}>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
      Network Health
    </Text>

    {/* Tier breakdown */}
    <View style={styles.tierStats}>
      <StatRow
        label="Inner Circle"
        value={stats.byTier.InnerCircle}
        total={stats.total}
        colors={colors}
      />
      <StatRow
        label="Close Friends"
        value={stats.byTier.CloseFriends}
        total={stats.total}
        colors={colors}
      />
      <StatRow
        label="Community"
        value={stats.byTier.Community}
        total={stats.total}
        colors={colors}
      />
    </View>

    {/* Health breakdown */}
    <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>
      Relationship Health
    </Text>
    <View style={styles.healthStats}>
      <HealthStat
        label="Thriving"
        value={stats.health.thriving}
        color="#34D399"
        colors={colors}
      />
      <HealthStat
        label="Fading"
        value={stats.health.fading}
        color="#F87171"
        colors={colors}
      />
      <HealthStat
        label="Momentum"
        value={stats.health.momentum}
        color="#FFD700"
        colors={colors}
      />
    </View>

    <Text style={[styles.placeholderText, { color: colors['muted-foreground'] }]}>
      More detailed graphs and patterns coming soon...
    </Text>
  </View>
);

// Context Tab
interface ContextTabProps {
  explanation: any;
  season: string;
  colors: any;
}

const ContextTab: React.FC<ContextTabProps> = ({ explanation, season, colors }) => (
  <View style={styles.contextContainer}>
    {explanation ? (
      <>
        <Text style={[styles.contextTitle, { color: colors.foreground }]}>
          {explanation.headline}
        </Text>

        {explanation.reasons.length > 0 && (
          <View style={styles.reasonsContainer}>
            <Text style={[styles.reasonsLabel, { color: colors['muted-foreground'] }]}>
              Based on:
            </Text>
            {explanation.reasons.map((reason: string, index: number) => (
              <View key={index} style={styles.reasonItem}>
                <Text style={[styles.reasonBullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.reasonText, { color: colors.foreground }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.insightBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.insightText, { color: colors.foreground }]}>
            {explanation.insight}
          </Text>
        </View>
      </>
    ) : (
      <Text style={[styles.placeholderText, { color: colors['muted-foreground'] }]}>
        Season context loading...
      </Text>
    )}
  </View>
);

// Helper components
const StatRow: React.FC<{ label: string; value: number; total: number; colors: any }> = ({
  label,
  value,
  total,
  colors,
}) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.statBarContainer}>
        <View
          style={[
            styles.statBar,
            {
              width: `${percentage}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
};

const HealthStat: React.FC<{ label: string; value: number; color: string; colors: any }> = ({
  label,
  value,
  color,
  colors,
}) => (
  <View style={styles.healthStat}>
    <View style={[styles.healthDot, { backgroundColor: color }]} />
    <Text style={[styles.healthLabel, { color: colors.foreground }]}>{label}</Text>
    <Text style={[styles.healthValue, { color: colors.foreground }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 24,
  },
  closeButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    position: 'relative',
  },
  tabActive: {},
  tabLabel: {
    fontSize: 14,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  content: {
    flex: 1,
  },
  constellationContainer: {
    flex: 1,
    padding: 16,
  },
  constellationCanvas: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_HEIGHT * 0.5,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#000000',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  instructions: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  insightsContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 18,
    marginBottom: 16,
  },
  tierStats: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    width: 100,
  },
  statBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statBar: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    width: 30,
    textAlign: 'right',
  },
  healthStats: {
    gap: 12,
  },
  healthStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  healthLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    flex: 1,
  },
  healthValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  placeholderText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  contextContainer: {
    flex: 1,
    padding: 20,
  },
  contextTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    marginBottom: 16,
  },
  reasonsContainer: {
    marginBottom: 20,
    gap: 8,
  },
  reasonsLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    gap: 8,
  },
  reasonBullet: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
  },
  reasonText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  insightBox: {
    padding: 16,
    borderRadius: 12,
  },
  insightText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
