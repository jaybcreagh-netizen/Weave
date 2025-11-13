/**
 * SocialSeasonModal
 * Full network health hub with tabs: Pulse, Health, Insights
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Activity, Heart, BarChart3 } from 'lucide-react-native';
import Svg, { Circle, G, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { usePortfolio } from '../../hooks/usePortfolio';
import { type SocialSeason, type SeasonExplanationData } from '../../lib/social-season/season-types';
import { SEASON_STYLES, getSeasonDisplayName } from '../../lib/social-season/season-content';
import { generateSeasonExplanation } from '../../lib/narrative-generator';
import { GraphsTabContent } from '../YearInMoons/GraphsTabContent';
import { Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface SocialSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: SocialSeason;
  seasonData: SeasonExplanationData | null;
  weeklyWeaves: number;
  currentStreak: number;
  networkHealth: number;
}

type Tab = 'pulse' | 'health' | 'insights';

export function SocialSeasonModal({
  isOpen,
  onClose,
  season,
  seasonData,
  weeklyWeaves,
  currentStreak,
  networkHealth,
}: SocialSeasonModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [currentTab, setCurrentTab] = useState<Tab>('pulse');

  const seasonStyle = SEASON_STYLES[season];
  const gradientColors = isDarkMode ? seasonStyle.gradientColorsDark : seasonStyle.gradientColorsLight;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'pulse', label: 'Pulse', icon: Activity },
    { id: 'health', label: 'Health', icon: Heart },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
  ];

  const handleTabChange = (tab: Tab) => {
    setCurrentTab(tab);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={isDarkMode ? ['#1a1d2e', '#0f1419'] : ['#F8F9FA', '#E8EAF0']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#2A2E3F' : '#E0E3E9' }}
          >
            <View className="flex-1">
              <Text
                className="text-xl font-bold"
                style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
              >
                {getSeasonDisplayName(season)}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
              >
                Network Health & Insights
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
              <X size={24} color={isDarkMode ? '#8A8F9E' : '#6C7589'} />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row px-5 py-3 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;

              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id)}
                  className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: isActive ? (isDarkMode ? '#2A2E3F' : '#FFFFFF') : 'transparent',
                  }}
                >
                  <Icon size={16} color={isActive ? (isDarkMode ? '#F5F1E8' : '#2D3142') : (isDarkMode ? '#8A8F9E' : '#6C7589')} />
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: isActive ? (isDarkMode ? '#F5F1E8' : '#2D3142') : (isDarkMode ? '#8A8F9E' : '#6C7589'),
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1 px-5 py-4"
            showsVerticalScrollIndicator={false}
          >
            {currentTab === 'pulse' && (
              <PulseTabContent
                season={season}
                seasonData={seasonData}
                weeklyWeaves={weeklyWeaves}
                currentStreak={currentStreak}
                isDarkMode={isDarkMode}
              />
            )}

            {currentTab === 'health' && (
              <HealthTabContent isDarkMode={isDarkMode} />
            )}

            {currentTab === 'insights' && (
              <InsightsTabContent isDarkMode={isDarkMode} />
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

// ============================================
// PULSE TAB
// ============================================
function PulseTabContent({
  season,
  seasonData,
  weeklyWeaves,
  currentStreak,
  isDarkMode,
}: {
  season: SocialSeason;
  seasonData: SeasonExplanationData | null;
  weeklyWeaves: number;
  currentStreak: number;
  isDarkMode: boolean;
}) {
  const explanation = seasonData ? generateSeasonExplanation(seasonData) : null;

  return (
    <View className="gap-6">
      {/* Season Explanation */}
      {explanation && (
        <View
          className="p-5 rounded-2xl"
          style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
        >
          <Text
            className="text-lg font-bold mb-3"
            style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
          >
            {explanation.headline}
          </Text>

          {explanation.reasons.length > 0 && (
            <View className="mb-4">
              <Text
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_600SemiBold' }}
              >
                Based on:
              </Text>
              {explanation.reasons.map((reason, index) => (
                <View key={index} className="flex-row items-start gap-2 mb-1">
                  <Text
                    className="text-base"
                    style={{ color: isDarkMode ? '#A78BFA' : '#8B5CF6', fontFamily: 'Inter_600SemiBold' }}
                  >
                    •
                  </Text>
                  <Text
                    className="text-sm flex-1"
                    style={{ color: isDarkMode ? '#C5CAD3' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                  >
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View
            className="p-3 rounded-xl"
            style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#F8F9FA' }}
          >
            <Text
              className="text-sm leading-5"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_400Regular' }}
            >
              {explanation.insight}
            </Text>
          </View>
        </View>
      )}

      {/* This Week Stats */}
      <View
        className="p-5 rounded-2xl"
        style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
      >
        <Text
          className="text-lg font-bold mb-4"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          This Week
        </Text>

        <View className="flex-row gap-3">
          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#F8F9FA' }}>
            <Text
              className="text-2xl font-bold mb-1"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {weeklyWeaves}
            </Text>
            <Text
              className="text-xs"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Weaves
            </Text>
          </View>

          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#F8F9FA' }}>
            <Text
              className="text-2xl font-bold mb-1"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {currentStreak}
            </Text>
            <Text
              className="text-xs"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Day Streak
            </Text>
          </View>
        </View>
      </View>

      {/* Spacer */}
      <View className="h-8" />
    </View>
  );
}

// ============================================
// HEALTH TAB
// ============================================
function HealthTabContent({ isDarkMode }: { isDarkMode: boolean }) {
  const { portfolio } = usePortfolio();

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    return '#FF5722';
  };

  if (!portfolio) {
    return (
      <View className="gap-6">
        <View
          className="p-5 rounded-2xl items-center justify-center"
          style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF', minHeight: 200 }}
        >
          <Text className="text-4xl mb-3">📊</Text>
          <Text
            className="text-base font-semibold mb-2"
            style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_600SemiBold' }}
          >
            Loading Portfolio...
          </Text>
        </View>
      </View>
    );
  }

  const healthScore = Math.round(portfolio.overallHealthScore);

  return (
    <View className="gap-6">
      {/* Portfolio Health Card */}
      <View
        className="p-5 rounded-2xl"
        style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
      >
        <Text
          className="text-lg font-bold mb-4"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          Network Health
        </Text>

        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text
              className="text-5xl font-bold mb-1"
              style={{ color: getHealthColor(healthScore), fontFamily: 'Lora_700Bold' }}
            >
              {healthScore}
            </Text>
            <Text
              className="text-xs"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Health Score
            </Text>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${getHealthColor(80)}20` }}>
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: getHealthColor(80) }} />
              <Text className="text-xs" style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_500Medium' }}>
                Thriving: {portfolio.thrivingFriends}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: '#FF980020' }}>
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF9800' }} />
              <Text className="text-xs" style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_500Medium' }}>
                Drifting: {portfolio.driftingFriends}
              </Text>
            </View>
          </View>
        </View>

        <View className="h-px mb-3" style={{ backgroundColor: isDarkMode ? '#3A3E5F' : '#E5E7EB' }} />

        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-xl font-semibold" style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_600SemiBold' }}>
              {portfolio.recentActivityMetrics.totalInteractions}
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}>
              Last 30 Days
            </Text>
          </View>
          <View className="w-px h-10" style={{ backgroundColor: isDarkMode ? '#3A3E5F' : '#E5E7EB' }} />
          <View className="items-center">
            <Text className="text-xl font-semibold" style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_600SemiBold' }}>
              {Math.round(portfolio.recentActivityMetrics.diversityScore * 100)}%
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}>
              Diversity
            </Text>
          </View>
        </View>
      </View>

      {/* Tier Health Rings */}
      <TierHealthSection portfolio={portfolio} isDarkMode={isDarkMode} />

      {/* Spacer */}
      <View className="h-8" />
    </View>
  );
}

// ============================================
// TIER HEALTH SECTION
// ============================================
function TierHealthSection({ portfolio, isDarkMode }: { portfolio: any; isDarkMode: boolean }) {
  const size = Math.min(screenWidth - 80, 280);
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const tierData = portfolio.tierDistribution || [];
  const sortedTiers = [...tierData].sort((a: any, b: any) => {
    const order: Record<string, number> = { InnerCircle: 0, CloseFriends: 1, Community: 2 };
    return order[a.tier] - order[b.tier];
  });

  const tierColors: Record<string, string> = {
    InnerCircle: isDarkMode ? '#A56A43' : '#8B5A3C',
    CloseFriends: isDarkMode ? '#E58A57' : '#D97640',
    Community: isDarkMode ? '#6C8EAD' : '#5A7A9D',
  };

  const tierLabels: Record<string, string> = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
  };

  return (
    <View
      className="p-5 rounded-2xl"
      style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
    >
      <Text
        className="text-lg font-bold mb-4"
        style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
      >
        Tier Health
      </Text>

      <View className="items-center mb-5">
        <Svg width={size} height={size}>
          <Defs>
            {sortedTiers.map((tier: any) => (
              <SvgLinearGradient key={tier.tier} id={`grad-${tier.tier}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={tierColors[tier.tier]} stopOpacity="0.8" />
                <Stop offset="1" stopColor={tierColors[tier.tier]} stopOpacity="0.4" />
              </SvgLinearGradient>
            ))}
          </Defs>

          {/* Background circles */}
          {[1, 0.66, 0.33].map((scale, i) => (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={maxRadius * scale}
              stroke={isDarkMode ? '#3A3E5F' : '#E5E7EB'}
              strokeWidth="1"
              fill="none"
              opacity={0.3}
            />
          ))}

          {/* Tier rings */}
          {sortedTiers.map((tier: any, index: number) => {
            const radius = maxRadius * (1 - index * 0.33);
            const healthPercent = tier.avgScore / 100;
            const strokeWidth = 20;

            return (
              <G key={tier.tier}>
                {/* Background ring */}
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={isDarkMode ? '#1F2332' : '#F8F9FA'}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                {/* Health ring */}
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={`url(#grad-${tier.tier})`}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * radius * healthPercent} ${2 * Math.PI * radius}`}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${center}, ${center}`}
                />
              </G>
            );
          })}

          {/* Center score */}
          <SvgText
            x={center}
            y={center}
            fontSize="32"
            fill={isDarkMode ? '#F5F1E8' : '#2D3142'}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily="Lora_700Bold"
          >
            {Math.round(portfolio.overallHealthScore)}
          </SvgText>
        </Svg>
      </View>

      {/* Legend */}
      <View className="gap-2">
        {sortedTiers.map((tier: any) => {
          const totalFriends = sortedTiers.reduce((sum: number, t: any) => sum + t.count, 0);
          const percentage = totalFriends > 0 ? (tier.count / totalFriends) * 100 : 0;

          return (
            <View key={tier.tier} className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: tierColors[tier.tier] }} />
                <Text className="text-sm" style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_500Medium' }}>
                  {tierLabels[tier.tier]}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm" style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}>
                  {Math.round(tier.avgScore)}/100
                </Text>
                <Text className="text-xs" style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}>
                  ({tier.count})
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// INSIGHTS TAB
// ============================================
function InsightsTabContent({ isDarkMode }: { isDarkMode: boolean }) {
  return <GraphsTabContent />;
}
