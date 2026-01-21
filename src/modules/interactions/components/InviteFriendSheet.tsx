import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Share } from 'react-native';
import { Text, Button, Icon } from '@/shared/ui';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { generateInviteCode } from '../services/invite.service';

interface InviteFriendSheetProps {
    visible: boolean;
    onClose: () => void;
    weaveId?: string;
    friendName: string;
    friendLocalId: string;
    weaveSnapshot?: any;
}

export const InviteFriendSheet: React.FC<InviteFriendSheetProps> = ({
    visible, // ...
    onClose,
    weaveId,
    friendName,
    friendLocalId,
    weaveSnapshot,
}) => {
    const [code, setCode] = useState<string | null>(null);
    const [link, setLink] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ...

    useEffect(() => {
        if (visible) {
            setCode(null);
            setLink(null);
            setIsLoading(false);
            setError(null);
            generateInvite();
        }
    }, [visible]);

    const generateInvite = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await generateInviteCode(friendLocalId, friendName, undefined, weaveSnapshot);

            if (result) {
                setCode(result.code);
                setLink(result.link);
            } else {
                throw new Error('No invite code returned');
            }
        } catch (err: any) {
            console.error('Error generating invite:', err);
            setError(err.message || 'Failed to generate invite');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!link) return;

        try {
            let message = '';
            if (weaveId) {
                message = `Hey ${friendName}! Join me on Weave to plan our hangout. Tap here to join: ${link}`;
            } else {
                message = `Hey ${friendName}! Let's connect on Weave. Tap here to add me: ${link}`;
            }

            await Share.share({
                message,
                url: link, // iOS often uses this field for better presentation
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title={`Invite ${friendName}`}
            snapPoints={['45%'] as any}
        >
            <View className="flex-1 px-6 pt-2 pb-8 items-center justify-between">

                {/* Header / Intro */}
                <View className="items-center w-full space-y-4">
                    <Text variant="body" className="text-center text-gray-500 mb-2">
                        Share this code with {friendName} to add them to this Weave. When they join, they'll see all the details instantly.
                    </Text>

                    {/* Code Display Area */}
                    <View className="w-full">
                        {isLoading ? (
                            <View className="h-32 w-full bg-gray-50 dark:bg-gray-800 rounded-2xl items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <ActivityIndicator size="small" color="#6B7280" />
                                <Text variant="caption" className="text-gray-400 mt-2">Generating...</Text>
                            </View>
                        ) : error ? (
                            <View className="h-32 w-full bg-red-50 dark:bg-red-900/20 rounded-2xl items-center justify-center px-4">
                                <Text variant="caption" className="text-red-500 text-center">{error}</Text>
                                <Button
                                    label="Try Again"
                                    variant="ghost"
                                    size="sm"
                                    onPress={generateInvite}
                                    className="mt-2"
                                />
                            </View>
                        ) : (
                            <View className="flex-col items-center w-full space-y-3">
                                <View className="h-32 w-full bg-secondary/10 rounded-2xl items-center justify-center border border-secondary/20 relative overflow-hidden">
                                    {/* Background pattern could go here */}
                                    <Text variant="h1" className="text-4xl font-bold tracking-widest text-primary font-serif">
                                        {code}
                                    </Text>
                                    <Text variant="caption" className="text-gray-400 mt-1 uppercase tracking-wider text-[10px]">
                                        Invite Code
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="w-full space-y-3 safe-mb">
                    <Button
                        label="Share Invite"
                        onPress={handleShare}
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={!code || isLoading}
                        icon={<Icon name="Share" size={18} color="white" />}
                    />
                    <Button
                        label="Done"
                        onPress={onClose}
                        variant="ghost"
                        fullWidth
                    />
                </View>
            </View>
        </StandardBottomSheet>
    );
};
