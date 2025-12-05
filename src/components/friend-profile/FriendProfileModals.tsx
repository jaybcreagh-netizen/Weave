import React from 'react';
import { isFuture } from 'date-fns';
import { Interaction, InteractionCategory, Friend } from '@/components/types';
import { StructuredReflection } from '@/modules/interactions/types';
import { InteractionDetailModal } from '@/components/interaction-detail-modal';
import { EditReflectionModal } from '@/components/EditReflectionModal';
import { EditInteractionModal } from '@/components/EditInteractionModal';
import { PlanChoiceModal } from '@/components/PlanChoiceModal';
import { PlanWizard, PlanService } from '@/modules/interactions';
import { IntentionFormModal } from '@/components/IntentionFormModal';
import { IntentionsDrawer } from '@/components/IntentionsDrawer';
import { IntentionActionSheet } from '@/components/IntentionActionSheet';
import { LifeEventModal } from '@/components/LifeEventModal';
import FriendBadgePopup from '@/components/FriendBadgePopup';
import { TierFitBottomSheetWrapper } from './TierFitBottomSheetWrapper';
import { useFriendProfileModals } from '@/modules/relationships/hooks/useFriendProfileModals';

interface FriendProfileModalsProps {
    friend: Friend;
    modals: ReturnType<typeof useFriendProfileModals>;
    friendIntentions: any[]; // TODO: Type properly
    updateReflection: (id: string, reflection: StructuredReflection) => Promise<void>;
    updateInteraction: (id: string, updates: any) => Promise<void>; // Using any to avoid Model vs DTO conflicts
    createIntention: (friendIds: string[], description: string, category?: InteractionCategory) => Promise<void>;
    dismissIntention: (id: string) => Promise<void>;
    deleteWeave: (id: string) => Promise<void>;
    refreshLifeEvents: () => Promise<void>;
}

export function FriendProfileModals({
    friend,
    modals,
    friendIntentions,
    updateReflection,
    updateInteraction,
    createIntention,
    dismissIntention,
    deleteWeave,
    refreshLifeEvents,
}: FriendProfileModalsProps) {
    const {
        selectedInteraction,
        setSelectedInteraction,
        editingReflection,
        setEditingReflection,
        editingInteraction,
        setEditingInteraction,
        showPlanChoice,
        setShowPlanChoice,
        showPlanWizard,
        setShowPlanWizard,
        showIntentionForm,
        setShowIntentionForm,
        showIntentionsDrawer,
        setShowIntentionsDrawer,
        selectedIntentionForAction,
        setSelectedIntentionForAction,
        showLifeEventModal,
        setShowLifeEventModal,
        editingLifeEvent,
        setEditingLifeEvent,
        showBadgePopup,
        setShowBadgePopup,
        showTierFitSheet,
        setShowTierFitSheet,
        handleEditInteraction,
    } = modals;

    return (
        <>
            <InteractionDetailModal
                interaction={selectedInteraction as any}
                isOpen={selectedInteraction !== null}
                onClose={() => setSelectedInteraction(null)}
                friendName={friend.name}
                onEditReflection={(interaction) => {
                    setSelectedInteraction(null);
                    // Add delay to allow modal to close (iOS race condition)
                    setTimeout(() => {
                        setEditingReflection(interaction as any);
                    }, 500);
                }}
                onEdit={(id) => {
                    if (selectedInteraction && selectedInteraction.id === id) {
                        handleEditInteraction(selectedInteraction);
                    }
                }}
                onDelete={async (id) => {
                    await deleteWeave(id);
                    setSelectedInteraction(null);
                }}
            />

            <EditReflectionModal
                interaction={editingReflection as any}
                isOpen={editingReflection !== null}
                onClose={() => setEditingReflection(null)}
                onSave={updateReflection}
                friendArchetype={friend?.archetype as any}
            />

            <EditInteractionModal
                interaction={editingInteraction as any}
                isOpen={editingInteraction !== null && !isFuture(new Date(editingInteraction?.interactionDate || Date.now()))}
                onClose={() => setEditingInteraction(null)}
                onSave={updateInteraction as any}
            />

            <PlanChoiceModal
                isOpen={showPlanChoice}
                onClose={() => setShowPlanChoice(false)}
                onSetIntention={() => {
                    setShowPlanChoice(false);
                    setTimeout(() => {
                        setShowIntentionForm(true);
                    }, 500);
                }}
                onSchedulePlan={() => {
                    setShowPlanChoice(false);
                    setTimeout(() => {
                        if (friend) {
                            setShowPlanWizard(true);
                        }
                    }, 500);
                }}
            />

            {friend && (
                <PlanWizard
                    visible={showPlanWizard}
                    onClose={() => {
                        setShowPlanWizard(false);
                        setEditingInteraction(null);
                    }}
                    initialFriend={friend as any}
                    prefillData={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? {
                        date: new Date(editingInteraction.interactionDate),
                        category: (editingInteraction.interactionCategory || editingInteraction.activity) as InteractionCategory,
                        title: editingInteraction.title,
                        location: editingInteraction.location,
                    } : undefined}
                    replaceInteractionId={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? editingInteraction.id : undefined}
                    initialStep={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? 3 : 1}
                />
            )}

            <IntentionFormModal
                isOpen={showIntentionForm}
                friendName={friend.name}
                onClose={() => setShowIntentionForm(false)}
                onSave={async (description, category) => {
                    await createIntention(
                        [friend.id],
                        description || '',
                        category,
                    );
                }}
            />

            <IntentionsDrawer
                intentions={friendIntentions}
                isOpen={showIntentionsDrawer}
                onClose={() => setShowIntentionsDrawer(false)}
                onIntentionPress={(intention) => {
                    setSelectedIntentionForAction(intention as any);
                }}
            />

            <IntentionActionSheet
                intention={selectedIntentionForAction as any}
                isOpen={selectedIntentionForAction !== null}
                onClose={() => setSelectedIntentionForAction(null)}
                onSchedule={async (intention) => {
                    await PlanService.convertIntentionToPlan(intention.id);
                    setSelectedIntentionForAction(null);
                    setShowPlanWizard(true);
                }}
                onDismiss={async (intention) => {
                    await dismissIntention(intention.id);
                    setSelectedIntentionForAction(null);
                }}
            />

            <LifeEventModal
                visible={showLifeEventModal}
                onClose={() => {
                    setShowLifeEventModal(false);
                    setEditingLifeEvent(null);
                    refreshLifeEvents();
                }}
                friendId={friend.id}
                existingEvent={editingLifeEvent as any}
            />

            {friend && (
                <FriendBadgePopup
                    visible={showBadgePopup}
                    onClose={() => setShowBadgePopup(false)}
                    friendId={friend.id}
                    friendName={friend.name}
                />
            )}

            {friend && showTierFitSheet && (
                <TierFitBottomSheetWrapper
                    friendId={friend.id}
                    visible={showTierFitSheet}
                    onDismiss={() => setShowTierFitSheet(false)}
                />
            )}
        </>
    );
}
