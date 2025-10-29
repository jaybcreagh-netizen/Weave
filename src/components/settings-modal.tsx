import React from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native';
import { X, Moon, Sun, Palette, RefreshCw, Bug, BarChart3 } from 'lucide-react-native';
import { getThemeColors, spacing } from '../theme'; // Import getThemeColors and spacing
import { clearDatabase } from '../db';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../stores/uiStore'; // Import useUIStore
import { getSuggestionAnalytics } from '../lib/suggestion-tracker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleDarkMode, showDebugScore, toggleShowDebugScore } = useUIStore(); // Get store values
  const themeColors = getThemeColors(isDarkMode); // Get current theme colors

  const handleResetDatabase = () => {
    Alert.alert(
      "Reset Database",
      "Are you sure? This will delete all your friends and interactions. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await clearDatabase();
              onClose();
            } catch (error) {
              console.error('Failed to clear database:', error);
              Alert.alert('Error', 'Failed to clear database.');
            }
          },
        },
      ]
    );
  };

  const handleViewAnalytics = async () => {
    try {
      const analytics = await getSuggestionAnalytics();

      const typeBreakdown = Object.entries(analytics.byType)
        .map(([type, stats]) => `${type}: ${stats.acted}/${stats.shown} (${stats.conversionRate}%)`)
        .join('\n');

      Alert.alert(
        "📊 Suggestion Analytics",
        `Total shown: ${analytics.totalShown}\n` +
        `Total acted: ${analytics.totalActed}\n` +
        `Total dismissed: ${analytics.totalDismissed}\n` +
        `Conversion rate: ${analytics.conversionRate}%\n` +
        `Avg time to action: ${analytics.avgTimeToActionMinutes} min\n\n` +
        `By Type:\n${typeBreakdown || 'No data yet'}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error('Failed to get analytics:', error);
      Alert.alert('Error', 'Failed to load analytics.');
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)' }]}>
        <View style={[styles.modalContainer, {
          paddingBottom: insets.bottom + spacing.lg,
          backgroundColor: isDarkMode ? themeColors.background : '#F7F5F2',
          borderColor: themeColors.border
        }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.iconContainer, { backgroundColor: themeColors.muted }]}>
                <Palette color={themeColors.primary} size={20} />
              </View>
              <Text style={[styles.headerTitle, { color: themeColors.foreground }]}>Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: spacing.sm }}>
              <X color={themeColors['muted-foreground']} size={20} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: spacing.lg }}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <View style={[styles.iconContainer, { backgroundColor: themeColors.muted }]}>
                  {isDarkMode ? (
                    <Moon color={themeColors.foreground} size={20} />
                  ) : (
                    <Sun color={themeColors.foreground} size={20} />
                  )}
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: themeColors.foreground }]}>{isDarkMode ? "Dark Theme" : "Light Theme"}</Text>
                  <Text style={[styles.settingDescription, { color: themeColors['muted-foreground'] }]}>{isDarkMode ? "Mystic arcane theme" : "Warm cream theme"}</Text>
                </View>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: themeColors.muted, true: themeColors.primary }}
                thumbColor={themeColors.card}
              />
            </View>

            {/* START: New Debug Setting */}
            <View style={[styles.settingRow, styles.topBorder, { borderColor: themeColors.border }]}>
              <View style={styles.settingLabelContainer}>
                <View style={[styles.iconContainer, { backgroundColor: themeColors.muted }]}>
                  <Bug color={themeColors.foreground} size={20} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: themeColors.foreground }]}>Show Weave Score</Text>
                  <Text style={[styles.settingDescription, { color: themeColors['muted-foreground'] }]}>Display score for debugging</Text>
                </View>
              </View>
              <Switch
                value={showDebugScore}
                onValueChange={toggleShowDebugScore}
                trackColor={{ false: themeColors.muted, true: themeColors.primary }}
                thumbColor={themeColors.card}
              />
            </View>
            {/* END: New Debug Setting */}

            <TouchableOpacity
              style={[styles.settingRow, styles.topBorder, { borderColor: themeColors.border }]}
              onPress={handleViewAnalytics}
            >
              <View style={styles.settingLabelContainer}>
                <View style={[styles.iconContainer, { backgroundColor: themeColors.muted }]}>
                  <BarChart3 color={themeColors.foreground} size={20} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: themeColors.foreground }]}>Suggestion Analytics</Text>
                  <Text style={[styles.settingDescription, { color: themeColors['muted-foreground'] }]}>View tracking data</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={[styles.settingRow, styles.topBorder, { borderColor: themeColors.border }]}>
              <View style={styles.settingLabelContainer}>
                <View style={[styles.iconContainer, { backgroundColor: themeColors.destructive + '1A' }]}>
                  <RefreshCw color={themeColors.destructive} size={20} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: themeColors.foreground }]}>Reset Database</Text>
                  <Text style={[styles.settingDescription, { color: themeColors['muted-foreground'] }]}>Clear all data and start fresh</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleResetDatabase} style={[styles.resetButton, { borderColor: themeColors.destructive + '33' }]}>
                <Text style={[styles.resetButtonText, { color: themeColors.destructive }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.footer, styles.topBorder, { borderColor: themeColors.border }]}>
            <Text style={[styles.footerText, { color: themeColors['muted-foreground'] }]}>
              Weave • Social Relationship Management
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        borderTopWidth: 1,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    settingDescription: {
        fontSize: 14,
    },
    topBorder: {
        paddingTop: spacing.lg,
        borderTopWidth: 1,
    },
    resetButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: spacing.sm,
        borderWidth: 1,
    },
    resetButtonText: {
        // color will be set dynamically
    },
    footer: {
        marginTop: spacing.xl,
        paddingTop: spacing.lg,
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
    }
});