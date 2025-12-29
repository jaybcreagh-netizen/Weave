import React from 'react';
import { View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Search, Link } from 'lucide-react-native';
import { Text } from '@/shared/ui';
import { CachedImage } from '@/shared/ui/CachedImage';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveUserSearchResult } from '../services/friend-linking.service';

interface UserSearchListProps {
    results: WeaveUserSearchResult[];
    loading: boolean;
    searchQuery: string;
    actionLabel: string;
    onAction: (user: WeaveUserSearchResult) => void;
    renderActionIcon?: (color: string) => React.ReactNode;
    isActionLoading?: (userId: string) => boolean;
    isActionDisabled?: (userId: string) => boolean;
    getActionLabel?: (userId: string) => string; // Optional override for dynamic labels (e.g. "Added")
    emptyStateTitle: string;
    emptyStateSubtitle: string;
    noResultsText?: string;
    onAddManually?: () => void;
}

export function UserSearchList({
    results,
    loading,
    searchQuery,
    actionLabel,
    onAction,
    renderActionIcon,
    isActionLoading,
    isActionDisabled,
    getActionLabel,
    emptyStateTitle,
    emptyStateSubtitle,
    noResultsText,
    onAddManually
}: UserSearchListProps) {
    const { colors } = useTheme();

    const renderItem = ({ item }: { item: WeaveUserSearchResult }) => {
        const isLoading = isActionLoading?.(item.id) ?? false;
        const isDisabled = isActionDisabled?.(item.id) ?? false;
        const label = getActionLabel?.(item.id) ?? actionLabel;

        return (
            <View
                className="flex-row items-center p-3 rounded-xl mb-2"
                style={{ backgroundColor: colors.card }}
            >
                {/* Profile Photo */}
                {item.photoUrl ? (
                    <CachedImage
                        source={{ uri: item.photoUrl }}
                        style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                ) : (
                    <View
                        className="w-12 h-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text className="text-lg font-bold" style={{ color: colors['muted-foreground'] }}>
                            {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* User Info */}
                <View className="flex-1 ml-3">
                    <Text className="font-semibold" style={{ color: colors.foreground }}>
                        {item.displayName}
                    </Text>
                    <Text className="text-sm" style={{ color: colors['muted-foreground'] }}>
                        @{item.username}
                    </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    className="px-4 py-2 rounded-lg flex-row items-center gap-2"
                    style={{
                        backgroundColor: isDisabled && !isLoading ? colors.muted : (isDisabled ? colors.primary : colors.primary), // Adjust style logic as needed, using primary for loading usually
                        opacity: isLoading || (isDisabled && !getActionLabel) ? 0.5 : 1 // Simple opacity rule
                    }}
                    onPress={() => onAction(item)}
                    disabled={isLoading || isDisabled}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors['primary-foreground']} />
                    ) : (
                        <>
                            {renderActionIcon && renderActionIcon(isDisabled && !isLoading ? colors['muted-foreground'] : colors['primary-foreground'])}
                            <Text
                                className="font-medium"
                                style={{
                                    color: isDisabled && !isLoading ? colors['muted-foreground'] : colors['primary-foreground']
                                }}
                            >
                                {label}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (results.length > 0) {
        return (
            <FlatList
                data={results}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
            />
        );
    }

    if (searchQuery.length >= 2) {
        return (
            <View className="flex-1 items-center justify-center">
                <Link size={40} color={colors['muted-foreground']} />
                <Text className="text-center mt-3" style={{ color: colors['muted-foreground'] }}>
                    {noResultsText || `No users found matching "${searchQuery}"`}
                </Text>
            </View>
        );
    }

    return (
        <View className="flex-1 items-center justify-center">
            <Search size={40} color={colors['muted-foreground']} />
            <Text className="text-center mt-3" style={{ color: colors['muted-foreground'] }}>
                {emptyStateTitle}
            </Text>
            <Text className="text-center text-sm mt-1" style={{ color: colors['muted-foreground'] }}>
                {emptyStateSubtitle}
            </Text>

            {/* Manual fallback */}
            {onAddManually && (
                <>
                    <View className="flex-row items-center gap-3 mt-6 mb-2">
                        <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
                        <Text className="text-xs" style={{ color: colors['muted-foreground'] }}>or</Text>
                        <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
                    </View>
                    <TouchableOpacity
                        className="py-2"
                        onPress={onAddManually}
                    >
                        <Text className="text-center" style={{ color: colors.primary }}>
                            + Add manually without searching
                        </Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}
