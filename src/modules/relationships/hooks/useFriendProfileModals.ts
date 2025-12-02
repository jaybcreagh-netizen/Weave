import { useState, useCallback } from 'react';
import { Interaction, LifeEvent, Intention } from '@/components/types';
import { isFuture } from 'date-fns';

export function useFriendProfileModals() {
    const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
    const [editingReflection, setEditingReflection] = useState<Interaction | null>(null);
    const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
    const [showPlanChoice, setShowPlanChoice] = useState(false);
    const [showPlanWizard, setShowPlanWizard] = useState(false);
    const [showIntentionForm, setShowIntentionForm] = useState(false);
    const [showIntentionsDrawer, setShowIntentionsDrawer] = useState(false);
    const [selectedIntentionForAction, setSelectedIntentionForAction] = useState<Intention | null>(null);
    const [showLifeEventModal, setShowLifeEventModal] = useState(false);
    const [editingLifeEvent, setEditingLifeEvent] = useState<LifeEvent | null>(null);
    const [showBadgePopup, setShowBadgePopup] = useState(false);
    const [showTierFitSheet, setShowTierFitSheet] = useState(false);

    const resetModals = useCallback(() => {
        setSelectedInteraction(null);
        setEditingReflection(null);
        setEditingInteraction(null);
        setShowPlanChoice(false);
        setShowPlanWizard(false);
        setShowIntentionForm(false);
        setShowIntentionsDrawer(false);
        setSelectedIntentionForAction(null);
        setShowLifeEventModal(false);
        setEditingLifeEvent(null);
        setShowBadgePopup(false);
        setShowTierFitSheet(false);
    }, []);

    const handleEditInteraction = useCallback((interaction: Interaction) => {
        // Add a small delay to allow the detail modal to close first (iOS race condition)
        setTimeout(() => {
            // Check if this is a future planned weave
            const interactionDate = new Date(interaction.interactionDate);
            if (isFuture(interactionDate)) {
                // Open PlanWizard for future interactions
                setEditingInteraction(interaction);
                setShowPlanWizard(true);
            } else {
                // Open EditInteractionModal for past/completed interactions
                setEditingInteraction(interaction);
            }
        }, 500);
    }, []);

    return {
        // State
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

        // Actions
        resetModals,
        handleEditInteraction,
    };
}
