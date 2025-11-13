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
import { X, Activity, BarChart3 } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { type SocialSeason, type SeasonExplanationData } from '../../lib/social-season/season-types';
import { SEASON_STYLES, getSeasonDisplayName } from '../../lib/social-season/season-content';
import { generateSeasonExplanation } from '../../lib/narrative-generator';
import { GraphsTabContent } from '../YearInMoons/GraphsTabContent';

interface SocialSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: SocialSeason;
  seasonData: SeasonExplanationData | null;
  weeklyWeaves: number;
  currentStreak: number;
  networkHealth: number;
}

type Tab = 'pulse' | 'insights';

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
        colors={isDarkMode ? ['#1a1d2e', '#0f1419'] : ['#FAF1E0', '#F3EAD8']}
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
                    backgroundColor: isActive ? (isDarkMode ? '#2A2E3F' : '#FFF8ED') : 'transparent',
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
          style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
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
            style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}
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
        style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
      >
        <Text
          className="text-lg font-bold mb-4"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          This Week
        </Text>

        <View className="flex-row gap-3">
          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
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

          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
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
// INSIGHTS TAB
// ============================================
function InsightsTabContent({ isDarkMode }: { isDarkMode: boolean }) {
  return <GraphsTabContent />;
}
