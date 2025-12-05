// app/tier-balance.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { TierBalanceContent } from '@/components/TierBalanceContent';

/**
 * Full-screen tier balance view
 * Shows network health and all tier suggestions
 */
export default function TierBalanceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color={colors['muted-foreground']} />
          <Text style={[styles.backText, { color: colors['muted-foreground'] }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tier Balance</Text>
        <View style={{ width: 60 }} />
      </View>

      <TierBalanceContent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
});

