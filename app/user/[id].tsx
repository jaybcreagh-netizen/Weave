import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUIStore } from '@/shared/stores/uiStore';
import { useTheme } from '@/shared/hooks/useTheme';

export default function UserDeepLink() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const openAddUserSheet = useUIStore(state => state.openAddUserSheet);

    useEffect(() => {
        if (id) {
            // Wait a tick to ensure navigation is ready/stable
            const timer = setTimeout(() => {
                const userId = Array.isArray(id) ? id[0] : id;
                console.log('[UserDeepLink] Opening for user:', userId);

                // 1. Open the sheet globally
                openAddUserSheet(userId);

                // 2. Redirect to dashboard
                router.replace('/(tabs)/dashboard');
            }, 100);

            return () => clearTimeout(timer);
        } else {
            router.replace('/(tabs)/dashboard');
        }
    }, [id]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}
