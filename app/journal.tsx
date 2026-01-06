import React, { useState, Suspense, lazy } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { JournalHome } from '@/modules/journal/components';
import { useOracleSheet } from '@/modules/oracle';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { database } from '@/db';
import { useTheme } from '@/shared/hooks/useTheme';

// Lazy load modals - they're not needed until user opens them
const QuickCaptureSheet = lazy(() =>
    import('@/modules/journal/components/QuickCaptureSheet').then(m => ({ default: m.QuickCaptureSheet }))
);
const GuidedReflectionModal = lazy(() =>
    import('@/modules/journal/components/GuidedReflectionModal').then(m => ({ default: m.GuidedReflectionModal }))
);
const FriendshipArcView = lazy(() =>
    import('@/modules/journal/components/FriendshipArcView').then(m => ({ default: m.FriendshipArcView }))
);
const JournalEntryModal = lazy(() =>
    import('@/modules/journal/components/JournalEntryModal').then(m => ({ default: m.JournalEntryModal }))
);
const JournalEntryDetailSheet = lazy(() =>
    import('@/modules/journal/components/JournalEntryDetailSheet').then(m => ({ default: m.JournalEntryDetailSheet }))
);
const WeeklyReflectionDetailModal = lazy(() =>
    import('@/modules/reflection').then(m => ({ default: m.WeeklyReflectionDetailModal }))
);
const LifeEventModal = lazy(() =>
    import('@/modules/relationships/components/LifeEventModal').then(m => ({ default: m.LifeEventModal }))
);
const NudgesSheetWrapper = lazy(() =>
    import('@/modules/oracle').then(m => ({ default: m.NudgesSheetWrapper }))
);

export default function JournalScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{
        mode?: string;
        friendId?: string;
        weaveId?: string;
        openEntryId?: string;
        openEntryType?: string;
        prefilledText?: string;
        prefilledFriendIds?: string;
        initialTab?: string;
        context?: string;
    }>();

    const [showQuickCapture, setShowQuickCapture] = useState(false);
    const [showGuided, setShowGuided] = useState(params.mode === 'guided');
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(params.friendId || null);
    const [prefilledText, setPrefilledText] = useState<string>('');
    const [prefilledFriendIds, setPrefilledFriendIds] = useState<string[]>([]);

    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
    const [selectedReflection, setSelectedReflection] = useState<WeeklyReflection | null>(null);

    const [showLifeEvent, setShowLifeEvent] = useState(false);
    const [lifeEventFriendId, setLifeEventFriendId] = useState<string | null>(null);
    const [showNudgeSheet, setShowNudgeSheet] = useState(false);

    const { open: openOracle } = useOracleSheet();

    // Deep link handling
    React.useEffect(() => {
        const handleDeepLink = async () => {
            if (params.openEntryId) {
                try {
                    if (params.openEntryType === 'reflection') {
                        const reflection = await database.get<WeeklyReflection>('weekly_reflections').find(params.openEntryId);
                        setSelectedReflection(reflection);
                    } else {
                        const entry = await database.get<JournalEntry>('journal_entries').find(params.openEntryId);
                        setViewingEntry(entry);
                    }
                } catch (error) {
                    console.error('Error opening linked entry:', error);
                }
            }

            if (params.mode === 'guided') {
                if (params.prefilledText) {
                    setPrefilledText(params.prefilledText);
                }
                if (params.prefilledFriendIds) {
                    setPrefilledFriendIds(params.prefilledFriendIds.split(',').filter(Boolean));
                }
                setShowGuided(true);
            }
        };

        handleDeepLink();
    }, [params.openEntryId, params.mode]);

    const handleArcEntryPress = async (id: string, type: 'journal' | 'reflection') => {
        try {
            if (type === 'journal') {
                const entry = await database.get<JournalEntry>('journal_entries').find(id);
                setViewingEntry(entry);
            } else if (type === 'reflection') {
                const reflection = await database.get<WeeklyReflection>('weekly_reflections').find(id);
                setSelectedReflection(reflection);
            }
        } catch (error) {
            console.error('Error fetching entry:', error);
        }
    };

    // Minimal fallback for lazy components
    const LazyFallback = null;

    return (
        <>
            {selectedFriendId ? (
                <Suspense fallback={<View className="flex-1" style={{ backgroundColor: colors.background }} />}>
                    <FriendshipArcView
                        friendId={selectedFriendId}
                        onBack={() => {
                            if (params.friendId) {
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/');
                                }
                            } else {
                                setSelectedFriendId(null);
                            }
                        }}
                        onEntryPress={handleArcEntryPress}
                        onWriteAbout={(friendId, friendName) => {
                            setPrefilledFriendIds([friendId]);
                            setSelectedFriendId(null);
                            setShowGuided(true);
                        }}
                    />
                </Suspense>
            ) : (
                <JournalHome
                    initialTab={params.initialTab as any}
                    onClose={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/');
                        }
                    }}
                    onNewEntry={(mode) => {
                        if (mode === 'quick') setShowQuickCapture(true);
                        else setShowGuided(true);
                    }}
                    onEntryPress={(entry) => {
                        if ('weekStartDate' in entry) {
                            setSelectedReflection(entry as WeeklyReflection);
                        } else {
                            setViewingEntry(entry as JournalEntry);
                        }
                    }}
                    onFriendArcPress={(friendId) => {
                        setSelectedFriendId(friendId);
                    }}
                    onMemoryAction={async (memory) => {
                        const { getMemoryForNotification } = require('@/modules/journal/services/journal-context-engine');
                        const { UIEventBus } = await import('@/shared/services/ui-event-bus');

                        const type = memory.id.includes('reflection') ? 'reflection' : 'journal';
                        const data = await getMemoryForNotification(memory.relatedEntryId!, type);

                        if (data) {
                            UIEventBus.emit({ type: 'OPEN_MEMORY_MOMENT', data });
                        }
                    }}
                />
            )}

            {/* Lazy-loaded modals - only load when needed */}
            <Suspense fallback={LazyFallback}>
                {showQuickCapture && (
                    <QuickCaptureSheet
                        visible={showQuickCapture}
                        onClose={() => setShowQuickCapture(false)}
                        onExpandToFull={(text, friendIds) => {
                            setPrefilledText(text);
                            setPrefilledFriendIds(friendIds);
                            setShowQuickCapture(false);
                            setTimeout(() => {
                                setShowGuided(true);
                            }, 500);
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={LazyFallback}>
                {showGuided && (
                    <GuidedReflectionModal
                        visible={showGuided}
                        onClose={() => {
                            setShowGuided(false);
                            setPrefilledText('');
                            setPrefilledFriendIds([]);
                        }}
                        onSave={(entry) => {
                            console.log('Saved:', entry);
                        }}
                        prefilledWeaveId={params.weaveId}
                        prefilledText={prefilledText}
                        prefilledFriendIds={prefilledFriendIds}
                    />
                )}
            </Suspense>

            <Suspense fallback={LazyFallback}>
                {!!viewingEntry && (
                    <JournalEntryDetailSheet
                        isOpen={!!viewingEntry}
                        onClose={() => setViewingEntry(null)}
                        entry={viewingEntry}
                        onEdit={(entry) => {
                            setViewingEntry(null);
                            setTimeout(() => setSelectedEntry(entry), 100);
                        }}
                        onDelete={() => {
                            setViewingEntry(null);
                        }}
                        onMimicWeave={(friendIds, options) => {
                            setViewingEntry(null);
                            router.push({
                                pathname: '/weave-logger',
                                params: {
                                    friendId: friendIds[0],
                                    date: options?.date,
                                    category: options?.category,
                                }
                            });
                        }}
                        onReflect={(entry, suggestion) => {
                            setViewingEntry(null);
                            openOracle({
                                context: 'journal',
                                initialQuestion: suggestion?.initialQuestion,
                                journalContent: entry.content,
                                lensContext: suggestion ? {
                                    archetype: suggestion.archetype,
                                    title: suggestion.title,
                                    reasoning: suggestion.reasoning
                                } : undefined
                            });
                        }}
                        onCreateLifeEvent={(friendId) => {
                            setViewingEntry(null);
                            setLifeEventFriendId(friendId);
                            setShowLifeEvent(true);
                        }}
                        onReachOut={async (friendId) => {
                            setViewingEntry(null);
                            try {
                                const friend = await database.get<any>('friends').find(friendId);

                                if (!friend.phoneNumber && !friend.email) {
                                    router.push({
                                        pathname: '/weave-logger',
                                        params: {
                                            friendId: friend.id,
                                        }
                                    });
                                } else {
                                    const { messagingService } = await import('@/modules/messaging/services/messaging.service');
                                    await messagingService.reachOut({
                                        friendId: friend.id,
                                        friendName: friend.name,
                                        phoneNumber: friend.phoneNumber,
                                        email: friend.email,
                                        contextMessage: "Hey! Thinking of you."
                                    });
                                }
                            } catch (error) {
                                console.error('Error reaching out:', error);
                            }
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={LazyFallback}>
                {!!selectedEntry && (
                    <JournalEntryModal
                        isOpen={!!selectedEntry}
                        onClose={() => setSelectedEntry(null)}
                        entry={selectedEntry}
                        onSave={() => {
                            setSelectedEntry(null);
                        }}
                        onDelete={() => {
                            setSelectedEntry(null);
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={LazyFallback}>
                {showLifeEvent && (
                    <LifeEventModal
                        visible={showLifeEvent}
                        onClose={() => setShowLifeEvent(false)}
                        friendId={lifeEventFriendId || ''}
                    />
                )}
            </Suspense>

            <Suspense fallback={LazyFallback}>
                {showNudgeSheet && (
                    <NudgesSheetWrapper
                        isVisible={showNudgeSheet}
                        onClose={() => setShowNudgeSheet(false)}
                    />
                )}
            </Suspense>

            <Suspense fallback={LazyFallback}>
                {!!selectedReflection && (
                    <WeeklyReflectionDetailModal
                        isOpen={!!selectedReflection}
                        onClose={() => setSelectedReflection(null)}
                        reflection={selectedReflection}
                    />
                )}
            </Suspense>
        </>
    );
}
