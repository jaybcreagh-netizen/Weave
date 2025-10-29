import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Users, Settings } from 'lucide-react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { SettingsModal } from '../../src/components/settings-modal';
import { SocialBatterySheet } from '../../src/components/home/SocialBatterySheet';
import { useUserProfileStore } from '../../src/stores/userProfileStore';
import HomeScreen from '../home';
import FriendsScreen from '../friends';

const { width: screenWidth } = Dimensions.get('window');

export default function TabsLayout() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'insights' | 'circle'>('insights');
  const [showSettings, setShowSettings] = useState(false);
  const [showBatterySheet, setShowBatterySheet] = useState(false);
  const { submitBatteryCheckin } = useUserProfileStore();
  const scrollViewRef = useRef<ScrollView>(null);

  const handleTabPress = (tab: 'insights' | 'circle') => {
    setActiveTab(tab);
    const index = tab === 'insights' ? 0 : 1;
    scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    const newTab = slide === 0 ? 'insights' : 'circle';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: 'transparent', borderBottomColor: colors.border }]}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
            onPress={() => handleTabPress('insights')}
          >
            <Sparkles
              size={24}
              color={activeTab === 'insights' ? colors.primary : colors['muted-foreground']}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'insights' ? colors.primary : colors['muted-foreground'] },
              ]}
            >
              Insights
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'circle' && styles.activeTab]}
            onPress={() => handleTabPress('circle')}
          >
            <Users
              size={24}
              color={activeTab === 'circle' ? colors.primary : colors['muted-foreground']}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'circle' ? colors.primary : colors['muted-foreground'] },
              ]}
            >
              Circle
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings Button */}
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
          <Settings size={24} color={colors['muted-foreground']} />
        </TouchableOpacity>
      </View>

      {/* Swipeable Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        <View style={{ width: screenWidth }}>
          <HomeScreen />
        </View>
        <View style={{ width: screenWidth }}>
          <FriendsScreen />
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenBatteryCheckIn={() => setShowBatterySheet(true)}
      />

      {/* Battery Check-in Sheet */}
      <SocialBatterySheet
        isVisible={showBatterySheet}
        onSubmit={async (value, note) => {
          await submitBatteryCheckin(value, note);
          setShowBatterySheet(false);
        }}
        onDismiss={() => setShowBatterySheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  tabsContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent', // Will be set via theme
  },
  tabLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  settingsButton: {
    padding: 12,
  },
  scrollView: {
    flex: 1,
  },
});
