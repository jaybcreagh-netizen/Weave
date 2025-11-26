import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/shared/hooks/useTheme';
import { Portal } from '@gorhom/portal';

interface CustomBottomSheetProps {
    children: React.ReactNode;
    snapPoints?: string[];
    onClose?: () => void;
    visible: boolean;
    index?: number;
    enablePanDownToClose?: boolean;
    scrollable?: boolean;
}

export function CustomBottomSheet({
    children,
    snapPoints = ['25%', '50%', '90%'],
    onClose,
    visible,
    index = 1,
    enablePanDownToClose = true,
    scrollable = false
}: CustomBottomSheetProps) {
    const { colors, isDarkMode } = useTheme();
    const bottomSheetRef = React.useRef<BottomSheet>(null);

    // callbacks
    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1 && onClose) {
            onClose();
        }
    }, [onClose]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    React.useEffect(() => {
        if (visible) {
            bottomSheetRef.current?.snapToIndex(index);
        } else {
            bottomSheetRef.current?.close();
        }
    }, [visible, index]);

    if (!visible) return null;

    const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

    return (
        <Portal>
            <BottomSheet
                ref={bottomSheetRef}
                index={index}
                snapPoints={snapPoints}
                onChange={handleSheetChanges}
                enablePanDownToClose={enablePanDownToClose}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.card }}
                handleIndicatorStyle={{ backgroundColor: colors.border }}
            >
                <ContentWrapper style={styles.contentContainer}>
                    {children}
                </ContentWrapper>
            </BottomSheet>
        </Portal>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
    },
});
