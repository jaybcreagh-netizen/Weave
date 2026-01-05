import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/ui/Button';
import { Sparkles } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface OracleSummaryStepProps {
    narrative: string | null;
    onContinue: () => void;
}

export const OracleSummaryStep: React.FC<OracleSummaryStepProps> = ({ narrative, onContinue }) => {
    const { tokens, typography } = useTheme();
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [hasConsented, setHasConsented] = useState(false);

    useEffect(() => {
        if (!hasConsented || !narrative) return;

        setDisplayedText('');
        setIsComplete(false); // Reset complete state

        let index = 0;
        const interval = setInterval(() => {
            if (index < narrative.length) {
                setDisplayedText(prev => prev + narrative.charAt(index));
                index++;
            } else {
                clearInterval(interval);
                setIsComplete(true);
            }
        }, 5); // Faster animation (5ms)

        return () => clearInterval(interval);
    }, [narrative, hasConsented]);

    if (!hasConsented) {
        return (
            <View className="flex-1 justify-center items-center px-6">
                <Animated.View entering={FadeInUp.springify()}>
                    <Sparkles size={48} color={tokens.primary} style={{ marginBottom: 24, alignSelf: 'center' }} />
                </Animated.View>

                <Text
                    className="text-center text-xl font-medium mb-4"
                    style={{ color: tokens.foreground, fontFamily: typography.fonts.serifBold }}
                >
                    The Oracle awaits...
                </Text>

                <Text
                    className="text-center text-base mb-12 text-muted-foreground"
                    style={{ fontFamily: typography.fonts.sans }}
                >
                    Would you like to receive an insight about your week?
                </Text>

                <View className="w-full gap-3">
                    <Button
                        label="Consult the Oracle"
                        onPress={() => setHasConsented(true)}
                        className="w-full"
                    />
                    <Button
                        label="Skip"
                        variant="ghost"
                        onPress={onContinue}
                        className="w-full"
                    />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 justify-center items-center px-6">
            <Animated.View entering={FadeInUp.springify()}>
                <Sparkles size={48} color={tokens.primary} style={{ marginBottom: 24, alignSelf: 'center' }} />
            </Animated.View>

            <Text
                className="text-center text-xl leading-8 mb-12"
                style={{
                    color: tokens.foreground,
                    fontFamily: typography.fonts.serif
                }}
            >
                {narrative ? displayedText : "Consulting the stars..."}
            </Text>

            {isComplete && (
                <Animated.View entering={FadeInUp.springify()} className="w-full">
                    <Button
                        label="Continue"
                        onPress={onContinue}
                        className="w-full"
                    />
                </Animated.View>
            )}
        </View>
    );
};
