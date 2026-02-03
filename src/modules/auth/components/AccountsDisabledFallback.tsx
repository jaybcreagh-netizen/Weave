import React from 'react';
import { View } from 'react-native';

import { Button } from '@/shared/ui/Button';
import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';

interface AccountsDisabledFallbackProps {
    title?: string;
    description?: string;
    ctaLabel?: string;
    onPress: () => void;
}

export function AccountsDisabledFallback({
    title = 'Accounts are unavailable in this build',
    description = 'You can keep using Weave in local-only mode.',
    ctaLabel = 'Continue',
    onPress,
}: AccountsDisabledFallbackProps) {
    const { colors } = useTheme();

    return (
        <View
            style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
                gap: 16,
                backgroundColor: colors.background,
            }}
        >
            <Text variant="h3" align="center">
                {title}
            </Text>
            <Text variant="body" color="muted" align="center">
                {description}
            </Text>
            <Button
                variant="primary"
                label={ctaLabel}
                onPress={onPress}
                style={{ marginTop: 8, minWidth: 180 }}
            />
        </View>
    );
}

