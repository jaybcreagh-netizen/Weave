import React, { createContext, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, AppState, AppStateStatus } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS, measure, type AnimatedRef } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { useQuickWeave } from '@/modules/interactions/hooks/useQuickWeave';
import { itemPositions, HIGHLIGHT_THRESHOLD, SELECTION_THRESHOLD } from '@/modules/interactions/constants';

interface CardGestureContextType {
  gesture: any; // Using any to avoid complex Gesture type issues
  animatedScrollHandler: any;
  activeCardId: Animated.SharedValue<string | null>;
  pendingCardId: Animated.SharedValue<string | null>; // Card being held (before long-press activates)
  registerRef: (id: string, ref: AnimatedRef<Animated.View>) => void;
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

  // Store animated refs in a regular JS object (not shared value) to preserve their special properties
  // Animated refs lose their identity when stored in shared values
  const cardRefs = useRef<Record<string, AnimatedRef<Animated.View>>>({});
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

  // Reset all gesture state when app resumes from background
  // This fixes gestures getting stuck if app was backgrounded mid-gesture
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Reset all gesture state
        activeCardId.value = null;
        pendingCardId.value = null;
        isLongPressActive.value = false;
        dragX.value = 0;
        dragY.value = 0;
        highlightedIndex.value = -1;
        clearPendingFeedback();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

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

  // Register/unregister refs on the JS thread (not worklets) to preserve animated ref identity
  const registerRef = useCallback((id: string, ref: AnimatedRef<Animated.View>) => {
    cardRefs.current[id] = ref;
  }, []);

  const unregisterRef = useCallback((id: string) => {
    delete cardRefs.current[id];
  }, []);

  const animatedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollOffset.value = event.contentOffset.y; },
  });

  // Find target card at given coordinates - runs on UI thread via worklet
  // Uses measure() with animated refs to get layout measurements
  const findTargetCardId = (absoluteX: number, absoluteY: number) => {
    'worklet';
    const cardIds = Object.keys(cardRefs.current);
    for (const id of cardIds) {
      const ref = cardRefs.current[id];
      if (!ref) continue;
      // measure() from Reanimated works with animated refs in worklets
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
          startCoordinates.value = { x: event.x, y: event.y };
          // Delay pending feedback - only shows if user holds for 120ms+
          runOnJS(startPendingFeedback)(targetId);
          // Prefetch Quick Weave data immediately to ensure instant open on activation
          // runOnJS(handlePrepareQuickWeaveStable)(targetId);
        }
      })
      .onStart((event) => {
        'worklet';
        // Clear the delayed pending feedback since we're now activating
        runOnJS(clearPendingFeedback)();
        // Now set activeCardId when long press actually activates
        const targetId = findTargetCardId(event.absoluteX, event.absoluteY);
        if (targetId) {
          pendingCardId.value = null; // Clear pending state
          activeCardId.value = targetId;
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
          runOnJS(closeQuickWeaveStable)(Date.now());

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

  return { gesture, animatedScrollHandler, activeCardId, pendingCardId, registerRef, unregisterRef, dragX, dragY, highlightedIndex };
}