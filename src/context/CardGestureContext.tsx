import React, { createContext, useContext, useMemo } from 'react'; // Import useMemo
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS, measure } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useUIStore } from '../stores/uiStore';
import { useInteractionStore } from '../stores/interactionStore';
import { database } from '../db';
import Friend from '../db/models/Friend';
import { type InteractionCategory } from '../components/types';

const MENU_RADIUS = 100;
const HIGHLIGHT_THRESHOLD = 30;
const SELECTION_THRESHOLD = 45;

// NEW: 6 most common categories for quick-touch radial menu
const ACTIVITIES = [
  { id: 'text-call', icon: '💬', label: 'Text/Call' },
  { id: 'meal-drink', icon: '🍽️', label: 'Meal/Drink' },
  { id: 'hangout', icon: '🏠', label: 'Hangout' },
  { id: 'deep-talk', icon: '💭', label: 'Deep Talk' },
  { id: 'activity-hobby', icon: '🎨', label: 'Activity' },
  { id: 'event-party', icon: '🎉', label: 'Event' },
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
  const { openQuickWeave, closeQuickWeave, showToast, setJustNurturedFriendId, setSelectedFriendId, showMicroReflectionSheet } = useUIStore();
  const { addInteraction } = useInteractionStore();

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

  const handleInteraction = async (activityId: string, activityLabel: string, friendId: string) => {
    const friend = await database.get<Friend>(Friend.table).find(friendId);
    if (!friend) return;

    // 1. Log the interaction and get the ID back
    const interactionId = await addInteraction({
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
        interactionId,
        friendArchetype: friend.archetype,
      });
    }, 200);
  };

  const handleTap = (friendId: string) => {
    setSelectedFriendId(friendId);
    router.push(`/friend-profile?friendId=${friendId}`);
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
      .maxDuration(300) // Increased to 300ms to catch slower taps
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
      .minDuration(350) // Increased to 350ms to avoid overlap, still feels snappy
      .maxDistance(999999)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => {
        'worklet';
        const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
        if (targetId) {
          activeCardId.value = targetId;
          startCoordinates.value = { x: event.x, y: event.y };
        }
      })
      .onStart((event) => {
        'worklet';
        if (activeCardId.value) {
          isLongPressActive.value = true;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
          const centerPoint = {
            x: event.absoluteX,
            y: event.absoluteY - scrollOffset.value,
          };
          runOnJS(openQuickWeave)(activeCardId.value, centerPoint);
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
          const distance = Math.sqrt(dragX.value**2 + dragY.value**2);
          if (distance >= SELECTION_THRESHOLD && highlightedIndex.value !== -1 && activeCardId.value) {
            const selectedActivity = ACTIVITIES[highlightedIndex.value];
            runOnJS(handleInteraction)(selectedActivity.id, selectedActivity.label, activeCardId.value);
          }
          runOnJS(closeQuickWeave)();
        }

        // Reset all state immediately
        isLongPressActive.value = false;
        activeCardId.value = null;
        dragX.value = 0;
        dragY.value = 0;
        highlightedIndex.value = -1;
      })
      .onFinalize(() => {
        'worklet';
        // Final cleanup to ensure card scale resets
        activeCardId.value = null;
        isLongPressActive.value = false;
      });

    return Gesture.Exclusive(tap, longPressAndDrag);
  }, []); // Empty dependency array means this runs only once.

  return { gesture, animatedScrollHandler, activeCardId, registerRef, unregisterRef, dragX, dragY, highlightedIndex };
}