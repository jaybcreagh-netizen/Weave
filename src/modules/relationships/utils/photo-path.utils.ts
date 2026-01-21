import * as FileSystem from 'expo-file-system/legacy';
import { normalizeContactImageUri } from './image.utils';

/**
 * Resolves a friend's photo URL to a usable URI.
 * Handles:
 * 1. Relative paths (beginning with implicit document directory)
 * 2. Stale absolute paths (iOS sandbox changes)
 * 3. Normalization (adding file:// scheme)
 */
export function resolveFriendPhotoUrl(photoUrl?: string | null): string | null {
    if (!photoUrl) return null;

    let resolvedUrl = photoUrl;

    // Handle relative paths (e.g. "weave_images/photo.jpg")
    if (!photoUrl.startsWith('file://') && !photoUrl.startsWith('/') && !photoUrl.startsWith('http')) {
        resolvedUrl = `${FileSystem.documentDirectory}${photoUrl.replace(/^\//, '')}`;
    }
    // Handle absolute paths (legacy or stale iOS paths)
    // On iOS, the app sandbox path changes on every launch/build.
    // If we stored an absolute path like "file:///.../Application/OLD-UUID/Documents/weave_images/...",
    // we must repair it to point to the current container.
    else if (photoUrl.includes('weave_images')) {
        const relativePart = photoUrl.split('weave_images')[1];
        // Reconstruct using current document directory
        // FileSystem.documentDirectory includes the trailing slash
        resolvedUrl = `${FileSystem.documentDirectory}weave_images${relativePart}`;
    }

    return normalizeContactImageUri(resolvedUrl) || null;
}
