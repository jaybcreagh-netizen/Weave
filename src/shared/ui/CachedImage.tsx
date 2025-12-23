/**
 * CachedImage - A drop-in replacement for React Native Image with automatic caching
 * 
 * Uses expo-image under the hood for:
 * - Memory caching (instant display on re-render)
 * - Disk caching (persists across app restarts)
 * - Progressive loading with placeholder support
 * 
 * Usage:
 * ```tsx
 * <CachedImage 
 *   source={{ uri: friend.photoUrl }}
 *   style={{ width: 48, height: 48, borderRadius: 24 }}
 *   placeholder={require('./placeholder.png')} // optional
 * />
 * ```
 */

import React from 'react';
import { Image, ImageProps, ImageContentFit } from 'expo-image';
import { StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

// Blue hash placeholder - subtle loading state
const BLURHASH_PLACEHOLDER = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7teleayj[ayj[j[ayfQj[';

export interface CachedImageProps extends Omit<ImageProps, 'contentFit'> {
    /** Optional fallback when image fails to load */
    fallbackIcon?: React.ReactNode;
    /** Content fit mode - defaults to 'cover' */
    contentFit?: ImageContentFit;
    /** Show loading placeholder - defaults to true */
    showPlaceholder?: boolean;
}

export function CachedImage({
    source,
    style,
    fallbackIcon,
    contentFit = 'cover',
    showPlaceholder = true,
    placeholder,
    ...props
}: CachedImageProps) {
    const { tokens } = useTheme();
    const [hasError, setHasError] = React.useState(false);

    // Reset error state when source changes
    React.useEffect(() => {
        setHasError(false);
    }, [typeof source === 'object' && 'uri' in source ? source.uri : source]);

    // If image failed to load and we have a fallback, render it
    if (hasError && fallbackIcon) {
        return <>{fallbackIcon}</>;
    }

    return (
        <Image
            source={source}
            style={style}
            contentFit={contentFit}
            placeholder={showPlaceholder ? (placeholder || BLURHASH_PLACEHOLDER) : undefined}
            placeholderContentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setHasError(true)}
            {...props}
        />
    );
}

// Convenience component for circular profile pictures
export interface ProfileImageProps extends Omit<CachedImageProps, 'style'> {
    size?: number;
    style?: ImageStyle;
}

export function ProfileImage({
    size = 48,
    style,
    ...props
}: ProfileImageProps) {
    return (
        <CachedImage
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                style,
            ]}
            {...props}
        />
    );
}

export default CachedImage;
