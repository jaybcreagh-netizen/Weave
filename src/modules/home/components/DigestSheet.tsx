import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Calendar, Sparkles, Clock, Moon } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { ListItem } from '@/shared/ui/ListItem';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { DigestItem, EveningDigestChannel } from '@/modules/notifications';
import { useRouter } from 'expo-router';
import { useUIStore } from '@/shared/stores/uiStore';
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
    const { openMemoryMoment } = useUIStore();

    const plans = items.filter(i => i.type === 'plan' || i.type === 'confirmation');
    const upcoming = items.filter(i => i.type === 'birthday' || i.type === 'life_event');
    const suggestions = items.filter(i => i.type === 'suggestion');
    // Memories (if ever added to digest)
    const memories = items.filter(i => i.type === 'memory');

    const handleAction = async (item: DigestItem) => {
        onClose();
        if (item.type === 'plan' || item.type === 'confirmation') {
            // Navigate to where? Maybe just open focus detail sheet for confirmation?
            // Or navigate to a specific interaction if possible.
            // For now, let's open FocusDetailSheet by triggering Today's Focus Widget opening logic?
            // Actually, `TodaysFocusWidgetV2` logic handles confirmation inside `FocusDetailSheet`.
            // Ideally we confirm directly or open a dedicated view.
            // Requirement says "navigate to plan detail or confirm flow".
            // Since we don't have a standalone plan detail screen easily accessible,
            // we will navigate to dashboard where Focus widget is.
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
        <View key={`${item.type}-${item.title}-${index}`} style={{ paddingHorizontal: 16 }}>
            <ListItem
                title={item.title}
                subtitle={item.subtitle}
                showDivider={index < total - 1}
                compact
                trailing={
                    <Button
                        label="View"
                        variant="secondary"
                        size="small"
                        style={{ height: 32, paddingVertical: 4, paddingHorizontal: 12 }}
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
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: tokens.foreground, fontFamily: typography.fonts.serifBold }]}>
                        Evening Check-in
                    </Text>
                    <Text style={[styles.subtitle, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }]}>
                        {format(new Date(), 'EEEE, MMMM d')}
                    </Text>
                </View>
            </View>

            <View style={{ paddingHorizontal: 20 }}>
                {plans.length > 0 && (
                    <View style={styles.section}>
                        <WidgetHeader title="Plans" icon={<Clock size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {plans.map((item, i) => renderItem(item, i, plans.length))}
                        </Card>
                    </View>
                )}

                {upcoming.length > 0 && (
                    <View style={styles.section}>
                        <WidgetHeader title="Coming Up" icon={<Calendar size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {upcoming.map((item, i) => renderItem(item, i, upcoming.length))}
                        </Card>
                    </View>
                )}

                {suggestions.length > 0 && (
                    <View style={styles.section}>
                        <WidgetHeader title="Suggestions" icon={<Sparkles size={20} color={tokens.primaryMuted} />} />
                        <Card padding="none">
                            {suggestions.map((item, i) => renderItem(item, i, suggestions.length))}
                        </Card>
                    </View>
                )}

                {items.length === 0 && (
                    <View style={styles.emptyState}>
                        <Moon size={48} color={tokens.primaryMuted} />
                        <Text style={[styles.emptyTitle, { color: tokens.foreground, fontFamily: typography.fonts.serifBold }]}>
                            All Quiet Tonight
                        </Text>
                        <Text style={[styles.emptyText, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }]}>
                            No pending plans or urgent suggestions. Rest easy!
                        </Text>
                    </View>
                )}
            </View>
        </AnimatedBottomSheet>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%',
        paddingTop: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
    },
    closeButton: {
        padding: 4,
        marginTop: 4,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 20,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
});
