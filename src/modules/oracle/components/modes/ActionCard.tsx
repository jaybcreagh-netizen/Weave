import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { SmartAction } from '@/modules/oracle/services/types';

interface ActionCardProps {
    action: SmartAction;
    onExecute: (action: SmartAction) => void;
    index: number;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onExecute, index }) => {
    const { colors } = useTheme();

    const getIconName = (type: SmartAction['type']) => {
        switch (type) {
            case 'mimic_plan':
            case 'schedule_event': return 'Calendar';
            case 'create_intention': return 'Sparkles';
            case 'reach_out': return 'Heart';
            case 'update_profile': return 'UserPlus';
            default: return 'Check';
        }
    };

    const getDescription = (action: SmartAction) => {
        const { data } = action;
        if (action.type === 'schedule_event' && data.activity) return `Plan ${data.activity}`;
        if (action.type === 'mimic_plan' && data.activity) return `Do ${data.activity} again`;
        if (action.type === 'reach_out' && data.friendId) return `Reconnect with friend`;
        if (data.note) return data.note;
        return action.label;
    }

    return (
        <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
            <Card className="mb-3 p-4 border border-border bg-surface">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 mr-4">
                        <View className="p-2 rounded-full bg-primary/10 mr-3">
                            <Icon name={getIconName(action.type)} size={20} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text variant="h4" className="text-foreground font-medium mb-1">
                                {action.label}
                            </Text>
                            <Text variant="caption" className="text-muted-foreground">
                                {getDescription(action)}
                            </Text>
                        </View>
                    </View>

                    <Button
                        label="Execute"
                        size="sm"
                        variant="outline"
                        onPress={() => onExecute(action)}
                    />
                </View>
            </Card>
        </Animated.View>
    );
};
