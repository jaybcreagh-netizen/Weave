import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdropProps,
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
export function StandardBottomSheet({
  visible,
  onClose,
  height = 'form',
  snapPoints: customSnapPoints,
  initialSnapIndex = 0,
  blurBackdrop = true,
  enableSwipeClose = true,
  scrollable = false,
  title,
  showCloseButton = true,
  children,
  testID,
}: StandardBottomSheetProps) {
  const { colors, isDarkMode } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Compute snap points from height variant or custom
  const snapPoints = useMemo(() => {
    if (customSnapPoints) {
      return customSnapPoints;
    }
    return [SHEET_HEIGHTS[height]];
  }, [height, customSnapPoints]);

  // Handle sheet state changes
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  // Render backdrop with consistent styling
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={BACKDROP_OPACITY.visible}
        pressBehavior="close"
      />
    ),
    []
  );

  // Sync visibility with sheet state
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(initialSnapIndex);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, initialSnapIndex]);

  // Don't render anything if not visible
  if (!visible) return null;

  const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <Portal>
      <BottomSheet
        ref={bottomSheetRef}
        index={initialSnapIndex}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose={enableSwipeClose}
        backdropComponent={renderBackdrop}
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
        style={styles.sheet}
        testID={testID}
      >
        <ContentWrapper style={styles.contentContainer}>
          {/* Optional header with title and close button */}
          {title && (
            <View style={styles.header}>
              <Text
                style={[styles.title, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
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

          {/* Sheet content */}
          <View style={styles.content}>{children}</View>
        </ContentWrapper>
      </BottomSheet>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});
