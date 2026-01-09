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
  pendingCardId: Animated.SharedValue<string | null>; // Card being held (before long-press activates)
  registerRef: (id: string, ref: React.RefObject<any>, metadata?: { initial: string }) => void;
  unregisterRef: (id: string) => void;
  dragX: Animated.SharedValue<number>;
  dragY: Animated.SharedValue<number>;
  highlightedIndex: Animated.SharedValue<number>;
  overlayCenter: Animated.SharedValue<{ x: number; y: number }>;
  cardMetadata: Animated.SharedValue<Record<string, { initial: string }>>;
  isLongPressActive: Animated.SharedValue<boolean>;
}

const CardGestureContext = createContext<CardGestureContextType | null>(null);

export function CardGestureProvider({ children }: { children: React.ReactNode }) {
  const gestureCoordinator = useCardGestureCoordinator();
  return <CardGestureContext.Provider value={gestureCoordinator}>{children}</CardGestureContext.Provider>;
}

export function useCardGesture(options: { optional: true }): CardGestureContextType | null;
export function useCardGesture(options?: { optional?: false }): CardGestureContextType;
export function useCardGesture(options?: { optional?: boolean }): CardGestureContextType | null {
  const context = useContext(CardGestureContext);
  if (!context) {
    if (options?.optional) return null;
    throw new Error('useCardGesture must be used within a CardGestureProvider');
  }
  return context;
}

function useCardGestureCoordinator(): CardGestureContextType {
  const { handleInteractionSelection, handleOpenQuickWeave, handleTap, closeQuickWeave } = useQuickWeave();

  // Create refs to hold the latest version of the handlers
  // This prevents the stale closure issue where the gesture (which is memoized once)
  // holds onto the *initial* version of these functions (and thus the initial activities list/state).
  const interactionSelectionRef = useRef(handleInteractionSelection);
  const openQuickWeaveRef = useRef(handleOpenQuickWeave);
  // const prepareQuickWeaveRef = useRef(handlePrepareQuickWeave);
  const tapRef = useRef(handleTap);
  const closeQuickWeaveRef = useRef(closeQuickWeave);

  // Always keep refs up to date
  interactionSelectionRef.current = handleInteractionSelection;
  openQuickWeaveRef.current = handleOpenQuickWeave;
  // prepareQuickWeaveRef.current = handlePrepareQuickWeave;
  tapRef.current = handleTap;
  closeQuickWeaveRef.current = closeQuickWeave;

  const lastGestureTimestamp = useRef(0);

  // Stable wrappers that use the refs and enforce chronological order
  const handleInteractionSelectionStable = (index: number, fId: string) => interactionSelectionRef.current(index, fId);
  const handleOpenQuickWeaveStable = (fId: string, point: { x: number; y: number }, timestamp: number) => {
    if (timestamp >= lastGestureTimestamp.current) {
      lastGestureTimestamp.current = timestamp;
      openQuickWeaveRef.current(fId, point);
    }
  };
  // const handlePrepareQuickWeaveStable = (fId: string) => prepareQuickWeaveRef.current(fId);
  const handleTapStable = (fId: string) => tapRef.current(fId);
  const closeQuickWeaveStable = (timestamp: number) => {
    if (timestamp >= lastGestureTimestamp.current) {
      lastGestureTimestamp.current = timestamp;
      closeQuickWeaveRef.current();
    }
  };

  const cardRefs = useSharedValue<Record<string, React.RefObject<Animated.View>>>({});
  const cardMetadata = useSharedValue<Record<string, { initial: string }>>({});
  const overlayCenter = useSharedValue<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollOffset = useSharedValue(0);
  const activeCardId = useSharedValue<string | null>(null);
  const pendingCardId = useSharedValue<string | null>(null); // Track which card is being held before activation
  const isLongPressActive = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const highlightedIndex = useSharedValue(-1);
  const startCoordinates = useSharedValue<{ x: number, y: number }>({ x: 0, y: 0 });

  // Timeout for delayed pending feedback (so quick taps don't trigger it)
  const pendingFeedbackTimeout = useRef<NodeJS.Timeout | null>(null);

  const startPendingFeedback = (targetId: string) => {
    // Clear any existing timeout
    if (pendingFeedbackTimeout.current) {
      clearTimeout(pendingFeedbackTimeout.current);
    }
    // Delay the visual feedback by 130ms (balance between fast feel and tap safety)
    pendingFeedbackTimeout.current = setTimeout(() => {
      pendingCardId.value = targetId;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 130);
  };

  const clearPendingFeedback = () => {
    if (pendingFeedbackTimeout.current) {
      clearTimeout(pendingFeedbackTimeout.current);
      pendingFeedbackTimeout.current = null;
    }
  };

  const registerRef = (id: string, ref: React.RefObject<Animated.View>, metadata?: { initial: string }) => {
    'worklet';
    cardRefs.value[id] = ref;
    if (metadata) {
      const newMeta = Object.assign({}, cardMetadata.value);
      newMeta[id] = metadata;
      cardMetadata.value = newMeta;
    }
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
      .maxDuration(150) // Balanced tap detection
      .onEnd((event, success) => {
        'worklet';
        // Clear any pending feedback timeout so quick taps don't trigger it
        runOnJS(clearPendingFeedback)();
        if (success && !isLongPressActive.value) {
          const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
          if (targetId) {
            runOnJS(handleTapStable)(targetId);
          }
        }
      });

    const longPressAndDrag = Gesture.LongPress()
      .minDuration(150) // 150ms activation as requested
      .maxDistance(999999)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => {
        'worklet';
        // Store coordinates immediately, but delay the visual feedback
        // so quick taps don't trigger the "charging" animation/haptic
        const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
        if (targetId) {
          startCoordinates.value = { x: event.absoluteX, y: event.absoluteY };
          // PRE-SET the overlay center here so it's ready before activation
          overlayCenter.value = {
            x: event.absoluteX,
            y: event.absoluteY,
          };

          // Delay pending feedback - only shows if user holds for 120ms+
          runOnJS(startPendingFeedback)(targetId);
        }
      })
      .onStart((event) => {
        'worklet';
        // Clear the delayed pending feedback since we're now activating
        runOnJS(clearPendingFeedback)();
        const targetId = findTargetCardId(event.absoluteX, event.absoluteY);

        console.log(`[Gesture] LongPress onStart. Target: ${targetId}, Time: ${Date.now()}`);

        if (targetId) {
          pendingCardId.value = null; // Clear pending state
          activeCardId.value = targetId;

          // Ensure coordinates are fresh (though onBegin likely caught them)
          overlayCenter.value = {
            x: event.absoluteX,
            y: event.absoluteY,
          };

          // ACTIVATE LAST - enables the derived values in the overlay
          isLongPressActive.value = true;

          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
          const centerPoint = {
            x: event.absoluteX,
            y: event.absoluteY, // Use absolute position since overlay is screen-positioned
          };
          runOnJS(handleOpenQuickWeaveStable)(targetId, centerPoint, Date.now());
        }
      })
      .onTouchesMove((event, state) => {
        'worklet';
        const touch = event.changedTouches[0];

        // BEFORE activation: detect horizontal swipes and cancel the pending long-press
        // This prevents accidental quick weave when swiping between tier tabs
        if (!isLongPressActive.value) {
          if (pendingCardId.value !== null) {
            const deltaX = touch.absoluteX - startCoordinates.value.x;
            const deltaY = touch.absoluteY - startCoordinates.value.y;
            const totalMovement = Math.abs(deltaX) + Math.abs(deltaY) + 0.001;
            const horizontalRatio = Math.abs(deltaX) / totalMovement;

            // If movement is clearly horizontal (>70% horizontal, >12px), cancel activation
            const isHorizontalSwipe = horizontalRatio > 0.7 && Math.abs(deltaX) > 12;
            if (isHorizontalSwipe) {
              runOnJS(clearPendingFeedback)();
              pendingCardId.value = null;
              state.fail(); // Cancel the gesture entirely
            }
          }
          return;
        }

        // AFTER activation: handle drag tracking for overlay selection
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
        console.log(`[Gesture] LongPress onEnd. Active: ${isLongPressActive.value}, Time: ${Date.now()}`);
        if (isLongPressActive.value) {
          const distance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
          if (distance >= SELECTION_THRESHOLD && highlightedIndex.value !== -1 && activeCardId.value) {
            // CRITICAL: Process interaction FIRST before any UI updates
            // This prevents shadow recalculations from blocking the critical path
            const selectedIndex = highlightedIndex.value;
            const friendId = activeCardId.value;
            runOnJS(handleInteractionSelectionStable)(selectedIndex, friendId);
          }

          // Close overlay AFTER starting the interaction (can run concurrently)
          runOnJS(closeQuickWeaveStable)(Date.now());
        }

        // Reset all state immediately - always, regardless of gesture state
        isLongPressActive.value = false;
        activeCardId.value = null;
        pendingCardId.value = null;
        dragX.value = 0;
        dragY.value = 0;
        highlightedIndex.value = -1;
      })
      .onFinalize(() => {
        'worklet';
        // Final cleanup to ensure card scale resets - extra safety
        activeCardId.value = null;
        pendingCardId.value = null;
        isLongPressActive.value = false;
        dragX.value = 0;
        dragY.value = 0;
        highlightedIndex.value = -1;
      });

    return Gesture.Exclusive(tap, longPressAndDrag);
  }, []); // Empty dependency array means this runs only once.

  return {
    gesture,
    animatedScrollHandler,
    activeCardId,
    pendingCardId,
    registerRef,
    unregisterRef,
    dragX,
    dragY,
    highlightedIndex,
    cardMetadata,
    overlayCenter,
    isLongPressActive
  };
}