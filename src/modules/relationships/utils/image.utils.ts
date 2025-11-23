/**
 * Image Utils
 *
 * Utilities for handling images in the application.
 */

/**
 * Normalizes a contact image URI to ensure it has a valid scheme.
 * Useful for handling contacts from Expo Contacts which might return raw paths.
 *
 * @param uri The image URI to normalize
 * @returns The normalized URI
 */
export function normalizeContactImageUri(uri?: string | null): string | undefined {
  if (!uri) return undefined;

  if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  // If it's a local path without scheme, assume file://
  return `file://${uri}`;
}
