
import React from 'react';
import { View, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { Text } from './Text';
import { useTheme } from '@/shared/hooks/useTheme';
import { LucideIcon } from 'lucide-react-native';

interface TutorialAlertProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message: string;
    buttonText?: string;
    icon?: React.ReactNode;
}

export const TutorialAlert: React.FC<TutorialAlertProps> = ({
    visible,
    onClose,
    title,
    message,
    buttonText = "Got it",
    icon
}) => {
    const { isDarkMode, colors } = useTheme();

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <BlurView
                intensity={20}
                tint={isDarkMode ? 'dark' : 'light'}
                className="flex-1 justify-center items-center px-6"
            >
                <TouchableOpacity
                    activeOpacity={1}
                    className="absolute inset-0 bg-black/40"
                    onPress={onClose}
                />

                <Animated.View
                    entering={FadeInUp.springify().damping(15)}
                    exiting={FadeOutDown.duration(200)}
                    className="w-full max-w-sm rounded-[32px] overflow-hidden p-6 items-center"
                    style={{
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.25,
                        shadowRadius: 20,
                        elevation: 10,
                    }}
                >
                    {icon && (
                        <View className="mb-4 p-4 rounded-full bg-primary/10 items-center justify-center">
                            {icon}
                        </View>
                    )}

                    <Text
                        variant="h3"
                        className="text-center mb-2 font-lora-bold text-2xl"
                    >
                        {title}
                    </Text>

                    <Text
                        className="text-center mb-8 text-muted-foreground leading-relaxed"
                    >
                        {message}
                    </Text>

                    <TouchableOpacity
                        onPress={onClose}
                        className="w-full py-4 rounded-2xl bg-primary items-center justify-center active:opacity-90"
                        style={{
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4
                        }}
                    >
                        <Text className="font-inter-bold text-base text-primary-foreground">
                            {buttonText}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </BlurView>
        </Modal>
    );
};
