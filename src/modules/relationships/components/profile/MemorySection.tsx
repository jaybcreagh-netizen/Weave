import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Plus } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendMemory, { FriendMemoryType } from '@/db/models/FriendMemory';
import FriendMemoryCandidate from '@/db/models/FriendMemoryCandidate';

interface MemorySectionProps {
    memories: FriendMemory[];
    memoryCandidates?: FriendMemoryCandidate[];
    onAdd: () => void;
    onEdit: (memory: FriendMemory) => void;
    onApproveCandidate?: (candidate: FriendMemoryCandidate) => void;
    onDismissCandidate?: (candidate: FriendMemoryCandidate) => void;
    onEditCandidate?: (candidate: FriendMemoryCandidate) => void;
}

type MemoryFilter = 'all' | FriendMemoryType;

const TYPE_LABELS: Record<FriendMemoryType, string> = {
    interest: 'Interest',
    preference: 'Preference',
    upcoming: 'Upcoming',
    milestone: 'Milestone',
    activity_win: 'Activity Win',
    avoid: 'Avoid',
    context: 'Context',
    general: 'General',
};

const SOURCE_LABELS: Record<string, string> = {
    manual: 'Manual',
    journal_ai: 'Journal',
    oracle_action: 'Oracle',
    imported: 'Imported',
};

function getExpiryLabel(expiresAt?: number): string | null {
    if (typeof expiresAt !== 'number') return null;
    const daysRemaining = Math.ceil((expiresAt - Date.now()) / 86400000);
    if (daysRemaining < 0) return 'Expired';
    if (daysRemaining === 0) return 'Expires today';
    if (daysRemaining === 1) return 'Expires tomorrow';
    if (daysRemaining <= 14) return `Expires in ${daysRemaining}d`;
    return null;
}

export function MemorySection({
    memories,
    memoryCandidates = [],
    onAdd,
    onEdit,
    onApproveCandidate,
    onDismissCandidate,
    onEditCandidate,
}: MemorySectionProps) {
    const { colors } = useTheme();
    const [activeFilter, setActiveFilter] = useState<MemoryFilter>('all');

    const availableFilters = useMemo<FriendMemoryType[]>(() => {
        const typeSet = new Set<FriendMemoryType>();
        memories.forEach(memory => typeSet.add(memory.type));
        return Array.from(typeSet);
    }, [memories]);

    const filteredMemories = useMemo(() => {
        if (activeFilter === 'all') return memories;
        return memories.filter(memory => memory.type === activeFilter);
    }, [activeFilter, memories]);

    return (
        <View className="px-5">
            <View className="mt-2 mb-2">
                <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-lora-bold text-[15px]" style={{ color: colors.foreground }}>
                        Memory
                    </Text>
                    <TouchableOpacity
                        onPress={onAdd}
                        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Plus size={14} color={colors.primary} />
                        <Text className="font-inter-semibold text-xs" style={{ color: colors.primary }}>Add</Text>
                    </TouchableOpacity>
                </View>

                {memoryCandidates.length > 0 && (
                    <View className="mb-3 p-2.5 rounded-xl" style={{ backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}33` }}>
                        <View className="flex-row items-center justify-between mb-1.5">
                            <Text className="font-inter-semibold text-[12px]" style={{ color: colors.primary }}>
                                Suggested from Journal
                            </Text>
                            <Text className="font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                                {memoryCandidates.length} pending
                            </Text>
                        </View>
                        <View className="gap-2">
                            {memoryCandidates.slice(0, 4).map((candidate) => (
                                <View
                                    key={candidate.id}
                                    className="p-2 rounded-lg"
                                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Text className="font-inter-semibold text-[12px] mb-0.5" style={{ color: colors.foreground }} numberOfLines={1}>
                                        {candidate.title}
                                    </Text>
                                    <Text className="font-inter-regular text-[11px] mb-1.5" style={{ color: colors['muted-foreground'] }} numberOfLines={2}>
                                        {candidate.content}
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        <TouchableOpacity
                                            onPress={() => onApproveCandidate?.(candidate)}
                                            className="px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: `${colors.primary}20` }}
                                        >
                                            <Text className="font-inter-semibold text-[11px]" style={{ color: colors.primary }}>
                                                Approve
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => onEditCandidate?.(candidate)}
                                            className="px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: colors.muted }}
                                        >
                                            <Text className="font-inter-semibold text-[11px]" style={{ color: colors.foreground }}>
                                                Edit
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => onDismissCandidate?.(candidate)}
                                            className="px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: colors.muted }}
                                        >
                                            <Text className="font-inter-semibold text-[11px]" style={{ color: colors['muted-foreground'] }}>
                                                Dismiss
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {availableFilters.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingVertical: 2 }}
                        className="mb-2"
                    >
                        <View className="flex-row gap-2">
                            <TouchableOpacity
                                onPress={() => setActiveFilter('all')}
                                className="px-3 py-1.5 rounded-full"
                                style={{
                                    backgroundColor: activeFilter === 'all' ? `${colors.primary}22` : colors.muted,
                                    borderWidth: activeFilter === 'all' ? 1 : 0,
                                    borderColor: `${colors.primary}66`,
                                }}
                            >
                                <Text
                                    className="font-inter-semibold text-xs"
                                    style={{ color: activeFilter === 'all' ? colors.primary : colors['muted-foreground'] }}
                                >
                                    All
                                </Text>
                            </TouchableOpacity>
                            {availableFilters.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setActiveFilter(type)}
                                    className="px-3 py-1.5 rounded-full"
                                    style={{
                                        backgroundColor: activeFilter === type ? `${colors.primary}22` : colors.muted,
                                        borderWidth: activeFilter === type ? 1 : 0,
                                        borderColor: `${colors.primary}66`,
                                    }}
                                >
                                    <Text
                                        className="font-inter-semibold text-xs"
                                        style={{ color: activeFilter === type ? colors.primary : colors['muted-foreground'] }}
                                    >
                                        {TYPE_LABELS[type]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                )}

                {filteredMemories.length > 0 ? (
                    <View className="gap-1.5">
                        {filteredMemories.map((memory) => (
                            <TouchableOpacity
                                key={memory.id}
                                onPress={() => onEdit(memory)}
                                className="p-3 rounded-xl"
                                style={{
                                    backgroundColor: colors.muted,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Text
                                    className="font-inter-semibold text-[13px] mb-1"
                                    style={{ color: colors.foreground }}
                                    numberOfLines={1}
                                >
                                    {memory.title}
                                </Text>
                                <Text
                                    className="font-inter-regular text-[12px] mb-2"
                                    style={{ color: colors['muted-foreground'] }}
                                    numberOfLines={2}
                                >
                                    {memory.content}
                                </Text>
                                {memory.tags.length > 0 && (
                                    <View className="mb-2 flex-row flex-wrap gap-1.5">
                                        {memory.tags.slice(0, 4).map(tag => (
                                            <View
                                                key={`${memory.id}-${tag}`}
                                                className="rounded-full px-2 py-0.5"
                                                style={{ backgroundColor: `${colors.primary}12`, borderWidth: 1, borderColor: `${colors.primary}33` }}
                                            >
                                                <Text className="font-inter-medium text-[10px]" style={{ color: colors.primary }}>
                                                    #{tag}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {getExpiryLabel(memory.expiresAt) && (
                                    <View className="mb-2 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}33` }}>
                                        <Text className="font-inter-medium text-[10px]" style={{ color: colors.primary }}>
                                            {getExpiryLabel(memory.expiresAt)}
                                        </Text>
                                    </View>
                                )}
                                <View className="flex-row items-center justify-between">
                                    <Text className="font-inter-medium text-[10px]" style={{ color: colors.primary }}>
                                        {TYPE_LABELS[memory.type]} • {SOURCE_LABELS[memory.source] || 'Memory'}
                                    </Text>
                                    <Text className="font-inter-regular text-[10px]" style={{ color: colors['muted-foreground'] }}>
                                        {formatDistanceToNow(memory.updatedAt, { addSuffix: true })}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <Text
                        className="text-[13px] italic"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        No memories yet. Add things this friend cares about, upcoming plans, or useful context.
                    </Text>
                )}
            </View>
        </View>
    );
}
