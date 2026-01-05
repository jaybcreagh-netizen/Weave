import React, { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useUIStore } from '@/shared/stores/uiStore';
import { UIEventBus } from '@/shared/services/ui-event-bus';

import { MilestoneCelebration } from '@/modules/gamification';
import { TrophyCabinetModal } from '@/modules/gamification';
import { EventSuggestionModal } from '@/modules/interactions';
import { WeeklyReflectionModal } from '@/modules/reflection';
import { SyncConflictModal, useAuth, SocialBatteryService } from '@/modules/auth';
import { PostWeaveRatingModal } from '@/modules/interactions';
import { MemoryMomentModal } from '@/modules/journal';
import { EveningCheckinSheet } from '@/modules/home';
import { EveningDigestChannel, EveningCheckinContent } from '@/modules/notifications';
import { OracleSheet } from '@/modules/oracle';

export function GlobalModals() {
    const { user } = useAuth();
    const [eveningCheckinContent, setEveningCheckinContent] = useState<EveningCheckinContent | null>(null);

    // Subscribe to UIEventBus to handle events from non-React code (notifications, etc.)
    useEffect(() => {
        const unsubscribe = UIEventBus.subscribe((event) => {
            switch (event.type) {
                case 'OPEN_DIGEST_SHEET':
                    // Generate new content when opening
                    EveningDigestChannel.generateEveningCheckinContent()
                        .then(content => {
                            setEveningCheckinContent(content);
                            useUIStore.getState().openDigestSheet(event.items);
                        })
                        .catch(err => {
                            console.error('Error generating evening checkin content:', err);
                            useUIStore.getState().openDigestSheet(event.items);
                        });
                    break;
                case 'OPEN_WEEKLY_REFLECTION':
                    useUIStore.getState().openWeeklyReflection();
                    break;
                case 'OPEN_SOCIAL_BATTERY_SHEET':
                    useUIStore.getState().openSocialBatterySheet();
                    break;
                case 'OPEN_MEMORY_MOMENT':
                    useUIStore.getState().openMemoryMoment(event.data);
                    break;
                case 'SHOW_TOAST':
                    useUIStore.getState().showToast(event.message, event.friendName ?? '');
                    break;
                case 'FRIEND_NURTURED':
                    useUIStore.getState().setJustNurturedFriendId(event.friendId);
                    break;
            }
        });

        return unsubscribe;
    }, []);

    // Battery submit handler
    const handleBatterySubmit = useCallback(async (value: number, note?: string) => {
        if (user) {
            await SocialBatteryService.submitCheckin(user.id, value, note);
            // Refresh content to show battery completed
            const newContent = await EveningDigestChannel.generateEveningCheckinContent();
            setEveningCheckinContent(newContent);
        }
    }, [user]);

    const handleCloseEveningCheckin = useCallback(() => {
        useUIStore.getState().closeDigestSheet();
        setEveningCheckinContent(null);
    }, []);

    const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
    const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);
    const isTrophyCabinetOpen = useUIStore((state) => state.isTrophyCabinetOpen);
    const closeTrophyCabinet = useUIStore((state) => state.closeTrophyCabinet);
    const isWeeklyReflectionOpen = useUIStore((state) => state.isWeeklyReflectionOpen);
    const closeWeeklyReflection = useUIStore((state) => state.closeWeeklyReflection);
    const memoryMomentData = useUIStore((state) => state.memoryMomentData);
    const digestSheetVisible = useUIStore((state) => state.digestSheetVisible);
    const digestItems = useUIStore((state) => state.digestItems);

    return (
        <>
            {/* Global Milestone Celebration Modal */}
            <MilestoneCelebration
                visible={milestoneCelebrationData !== null}
                milestone={milestoneCelebrationData}
                onClose={hideMilestoneCelebration}
            />

            <TrophyCabinetModal
                visible={isTrophyCabinetOpen}
                onClose={closeTrophyCabinet}
            />

            {/* Global Event Suggestion Modal */}
            <EventSuggestionModal />

            {/* Weekly Reflection Modal */}
            <WeeklyReflectionModal
                isOpen={isWeeklyReflectionOpen}
                onClose={closeWeeklyReflection}
            />

            {/* Sync Conflict Modal */}
            <SyncConflictModal />

            {/* Post Weave Rating Modal */}
            <PostWeaveRatingModal />

            {/* Memory Moment Modal */}
            <MemoryMomentModal
                visible={!!memoryMomentData}
                onClose={() => useUIStore.getState().closeMemoryMoment()}
                memory={memoryMomentData?.memory || null}
                entry={memoryMomentData?.entry || null}
                friendName={memoryMomentData?.friendName}
                onReadEntry={() => {
                    const data = useUIStore.getState().memoryMomentData;
                    useUIStore.getState().closeMemoryMoment();

                    if (data?.memory?.relatedEntryId) {
                        router.push({
                            pathname: '/journal',
                            params: {
                                openEntryId: data.memory.relatedEntryId,
                                openEntryType: data.memory.type.includes('reflection') || data.memory.id.includes('reflection') ? 'reflection' : 'journal'
                            }
                        });
                    } else {
                        router.push('/journal');
                    }
                }}
                onWriteAbout={() => {
                    const data = useUIStore.getState().memoryMomentData;
                    useUIStore.getState().closeMemoryMoment();

                    if (data) {
                        router.push({
                            pathname: '/journal',
                            params: {
                                prefilledText: `Thinking about this memory: "${data.memory.title}"...\n\n`,
                                prefilledFriendIds: data.friendId ? [data.friendId] : undefined
                            }
                        });
                    } else {
                        router.push('/journal');
                    }
                }}
            />

            {/* Evening Check-in Sheet */}
            {eveningCheckinContent && (
                <EveningCheckinSheet
                    isVisible={digestSheetVisible}
                    onClose={handleCloseEveningCheckin}
                    content={eveningCheckinContent}
                    onBatterySubmit={handleBatterySubmit}
                />
            )}

            {/* Oracle Sheet */}
            <OracleSheet />
        </>
    );
}
