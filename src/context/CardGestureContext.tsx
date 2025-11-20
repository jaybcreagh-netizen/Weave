import React, { createContext, useContext, useMemo } from 'react'; // Import useMemo
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS, measure } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useUIStore } from '../stores/uiStore';
import { useInteractions } from '@/modules/interactions';
import { database } from '../db';
import Friend from '../db/models/Friend';
import { type InteractionCategory } from '../components/types';
import { getTopActivities, isSmartDefaultsEnabled } from '@/modules/interactions/services/smart-defaults.service';

const MENU_RADIUS = 75; // Reduced for compact design
const HIGHLIGHT_THRESHOLD = 25; // Reduced from 30
const SELECTION_THRESHOLD = 40; // Reduced from 45

// NEW: 6 most common categories for quick-touch radial menu
const ACTIVITIES = [
  { id: 'text-call', icon: '📞', label: 'Call' },
  { id: 'meal-drink', icon: '🍽️', label: 'Meal' },
  { id: 'hangout', icon: '👥', label: 'Hang' },
  { id: 'deep-talk', icon: '💭', label: 'Talk' },
  { id: 'activity-hobby', icon: '🎨', label: 'Do' },
  { id: 'voice-note', icon: '🎤', label: 'Voice' },
];

const itemPositions = ACTIVITIES.map((_, i) => {
  const angle = (i / ACTIVITIES.length) * 2 * Math.PI - Math.PI / 2;
  return { x: MENU_RADIUS * Math.cos(angle), y: MENU_RADIUS * Math.sin(angle), angle };
});

interface CardGestureContextType {
  gesture: Gesture;
  animatedScrollHandler: any;
  activeCardId: Animated.SharedValue<string | null>;
  registerRef: (id: string, ref: React.RefObject<Animated.View>) => void;
  unregisterRef: (id: string) => void;
  dragX: Animated.SharedValue<number>;
  dragY: Animated.SharedValue<number>;
  highlightedIndex: Animated.SharedValue<number>;
}

const CardGestureContext = createContext<CardGestureContextType | null>(null);

export function CardGestureProvider({ children }: { children: React.ReactNode }) {
  const gestureCoordinator = useCardGestureCoordinator();
  return <CardGestureContext.Provider value={gestureCoordinator}>{children}</CardGestureContext.Provider>;
}

export function useCardGesture() {
  const context = useContext(CardGestureContext);
  if (!context) throw new Error('useCardGesture must be used within a CardGestureProvider');
  return context;
}

function useCardGestureCoordinator(): CardGestureContextType {
  const router = useRouter();
  const { openQuickWeave, closeQuickWeave, showToast, setJustNurturedFriendId, setSelectedFriendId, showMicroReflectionSheet, quickWeaveActivities } = useUIStore();
  const { logWeave } = useInteractions();

  const cardRefs = useSharedValue<Record<string, React.RefObject<Animated.View>>>({});
  const scrollOffset = useSharedValue(0);
  const activeCardId = useSharedValue<string | null>(null);
  const isLongPressActive = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const highlightedIndex = useSharedValue(-1);
  const startCoordinates = useSharedValue<{ x: number, y: number }>({ x: 0, y: 0 });

  const registerRef = (id: string, ref: React.RefObject<Animated.View>) => {
    'worklet';
    cardRefs.value[id] = ref;
  };

  const unregisterRef = (id: string) => {
    'worklet';
    delete cardRefs.value[id];
  };

  const animatedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollOffset.value = event.contentOffset.y; },
  });

  const handleInteractionSelection = async (selectedIndex: number, friendId: string) => {
    try {
      // Get the selected category from quickWeaveActivities
      const currentActivities = quickWeaveActivities.length > 0
        ? quickWeaveActivities
        : ACTIVITIES.map(a => a.id as InteractionCategory);

      if (selectedIndex >= currentActivities.length) {
        console.error('Invalid activity index:', selectedIndex);
        return;
      }

      const activityId = currentActivities[selectedIndex];

      // Get label from metadata
      const activityMetadata = ACTIVITIES.find(a => a.id === activityId);
      const activityLabel = activityMetadata?.label || activityId;

      await handleInteraction(activityId, activityLabel, friendId);
    } catch (error) {
      console.error('Error handling interaction selection:', error);
    }
  };

  const handleInteraction = async (activityId: string, activityLabel: string, friendId: string) => {
    const friend = await database.get<Friend>(Friend.table).find(friendId);
    if (!friend) return;

    // 1. Log the interaction and get the ID back
    const newInteraction = await logWeave({
      friendIds: [friendId],
      category: activityId as InteractionCategory,
      activity: activityId,
      notes: '',
      date: new Date(),
      type: 'log',
      status: 'completed',
      mode: 'quick-touch',
      vibe: null,
      duration: null,
    });

    // 2. Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 3. Show "just nurtured" glow
    setJustNurturedFriendId(friendId);

    // 4. Show toast
    showToast(activityLabel, friend.name);

    // 5. Trigger micro-reflection after short delay
    setTimeout(() => {
      showMicroReflectionSheet({
        friendId,
        friendName: friend.name,
        activityId,
        activityLabel,
        interactionId: newInteraction.id,
        friendArchetype: friend.archetype,
      });
    }, 200);
  };

  const handleTap = (friendId: string) => {
    setSelectedFriendId(friendId);
    router.push(`/friend-profile?friendId=${friendId}`);
  };

  const handleOpenQuickWeave = async (friendId: string, centerPoint: { x: number; y: number }) => {
    try {
      // Check if smart defaults are enabled
      const smartDefaultsEnabled = await isSmartDefaultsEnabled();

      let orderedActivities: InteractionCategory[];

      if (smartDefaultsEnabled) {
        // Fetch friend and calculate smart-ordered activities
        const friend = await database.get<Friend>(Friend.table).find(friendId);
        orderedActivities = await getTopActivities(friend, 6);
      } else {
        // Use fixed default ordering for muscle memory
        orderedActivities = ACTIVITIES.map(a => a.id as InteractionCategory);
      }

      // Open Quick Weave with ordered activities
      openQuickWeave(friendId, centerPoint, orderedActivities);
    } catch (error) {
      console.error('Error opening Quick Weave:', error);
      // Fallback to default ordering
      const defaultOrder = ACTIVITIES.map(a => a.id as InteractionCategory);
      openQuickWeave(friendId, centerPoint, defaultOrder);
    }
  };

  const findTargetCardId = (absoluteX: number, absoluteY: number) => {
    'worklet';
    const cardIds = Object.keys(cardRefs.value);
    for (const id of cardIds) {
      const ref = cardRefs.value[id];
      const measurement = measure(ref);
      if (measurement === null) continue;
      const { pageX: x, pageY: y, width, height } = measurement;
      if (absoluteX >= x && absoluteX <= x + width && absoluteY >= y && absoluteY <= y + height) {
        return id;
      }
    }
    return null;
  };

  // THE FIX: Wrap the entire gesture definition in useMemo to prevent re-creation on re-renders.
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(400) // Increased to 400ms for more reliable taps
      .onEnd((event, success) => {
        'worklet';
        if (success && !isLongPressActive.value) {
          const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
          if (targetId) {
            runOnJS(handleTap)(targetId);
          }
        }
      });

    const longPressAndDrag = Gesture.LongPress()
      .minDuration(400) // Aligned with tap maxDuration to prevent overlap
      .maxDistance(999999)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => {
        'worklet';
        // Store coordinates but don't set activeCardId yet
        const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
        if (targetId) {
          startCoordinates.value = { x: event.x, y: event.y };
        }
      })
      .onStart((event) => {
        'worklet';
        // Now set activeCardId when long press actually activates
        const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
        if (targetId) {
          activeCardId.value = targetId;
          isLongPressActive.value = true;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
          const centerPoint = {
            x: event.absoluteX,
            y: event.absoluteY, // Use absolute position since overlay is screen-positioned
          };
          runOnJS(handleOpenQuickWeave)(targetId, centerPoint);
        }
      })
      .onTouchesMove((event, state) => {
        'worklet';
        if (!isLongPressActive.value) return;

        const touch = event.changedTouches[0];
        const currentDragX = touch.x - startCoordinates.value.x;
        const currentDragY = touch.y - startCoordinates.value.y;
        
        dragX.value = currentDragX;
        dragY.value = currentDragY;

        const distance = Math.sqrt(currentDragX**2 + currentDragY**2);
        
        if (distance < HIGHLIGHT_THRESHOLD) {
          highlightedIndex.value = -1;
          return;
        }

        const angle = Math.atan2(currentDragY, currentDragX);
        let closestIndex = -1;
        let minAngleDiff = Infinity;

        for (let i = 0; i < itemPositions.length; i++) {
          const itemAngle = itemPositions[i].angle;
          const diff = Math.abs(angle - itemAngle);
          const normalizedDiff = Math.min(diff, 2 * Math.PI - diff);
          if (normalizedDiff < minAngleDiff) {
            minAngleDiff = normalizedDiff;
            closestIndex = i;
          }
        }
        
        if (highlightedIndex.value !== closestIndex) {
          highlightedIndex.value = closestIndex;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      })
      .onEnd((event, success) => {
        'worklet';
        if (isLongPressActive.value) {
          // Close the overlay first
          runOnJS(closeQuickWeave)();

          const distance = Math.sqrt(dragX.value**2 + dragY.value**2);
          if (distance >= SELECTION_THRESHOLD && highlightedIndex.value !== -1 && activeCardId.value) {
            // Process interaction selection after overlay closes
            const selectedIndex = highlightedIndex.value;
            const friendId = activeCardId.value;
            runOnJS(handleInteractionSelection)(selectedIndex, friendId);
          }
        }

        // Reset all state immediately - always, regardless of gesture state
        isLongPressActive.value = false;
        activeCardId.value = null;
        dragX.value = 0;
        dragY.value = 0;
        highlightedIndex.value = -1;
      })
      .onFinalize(() => {
        'worklet';
        // Final cleanup to ensure card scale resets - extra safety
        activeCardId.value = null;
        isLongPressActive.value = false;
        dragX.value = 0;
        dragY.value = 0;
        highlightedIndex.value = -1;
      });

    return Gesture.Exclusive(tap, longPressAndDrag);
  }, []); // Empty dependency array means this runs only once.

  return { gesture, animatedScrollHandler, activeCardId, registerRef, unregisterRef, dragX, dragY, highlightedIndex };
}