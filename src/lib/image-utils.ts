/**
 * Utility functions for handling images, particularly contact images
 */

/**
 * Normalizes contact image URIs to ensure proper file:// scheme prefix
 * This prevents React Native's RCTFileRequestHandler and RCTDataRequestHandler
 * from conflicting when loading local contact photos
 *
 * @param uri - The URI from expo-contacts or other sources
 * @returns Normalized URI with proper file:// scheme, or empty string if invalid
 */
export function normalizeContactImageUri(uri: string | undefined | null): string {
  if (!uri) return '';

  // If already has a scheme (file://, http://, https://, data:), return as-is
  if (/^[a-z]+:\/\//i.test(uri)) {
    return uri;
  }

  // If it's a local file path without scheme, add file://
  // This is typically the case for contact images from expo-contacts
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }

  // Return as-is for other cases (e.g., asset paths)
  return uri;
}
