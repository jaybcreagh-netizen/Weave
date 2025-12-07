import React, { createContext, useContext, useMemo, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS, measure } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { useQuickWeave } from '@/modules/interactions/hooks/useQuickWeave';
import { itemPositions, HIGHLIGHT_THRESHOLD, SELECTION_THRESHOLD } from '@/modules/interactions/constants';

interface CardGestureContextType {
  gesture: any; // Using any to avoid complex Gesture type issues
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
  const { handleInteractionSelection, handleOpenQuickWeave, handleTap, closeQuickWeave } = useQuickWeave();

  // Create refs to hold the latest version of the handlers
  // This prevents the stale closure issue where the gesture (which is memoized once)
  // holds onto the *initial* version of these functions (and thus the initial activities list/state).
  const interactionSelectionRef = useRef(handleInteractionSelection);
  const openQuickWeaveRef = useRef(handleOpenQuickWeave);
  const tapRef = useRef(handleTap);
  const closeQuickWeaveRef = useRef(closeQuickWeave);

  // Always keep refs up to date
  interactionSelectionRef.current = handleInteractionSelection;
  openQuickWeaveRef.current = handleOpenQuickWeave;
  tapRef.current = handleTap;
  closeQuickWeaveRef.current = closeQuickWeave;

  // Stable wrappers that use the refs
  const handleInteractionSelectionStable = (index: number, fId: string) => interactionSelectionRef.current(index, fId);
  const handleOpenQuickWeaveStable = (fId: string, point: { x: number; y: number }) => openQuickWeaveRef.current(fId, point);
  const handleTapStable = (fId: string) => tapRef.current(fId);
  const closeQuickWeaveStable = () => closeQuickWeaveRef.current();

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

  const findTargetCardId = (absoluteX: number, absoluteY: number) => {
    'worklet';
    const cardIds = Object.keys(cardRefs.value);
    for (const id of cardIds) {
      const ref = cardRefs.value[id];
      // Cast to any to satisfy Reanimated's measure type requirement, assuming ref is valid
      const measurement = measure(ref as any);
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
            runOnJS(handleTapStable)(targetId);
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
          runOnJS(handleOpenQuickWeaveStable)(targetId, centerPoint);
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

        const distance = Math.sqrt(currentDragX ** 2 + currentDragY ** 2);

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
          runOnJS(closeQuickWeaveStable)();

          const distance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
          if (distance >= SELECTION_THRESHOLD && highlightedIndex.value !== -1 && activeCardId.value) {
            // Process interaction selection after overlay closes
            const selectedIndex = highlightedIndex.value;
            const friendId = activeCardId.value;
            runOnJS(handleInteractionSelectionStable)(selectedIndex, friendId);
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