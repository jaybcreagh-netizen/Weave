import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, TouchableWithoutFeedback } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdropProps,
  BottomSheetFooter,
  BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  SHEET_HEIGHTS,
  SHEET_SPRING_CONFIG,
  BACKDROP_OPACITY,
  SHEET_BORDER_RADIUS,
} from './constants';
import { StandardBottomSheetProps } from './types';
import { BottomSheetProps } from '@gorhom/bottom-sheet';

/**
 * StandardBottomSheet - Unified bottom sheet component for consistent modal interactions
 *
 * Uses @gorhom/bottom-sheet for native gesture handling and smooth animations.
 * All sheets in the app should use this component for visual consistency.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function StandardBottomSheet({
  visible,
  onClose,
  height = 'form',
  snapPoints: customSnapPoints,
  initialSnapIndex = 0,
  enableSwipeClose = true,
  scrollable = false,
  title,
  titleComponent,
  showCloseButton = true,
  children,
  testID,
  scrollRef,
  footerComponent,
  disableContentPanning = false,
  renderScrollContent,
  hasUnsavedChanges = false,
  confirmCloseMessage = 'Discard Changes? You have unsaved changes. Are you sure you want to discard them?',
  keyboardBehavior = 'interactive',
  keyboardBlurBehavior = 'restore',
  portalHost,
}: StandardBottomSheetProps & { keyboardBehavior?: BottomSheetProps['keyboardBehavior'], keyboardBlurBehavior?: BottomSheetProps['keyboardBlurBehavior'] }) {
  const { colors, isDarkMode } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const [isFullyClosed, setIsFullyClosed] = React.useState(!visible);

  const isDynamic = height === 'auto';

  // Compute snap points from height variant or custom
  const snapPoints = useMemo(() => {
    if (isDynamic) {
      return [];
    }
    if (customSnapPoints) {
      return customSnapPoints;
    }
    return [SHEET_HEIGHTS[height as keyof typeof SHEET_HEIGHTS]];
  }, [height, customSnapPoints, isDynamic]);

  // Handle sheet state changes
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        setIsFullyClosed(true);
        onClose();
      } else {
        setIsFullyClosed(false);
      }
    },
    [onClose]
  );

  // Handle attempt to close (checks for unsaved changes)
  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Changes?',
        confirmCloseMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => bottomSheetRef.current?.close(),
          },
        ]
      );
    } else {
      // Use close() to trigger the slide-down animation, 
      // which will call onClose() via handleSheetChanges when done
      bottomSheetRef.current?.close();
    }
  }, [hasUnsavedChanges, confirmCloseMessage]);

  // Render backdrop with consistent styling and interception
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <View className="absolute inset-0">
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={BACKDROP_OPACITY.visible}
          pressBehavior="none"
        />
        <TouchableWithoutFeedback onPress={handleAttemptClose}>
          <View className="absolute inset-0" />
        </TouchableWithoutFeedback>
      </View>
    ),
    [handleAttemptClose]
  );

  // Handle manual close with animation
  const handleClose = useCallback(() => {
    handleAttemptClose();
  }, [handleAttemptClose]);

  // Sync visibility with sheet state
  useEffect(() => {
    if (visible) {
      setIsFullyClosed(false);
      bottomSheetRef.current?.snapToIndex(initialSnapIndex);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, initialSnapIndex]);

  // Render footer using BottomSheetFooter for robust handling
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View
          className="p-4 border-t"
          style={{
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16)
          }}
        >
          {footerComponent}
        </View>
      </BottomSheetFooter>
    ),
    [footerComponent, colors.card, colors.border, insets.bottom]
  );

  const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <Portal hostName={portalHost}>
      <BottomSheet
        ref={bottomSheetRef}
        index={visible ? initialSnapIndex : -1}
        snapPoints={snapPoints}
        enableDynamicSizing={isDynamic}
        onChange={handleSheetChanges}
        enablePanDownToClose={enableSwipeClose && !hasUnsavedChanges}
        enableContentPanningGesture={!scrollable && !disableContentPanning}
        backdropComponent={renderBackdrop}
        footerComponent={footerComponent ? renderFooter : undefined}
        backgroundStyle={{
          backgroundColor: colors.card,
          borderTopLeftRadius: SHEET_BORDER_RADIUS,
          borderTopRightRadius: SHEET_BORDER_RADIUS,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.border,
          width: 40,
          height: 4,
          borderRadius: 2,
          marginTop: 8,
        }}
        animationConfigs={{
          damping: SHEET_SPRING_CONFIG.damping,
          stiffness: SHEET_SPRING_CONFIG.stiffness,
        }}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior={keyboardBlurBehavior}
        android_keyboardInputMode="adjustResize"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isFullyClosed ? 0 : 0.15,
          shadowRadius: 16,
          elevation: isFullyClosed ? 0 : 16,
          zIndex: 1000,
        }}
      >
        {/* Header with optional title and close button - FIXED AT TOP */}
        {(title || titleComponent || showCloseButton) && (
          <View
            className="flex-row items-center justify-center px-4 py-3 z-10"
            style={{ backgroundColor: colors.card }}
          >
            {titleComponent ? (
              titleComponent
            ) : title ? (
              <Text
                className="text-xl font-lora-bold text-center flex-1"
                style={{ color: colors.foreground }}
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
            {showCloseButton && (
              <TouchableOpacity
                onPress={handleClose}
                className="absolute right-4 top-3 p-1 z-10"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Render custom scrollable content directly, or use ContentWrapper */}
        {renderScrollContent ? (
          renderScrollContent()
        ) : (
          <ContentWrapper
            style={[
              !scrollable && { marginTop: 56, flex: 1 } // Push non-scrollable content below header (header is ~56px tall)
            ]}
            ref={scrollable ? scrollRef : undefined}
            contentContainerStyle={[
              scrollable && {
                paddingTop: 16, // Space between header and content
                paddingHorizontal: 16, // Default horizontal padding for scrollable content (can be overridden by children)
                paddingBottom: footerComponent ? 80 : Math.max(insets.bottom, 24), // Extra padding for footer overlap
                flexGrow: 1
              }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Sheet content */}
            {scrollable ? (
              children
            ) : (
              <View className="flex-1 px-4">
                {children}
              </View>
            )}
          </ContentWrapper>
        )}
      </BottomSheet >
    </Portal >
  );
}

