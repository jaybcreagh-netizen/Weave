import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Sparkles, BookOpen } from 'lucide-react-native';
import { Card } from '@/shared/ui/Card';
import { narrativeService } from '@/modules/intelligence/services/NarrativeService';
import FriendshipNarrative from '@/db/models/FriendshipNarrative';
import withObservables from '@nozbe/with-observables';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { map } from 'rxjs/operators';
import { CollapsibleSection } from '@/shared/ui/CollapsibleSection';

interface Props {
    friendId: string;
    narrative?: FriendshipNarrative | null;
}

const FriendshipStoryView: React.FC<Props> = ({ friendId, narrative }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            await narrativeService.generateNarrativeText(friendId);
        } catch (e) {
            console.error('Failed to generate story', e);
        } finally {
            setLoading(false);
        }
    };

    if (!narrative || !narrative.generatedNarrativeJson) {
        return (
            <Card className="mb-4 px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 opacity-80">
                        <BookOpen size={16} color={colors.primary} />
                        <Text className="text-sm font-medium" style={{ color: colors.foreground }}>
                            Your Friendship Story
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleGenerate}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                                Generate
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </Card>
        );
    }

    const { text: storyText } = narrative.generatedNarrative || {};

    return (
        <View className="mb-2">
            <CollapsibleSection
                title="Friendship Story"
                icon={BookOpen}
            >
                <Card className="px-4 py-3 bg-muted/30 border-0">
                    <Text className="text-sm italic leading-6" style={{ color: colors.foreground }}>
                        {storyText}
                    </Text>
                    <View className="flex-row justify-end mt-2">
                        <TouchableOpacity onPress={handleGenerate} disabled={loading} className="flex-row items-center gap-1 opacity-70">
                            <Sparkles size={12} color={colors.primary} />
                            <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                                {loading ? 'Updating...' : 'Refresh'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Card>
            </CollapsibleSection>
        </View>
    );
};

const enhance = withObservables(['friendId'], ({ friendId }) => ({
    narrative: database.get<FriendshipNarrative>('friendship_narratives')
        .query(Q.where('friend_id', friendId)).observe().pipe(map(records => records[0] || null)),
}));

export default enhance(FriendshipStoryView);
