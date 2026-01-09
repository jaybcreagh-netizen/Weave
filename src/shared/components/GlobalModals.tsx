import React, { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useUIStore } from '@/shared/stores/uiStore';
import { UIEventBus } from '@/shared/services/ui-event-bus';

import { MilestoneCelebration } from '@/modules/gamification';
import { TrophyCabinetModal } from '@/modules/gamification';
import { EventSuggestionModal, PlanWizard, usePlans, InteractionActions, PostWeaveRatingModal, BackgroundSuggestionFetcher } from '@/modules/interactions';
import { WeeklyReflectionModal, IntentionFormModal } from '@/modules/reflection';
import { SyncConflictModal, useAuth, SocialBatteryService } from '@/modules/auth';
import { MemoryMomentModal } from '@/modules/journal';
import { EveningCheckinSheet } from '@/modules/home';
import { EveningDigestChannel, EveningCheckinContent } from '@/modules/notifications';
import { OracleSheet } from '@/modules/oracle';

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

export function GlobalModals() {
    const { user } = useAuth();
    const [eveningCheckinContent, setEveningCheckinContent] = useState<EveningCheckinContent | null>(null);

    // Global Modal State
    const planWizardData = useUIStore((state) => state.planWizardData);
    const closePlanWizard = useUIStore((state) => state.closePlanWizard);
    const intentionFormData = useUIStore((state) => state.intentionFormData);
    const closeIntentionForm = useUIStore((state) => state.closeIntentionForm);
    const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
    const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);
    const isTrophyCabinetOpen = useUIStore((state) => state.isTrophyCabinetOpen);
    const closeTrophyCabinet = useUIStore((state) => state.closeTrophyCabinet);
    const isWeeklyReflectionOpen = useUIStore((state) => state.isWeeklyReflectionOpen);
    const closeWeeklyReflection = useUIStore((state) => state.closeWeeklyReflection);
    const memoryMomentData = useUIStore((state) => state.memoryMomentData);
    const digestSheetVisible = useUIStore((state) => state.digestSheetVisible);
    const digestItems = useUIStore((state) => state.digestItems);

    // Friend Models for Modals
    const [planWizardFriend, setPlanWizardFriend] = useState<FriendModel | null>(null);
    const [intentionFriend, setIntentionFriend] = useState<FriendModel | null>(null);

    // Fetch friend for Plan Wizard
    useEffect(() => {
        if (planWizardData?.friendId) {
            database.get<FriendModel>('friends').find(planWizardData.friendId)
                .then(setPlanWizardFriend)
                .catch(err => {
                    console.warn('[GlobalModals] Failed to find friend for PlanWizard:', err);
                    setPlanWizardFriend(null);
                });
        } else {
            setPlanWizardFriend(null);
        }
    }, [planWizardData?.friendId]);

    // Fetch friend for Intention Form
    useEffect(() => {
        if (intentionFormData?.friendId) {
            database.get<FriendModel>('friends').find(intentionFormData.friendId)
                .then(setIntentionFriend)
                .catch(err => {
                    console.warn('[GlobalModals] Failed to find friend for IntentionForm:', err);
                    setIntentionFriend(null);
                });
        } else {
            setIntentionFriend(null);
        }
    }, [intentionFormData?.friendId]);

    // Intention Save Handler
    const handleSaveIntention = useCallback(async (description: string | undefined, category?: any) => {
        if (intentionFormData?.friendId) {
            await InteractionActions.createIntention([intentionFormData.friendId], description, category);
            // We rely on observable updates, but closing is manual
            // IntentionFormModal calls onClose after this promise resolves, but we should close global state
        }
    }, [intentionFormData]);

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
                case 'SHARED_WEAVE_CONFIRMED':
                    // Celebration toast for shared weave mutual confirmation
                    useUIStore.getState().showToast(
                        `🎉 Weave confirmed with ${event.creatorName}!`,
                        'Shared'
                    );
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

            {/* Plan Wizard (Global) */}
            {planWizardFriend && (
                <PlanWizard
                    visible={!!planWizardData}
                    onClose={closePlanWizard}
                    initialFriend={planWizardFriend}
                    prefillData={planWizardData?.prefillData}
                />
            )}

            {/* Intention Form Modal (Global) */}
            {intentionFriend && (
                <IntentionFormModal
                    isOpen={!!intentionFormData}
                    friendName={intentionFriend.name}
                    onClose={closeIntentionForm}
                    onSave={handleSaveIntention}
                />
            )}

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

            {/* Performance Optimization: Keep suggestions fresh in background */}
            <BackgroundSuggestionFetcher />
        </>
    );
}
