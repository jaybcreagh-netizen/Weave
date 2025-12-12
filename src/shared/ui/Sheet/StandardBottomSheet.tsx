import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TouchableWithoutFeedback } from 'react-native';
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

/**
 * StandardBottomSheet - Unified bottom sheet component for consistent modal interactions
 *
 * Uses @gorhom/bottom-sheet for native gesture handling and smooth animations.
 * All sheets in the app should use this component for visual consistency.
 *
 * @example
 * // Simple action sheet
 * <StandardBottomSheet
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   height="action"
 *   title="Choose an option"
 * >
 *   <ActionButtons />
 * </StandardBottomSheet>
 *
 * @example
 * // Form sheet with scrollable content
 * <StandardBottomSheet
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   height="full"
 *   scrollable
 *   title="Edit Details"
 * >
 *   <FormContent />
 * </StandardBottomSheet>
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
}: StandardBottomSheetProps) {
  const { colors, isDarkMode } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

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
        onClose();
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
            onPress: () => onClose(),
          },
        ]
      );
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose, confirmCloseMessage]);

  // Render backdrop with consistent styling and interception
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <View style={StyleSheet.absoluteFill}>
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={BACKDROP_OPACITY.visible}
          pressBehavior="none"
        />
        <TouchableWithoutFeedback onPress={handleAttemptClose}>
          <View style={StyleSheet.absoluteFill} />
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
      bottomSheetRef.current?.snapToIndex(initialSnapIndex);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, initialSnapIndex]);

  // Render footer using BottomSheetFooter for robust handling
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16)
          }
        ]}>
          {footerComponent}
        </View>
      </BottomSheetFooter>
    ),
    [footerComponent, colors.card, colors.border, insets.bottom]
  );

  // Don't render anything if not visible
  if (!visible) return null;

  const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <Portal>
      <BottomSheet
        ref={bottomSheetRef}
        index={initialSnapIndex}
        snapPoints={snapPoints}
        enableDynamicSizing={isDynamic}
        onChange={handleSheetChanges}
        enablePanDownToClose={enableSwipeClose && !hasUnsavedChanges}
        enableContentPanningGesture={!scrollable && !disableContentPanning}
        backdropComponent={renderBackdrop}
        footerComponent={footerComponent ? renderFooter : undefined}
        backgroundStyle={[
          styles.background,
          { backgroundColor: colors.card },
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          { backgroundColor: colors.border },
        ]}
        animationConfigs={{
          damping: SHEET_SPRING_CONFIG.damping,
          stiffness: SHEET_SPRING_CONFIG.stiffness,
        }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        style={styles.sheet}
      >
        {/* Header with optional title and close button - FIXED AT TOP */}
        {(title || titleComponent || showCloseButton) && (
          <View style={[styles.header, { backgroundColor: colors.card }]}>
            {titleComponent ? (
              titleComponent
            ) : title ? (
              <Text
                style={[styles.title, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
            {showCloseButton && (
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
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
              styles.contentContainer,
              !scrollable && { marginTop: 56 } // Push non-scrollable content below header (header is ~56px tall)
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
              <View style={styles.content}>
                {children}
              </View>
            )}
          </ContentWrapper>
        )}
      </BottomSheet >
    </Portal >
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 1000,
  },
  background: {
    borderTopLeftRadius: SHEET_BORDER_RADIUS,
    borderTopRightRadius: SHEET_BORDER_RADIUS,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center the header content
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0, // No border by default, can be added via theme if needed
    zIndex: 10, // Ensure header stays on top of scrolling content
  },
  title: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
    textAlign: 'center', // Center the text
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 4,
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
