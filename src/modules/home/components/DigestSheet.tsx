import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, Sparkles, Clock, Moon } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { ListItem } from '@/shared/ui/ListItem';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { DigestItem } from '@/modules/notifications';
import { useRouter } from 'expo-router';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import { format } from 'date-fns';

interface DigestSheetProps {
    isVisible: boolean;
    onClose: () => void;
    items: DigestItem[];
}

export const DigestSheet: React.FC<DigestSheetProps> = ({
    isVisible,
    onClose,
    items,
}) => {
    const { tokens, typography, isDarkMode } = useTheme();
    const router = useRouter();
    const { openMemoryMoment } = useGlobalUI();

    const plans = items.filter(i => i.type === 'plan' || i.type === 'confirmation');
    const upcoming = items.filter(i => i.type === 'birthday' || i.type === 'life_event');
    const suggestions = items.filter(i => i.type === 'suggestion');
    // Memories (if ever added to digest)
    const memories = items.filter(i => i.type === 'memory');

    const handleAction = async (item: DigestItem) => {
        onClose();
        if (item.type === 'plan' || item.type === 'confirmation') {
            router.push('/dashboard');
        } else if (item.friendId) {
            router.push(`/friend-profile?friendId=${item.friendId}`);
        } else if (item.type === 'memory') {
            // Provide memory moment data if available?
            // item.data should contain memory details if we implemented memory in digest fully.
            // For now, assume it links to profile or journal
        }
    };

    const renderItem = (item: DigestItem, index: number, total: number) => (
        <View key={`${item.type}-${item.title}-${index}`} className="px-4">
            <ListItem
                title={item.title}
                subtitle={item.subtitle}
                showDivider={index < total - 1}
                compact
                trailing={
                    <Button
                        label="View"
                        variant="secondary"
                        size="sm"
                        className="h-8 py-1 px-3"
                        onPress={() => handleAction(item)}
                    />
                }
            />
        </View>
    );

    return (
        <AnimatedBottomSheet
            visible={isVisible}
            onClose={onClose}
            height="form"
            scrollable
        >
            <View className="flex-row justify-between items-start px-6 mb-6">
                <View>
                    <Text
                        className="text-[28px] mb-1"
                        style={{ color: tokens.foreground, fontFamily: typography.fonts.serifBold }}
                    >
                        Evening Check-in
                    </Text>
                    <Text
                        className="text-base"
                        style={{ color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }}
                    >
                        {format(new Date(), 'EEEE, MMMM d')}
                    </Text>
                </View>
            </View>

            <View className="px-5">
                {plans.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Plans" icon={<Clock size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {plans.map((item, i) => renderItem(item, i, plans.length))}
                        </Card>
                    </View>
                )}

                {upcoming.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Coming Up" icon={<Calendar size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {upcoming.map((item, i) => renderItem(item, i, upcoming.length))}
                        </Card>
                    </View>
                )}

                {suggestions.length > 0 && (
                    <View className="mb-6">
                        <WidgetHeader title="Suggestions" icon={<Sparkles size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {suggestions.map((item, i) => renderItem(item, i, suggestions.length))}
                        </Card>
                    </View>
                )}

                {items.length === 0 && (
                    <View className="items-center justify-center py-16 gap-4">
                        <Moon size={48} color={tokens.primaryMuted} />
                        <Text
                            className="text-xl"
                            style={{ color: tokens.foreground, fontFamily: typography.fonts.serifBold }}
                        >
                            All Quiet Tonight
                        </Text>
                        <Text
                            className="text-base text-center"
                            style={{ color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }}
                        >
                            No pending plans or urgent suggestions. Rest easy!
                        </Text>
                    </View>
                )}
            </View>
        </AnimatedBottomSheet>
    );
};

