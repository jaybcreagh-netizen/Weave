import React from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native';
import { X, Moon, Sun, Palette, RefreshCw } from 'lucide-react-native';
import { theme } from '../theme';
import { clearDatabase } from '../db';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  darkMode,
  onToggleDarkMode,
}: SettingsModalProps) {
  const insets = useSafeAreaInsets();

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

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(181, 138, 108, 0.1)'}]}>
                <Palette color={theme.colors.primary} size={20} />
              </View>
              <Text style={styles.headerTitle}>Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <X color={theme.colors['muted-foreground']} size={20} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 24 }}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.muted }]}>
                  {darkMode ? (
                    <Moon color={theme.colors.foreground} size={20} />
                  ) : (
                    <Sun color={theme.colors.foreground} size={20} />
                  )}
                </View>
                <View>
                  <Text style={styles.settingLabel}>{darkMode ? "Dark Theme" : "Light Theme"}</Text>
                  <Text style={styles.settingDescription}>{darkMode ? "Mystic arcane theme" : "Warm cream theme"}</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={onToggleDarkMode}
                trackColor={{ false: "#767577", true: theme.colors.primary }}
                thumbColor={darkMode ? "#f4f3f4" : "#f4f3f4"}
              />
            </View>

            <View style={[styles.settingRow, styles.topBorder]}>
              <View style={styles.settingLabelContainer}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <RefreshCw color={theme.colors.destructive} size={20} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Reset Database</Text>
                  <Text style={styles.settingDescription}>Clear all data and start fresh</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleResetDatabase} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.footer, styles.topBorder]}>
            <Text style={styles.footerText}>
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
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    modalContainer: {
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
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
        marginBottom: 24,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
        color: theme.colors.foreground,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.foreground,
    },
    settingDescription: {
        fontSize: 14,
        color: theme.colors['muted-foreground'],
    },
    topBorder: {
        paddingTop: 24,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
    },
    resetButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    resetButtonText: {
        color: theme.colors.destructive,
    },
    footer: {
        marginTop: 32,
        paddingTop: 24,
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
        color: theme.colors['muted-foreground'],
    }
});