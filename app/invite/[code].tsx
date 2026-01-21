import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUIStore } from '@/shared/stores/uiStore';
import { useTheme } from '@/shared/hooks/useTheme';

export default function InviteDeepLink() {
    const { code } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const openClaimInviteSheet = useUIStore(state => state.openClaimInviteSheet);

    useEffect(() => {
        if (code) {
            // Wait a tick to ensure navigation is ready/stable
            const timer = setTimeout(() => {
                const codeString = Array.isArray(code) ? code[0] : code;
                console.log('[InviteDeepLink] Opening with code:', codeString);

                // 1. Open the sheet globally
                openClaimInviteSheet(codeString);

                // 2. Redirect to dashboard (or wherever the sheet is hosted)
                // We replace to avoid going "back" to this loading screen
                router.replace('/dashboard');
            }, 100);

            return () => clearTimeout(timer);
        } else {
            router.replace('/dashboard');
        }
    }, [code]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}
