/**
 * ImageService - Unified image management for Weave
 *
 * Handles:
 * - Image compression and resizing
 * - Local storage (active now)
 * - Cloud storage with Supabase (ready to enable)
 * - Cleanup on deletion
 *
 * Architecture:
 * 1. Local-first: Images stored in FileSystem.documentDirectory
 * 2. Cloud-ready: Upload to Supabase Storage when ENABLE_CLOUD_STORAGE = true
 * 3. Graceful fallback: Works offline, syncs when online
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import Logger from '@/shared/utils/Logger';

// Lazy-load supabase only when cloud storage is enabled
let supabase: any = null;
const getSupabase = async () => {
  if (!supabase) {
    const { supabase: supabaseClient } = await import('@/modules/auth');
    supabase = supabaseClient;
  }
  return supabase;
};

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Set to true when you're ready to enable cloud storage
 *
 * Prerequisites:
 * 1. Run supabase/schema.sql to create storage buckets
 * 2. Create buckets in Supabase Dashboard > Storage
 * 3. Ensure user is authenticated
 */
const ENABLE_CLOUD_STORAGE = false;

/**
 * Image quality and size settings
 */
const IMAGE_SETTINGS = {
  profilePicture: {
    width: 400,
    height: 400,
    quality: 0.7, // 0-1, balances quality vs file size
    format: ImageManipulator.SaveFormat.JPEG,
  },
  journalPhoto: {
    width: 1200,
    height: undefined, // Maintain aspect ratio
    quality: 0.8, // Higher quality for journal photos
    format: ImageManipulator.SaveFormat.JPEG,
  },
  groupPicture: {
    width: 400,
    height: 400,
    quality: 0.7, // Same settings as profile pictures
    format: ImageManipulator.SaveFormat.JPEG,
  },
} as const;

/**
 * Storage paths
 */
const LOCAL_STORAGE_DIR = `${FileSystem.documentDirectory}weave_images/`;
const SUPABASE_BUCKETS = {
  profilePictures: 'profile-pictures',
  journalPhotos: 'journal-photos',
} as const;

// =====================================================
// TYPES
// =====================================================

export type ImageType = 'profilePicture' | 'journalPhoto' | 'groupPicture';

export interface ProcessImageOptions {
  uri: string;
  type: ImageType;
  userId?: string; // Required when ENABLE_CLOUD_STORAGE = true
  imageId: string; // Unique ID (friend_id for profile, interaction_id for journal)
}

export interface ImageResult {
  localUri: string;
  cloudUrl?: string;
  success: boolean;
  error?: string;
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Ensure local storage directory exists
 */
async function ensureDirectoryExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(LOCAL_STORAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(LOCAL_STORAGE_DIR, { intermediates: true });
    Logger.info('[ImageService] Created local storage directory:', LOCAL_STORAGE_DIR);
  }
}

// =====================================================
// CORE FUNCTIONS
// =====================================================

/**
 * Process and store an image
 *
 * Steps:
 * 1. Compress and resize image
 * 2. Save to local storage (persistent across rebuilds)
 * 3. Upload to cloud storage (if enabled and user authenticated)
 * 4. Return both local URI and cloud URL
 *
 * @param options - Image processing options
 * @returns ImageResult with local URI and optional cloud URL
 */
export async function processAndStoreImage(
  options: ProcessImageOptions
): Promise<ImageResult> {
  try {
    const { uri, type, userId, imageId } = options;

    // Ensure local directory exists
    await ensureDirectoryExists();

    // Get image settings based on type
    const settings = IMAGE_SETTINGS[type];

    Logger.debug(`[ImageService] Processing ${type}:`, imageId);

    // Step 1: Get original dimensions to determine if cropping is needed
    const getImageSize = (uri: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve, reject) => {
        Image.getSize(
          uri,
          (width, height) => resolve({ width, height }),
          (error) => reject(error)
        );
      });
    };

    const { width, height } = await getImageSize(uri);
    const actions: ImageManipulator.Action[] = [];

    // Step 2: Smart Center Crop (if needed)
    // Only apply for profile pictures, group pictures, or if we want square images
    if ((type === 'profilePicture' || type === 'groupPicture') && Math.abs(width - height) > 5) {
      const size = Math.min(width, height);
      const originX = (width - size) / 2;
      const originY = (height - size) / 2;

      Logger.debug(`[ImageService] Cropping to square: ${size}x${size} at (${originX}, ${originY})`);

      actions.push({
        crop: {
          originX,
          originY,
          width: size,
          height: size,
        },
      });
    }

    // Step 3: Resize
    actions.push({
      resize: {
        width: settings.width,
        height: settings.height,
      },
    });

    // Execute manipulation
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: settings.quality,
        format: settings.format,
      }
    );

    Logger.debug('[ImageService] Processed:', {
      originalSize: `${width}x${height}`,
      processedUri: manipulatedImage.uri,
    });

    // Step 4: Clean up old images and save new one
    await cleanupOldImages(imageId, type);

    const timestamp = Date.now();
    const fileName = `${type}_${imageId}_${timestamp}.jpg`;
    const localUri = `${LOCAL_STORAGE_DIR}${fileName}`;

    await FileSystem.copyAsync({
      from: manipulatedImage.uri,
      to: localUri
    });

    Logger.info('[ImageService] Saved locally:', localUri);

    // Step 5: Upload to cloud storage (if enabled)
    let cloudUrl: string | undefined;

    if (ENABLE_CLOUD_STORAGE && userId) {
      try {
        cloudUrl = await uploadToSupabase({
          localUri,
          userId,
          imageId,
          type,
        });
        Logger.info('[ImageService] Uploaded to cloud:', cloudUrl);
      } catch (cloudError) {
        Logger.warn('[ImageService] Cloud upload failed (continuing with local):', cloudError);
        // Don't fail the whole operation - image is still saved locally
      }
    }

    return {
      localUri,
      cloudUrl,
      success: true,
    };
  } catch (error) {
    Logger.error('[ImageService] Error processing image:', error);
    return {
      localUri: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload image to Supabase Storage
 *
 * File structure:
 * - profile-pictures/{userId}/{imageId}.jpg
 * - journal-photos/{userId}/{imageId}.jpg
 */
async function uploadToSupabase(params: {
  localUri: string;
  userId: string;
  imageId: string;
  type: ImageType;
}): Promise<string> {
  const { localUri, userId, imageId, type } = params;

  const bucket =
    type === 'profilePicture'
      ? SUPABASE_BUCKETS.profilePictures
      : SUPABASE_BUCKETS.journalPhotos;

  const filePath = `${userId}/${imageId}.jpg`;

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert to blob
  const blob = base64ToBlob(base64, 'image/jpeg');

  // Get Supabase client
  const supabaseClient = await getSupabase();

  // Upload to Supabase Storage
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: true, // Replace if exists
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL (even though bucket is private, this is the reference URL)
  const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Delete an image (both local and cloud)
 */
export async function deleteImage(params: {
  imageId: string;
  type: ImageType;
  userId?: string;
}): Promise<void> {
  const { imageId, type, userId } = params;

  try {
    // Delete local file
    // Delete local file(s)
    await cleanupOldImages(imageId, type);
    Logger.info('[ImageService] Deleted local files for:', imageId);

    // Delete from cloud (if enabled)
    if (ENABLE_CLOUD_STORAGE && userId) {
      try {
        await deleteFromSupabase({ userId, imageId, type });
        Logger.info('[ImageService] Deleted from cloud');
      } catch (cloudError) {
        Logger.warn('[ImageService] Cloud deletion failed:', cloudError);
      }
    }
  } catch (error) {
    Logger.error('[ImageService] Error deleting image:', error);
  }
}

/**
 * Delete image from Supabase Storage
 */
async function deleteFromSupabase(params: {
  userId: string;
  imageId: string;
  type: ImageType;
}): Promise<void> {
  const { userId, imageId, type } = params;

  const bucket =
    type === 'profilePicture'
      ? SUPABASE_BUCKETS.profilePictures
      : SUPABASE_BUCKETS.journalPhotos;

  const filePath = `${userId}/${imageId}.jpg`;

  // Get Supabase client
  const supabaseClient = await getSupabase();

  const { error } = await supabaseClient.storage.from(bucket).remove([filePath]);

  if (error) {
    throw new Error(`Supabase deletion failed: ${error.message}`);
  }
}

/**
 * Get image URI - checks local first, falls back to cloud
 *
 * Useful for displaying images:
 * - Try local cache first (fast)
 * - If not found and cloud URL exists, download and cache
 */
export async function getImageUri(params: {
  imageId: string;
  type: ImageType;
  cloudUrl?: string;
}): Promise<string | null> {
  const { imageId, type, cloudUrl } = params;

  // Check local storage first
  // Check local storage first - need to find potential timestamped file
  const dirInfo = await FileSystem.getInfoAsync(LOCAL_STORAGE_DIR);
  if (dirInfo.exists) {
    const contents = await FileSystem.readDirectoryAsync(LOCAL_STORAGE_DIR);
    const prefix = `${type}_${imageId}`;

    // Find all matching files
    const matches = contents.filter(item =>
      item === `${type}_${imageId}.jpg` || item.startsWith(`${type}_${imageId}_`)
    );

    if (matches.length > 0) {
      // Sort to get the latest (if there are multiple for some reason)
      // Timestamped ones will sort last alphabetically if format is consistent, 
      // but let's just pick the last one which is likely the newest or the only one
      matches.sort();
      const latestFile = matches[matches.length - 1];
      return `${LOCAL_STORAGE_DIR}${latestFile}`;
    }
  }

  // If cloud URL exists, download and cache
  if (cloudUrl && ENABLE_CLOUD_STORAGE) {
    try {
      await ensureDirectoryExists();
      const localUri = `${LOCAL_STORAGE_DIR}${type}_${imageId}.jpg`;
      await FileSystem.downloadAsync(cloudUrl, localUri);
      Logger.info('[ImageService] Downloaded from cloud to cache:', localUri);
      return localUri;
    } catch (error) {
      Logger.warn('[ImageService] Failed to download from cloud:', error);
    }
  }

  return null;
}

/**
 * Clean up old images for a specific entity
 */
async function cleanupOldImages(imageId: string, type: ImageType): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_STORAGE_DIR);
    if (!dirInfo.exists) return;

    const contents = await FileSystem.readDirectoryAsync(LOCAL_STORAGE_DIR);
    const prefix = `${type}_${imageId}`;

    // Match files that start with the prefix (covers both legacy "type_id.jpg" and new "type_id_timestamp.jpg")
    for (const item of contents) {
      if (item.startsWith(prefix)) {
        // Double check it's the right ID (excludes "type_id2..." if id is "type_id")
        // The format is either `${type}_${imageId}.jpg` or `${type}_${imageId}_${timestamp}.jpg`
        // So checking if it starts with `${type}_${imageId}_` or equals `${type}_${imageId}.jpg` is safer
        const isMatch = item === `${type}_${imageId}.jpg` || item.startsWith(`${type}_${imageId}_`);

        if (isMatch) {
          await FileSystem.deleteAsync(`${LOCAL_STORAGE_DIR}${item}`, { idempotent: true });
          Logger.debug('[ImageService] Cleaned up old image:', item);
        }
      }
    }
  } catch (error) {
    Logger.warn('[ImageService] Error cleaning up old images:', error);
  }
}

/**
 * Cleanup orphaned images
 *
 * Call this periodically to remove images that no longer have
 * corresponding database records (e.g., deleted friends/interactions)
 */
export async function cleanupOrphanedImages(
  activeImageIds: string[],
  type: ImageType
): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_STORAGE_DIR);
    if (!dirInfo.exists) return;

    const contents = await FileSystem.readDirectoryAsync(LOCAL_STORAGE_DIR);
    const prefix = `${type}_`;

    for (const item of contents) {
      if (item.startsWith(prefix)) {
        // Extract imageId from filename (e.g., "profilePicture_123.jpg" -> "123")
        const imageId = item.replace(prefix, '').replace('.jpg', '');

        if (!activeImageIds.includes(imageId)) {
          await FileSystem.deleteAsync(`${LOCAL_STORAGE_DIR}${item}`, { idempotent: true });
          Logger.info('[ImageService] Cleaned up orphaned image:', item);
        }
      }
    }
  } catch (error) {
    Logger.error('[ImageService] Error cleaning up orphaned images:', error);
  }
}

/**
 * Get relative path from absolute URI
 * Use this before saving to database
 */
export function getRelativePath(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith(FileSystem.documentDirectory as string)) {
    return uri.replace(FileSystem.documentDirectory as string, '');
  }
  return uri;
}

/**
 * Resolve absolute URI from potential relative path
 * Handles:
 * 1. Already absolute paths (checks existence, attempts recovery if broken)
 * 2. Relative paths (prepends documentDirectory)
 * 3. Empty paths (returns default/empty)
 */
export async function resolveImageUri(path: string): Promise<string> {
  if (!path) return '';

  // Case 1: Already absolute path (Legacy support)
  if (path.startsWith('file://') || path.startsWith('/')) {
    const fileInfo = await FileSystem.getInfoAsync(path);

    if (fileInfo.exists) {
      return path;
    }

    // Recovery attempt for iOS Container migration
    // If we have a full path like /.../CoreSimulator/.../weave_images/profile.jpg
    // extract just the filename and try to find it in current documents dir
    const filename = path.split('/').pop();
    if (filename) {
      const recoveryPath = `${LOCAL_STORAGE_DIR}${filename}`;
      const recoveryInfo = await FileSystem.getInfoAsync(recoveryPath);
      if (recoveryInfo.exists) {
        Logger.info('[ImageService] Recovered broken path:', { old: path, new: recoveryPath });
        return recoveryPath; // Return the working local URI
      }
    }

    Logger.warn('[ImageService] Image file missing:', path);
    return ''; // Return empty string instead of broken path to prevent hangs
  }

  // Case 2: Relative path (New way)
  // Ensure we don't double-slash
  const cleanDocDir = (FileSystem.documentDirectory as string).replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');

  // If path implies weave_images, just join
  // But wait, LOCAL_STORAGE_DIR includes weave_images/
  // If we saved relative from docDir, it might include weave_images/

  // Strategy: Just blindly prepend docDir
  return (FileSystem.documentDirectory as string) + path;
}

// =====================================================
// UTILITIES
// =====================================================

/**
 * Convert base64 string to Blob (for Supabase upload)
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  // Polyfill for atob/Blob if needed in environment
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: mimeType });
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalImages: number;
  profilePictures: number;
  journalPhotos: number;
  estimatedSizeMB: number;
}> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_STORAGE_DIR);
    if (!dirInfo.exists) {
      return {
        totalImages: 0,
        profilePictures: 0,
        journalPhotos: 0,
        estimatedSizeMB: 0,
      };
    }

    const contents = await FileSystem.readDirectoryAsync(LOCAL_STORAGE_DIR);
    let totalSize = 0;
    let profileCount = 0;
    let journalCount = 0;
    let fileCount = 0;

    for (const item of contents) {
      fileCount++;
      const fileInfo = await FileSystem.getInfoAsync(`${LOCAL_STORAGE_DIR}${item}`);
      if (fileInfo.exists) {
        totalSize += fileInfo.size;
      }

      if (item.startsWith('profilePicture_')) {
        profileCount++;
      } else if (item.startsWith('journalPhoto_')) {
        journalCount++;
      }
    }

    return {
      totalImages: fileCount,
      profilePictures: profileCount,
      journalPhotos: journalCount,
      estimatedSizeMB: totalSize / (1024 * 1024),
    };
  } catch (error) {
    Logger.error('[ImageService] Error getting storage stats:', error);
    return {
      totalImages: 0,
      profilePictures: 0,
      journalPhotos: 0,
      estimatedSizeMB: 0,
    };
  }
}

// =====================================================
// EXPORT CONFIGURATION
// =====================================================

export const ImageServiceConfig = {
  isCloudStorageEnabled: ENABLE_CLOUD_STORAGE,
  localStorageDir: LOCAL_STORAGE_DIR,
  imageSettings: IMAGE_SETTINGS,
};

/**
 * Convenience wrappers for existing consumers
 */
export async function uploadFriendPhoto(uri: string, friendId: string): Promise<ImageResult> {
  return processAndStoreImage({
    uri,
    type: 'profilePicture',
    imageId: friendId,
  });
}

export async function deleteFriendPhoto(friendId: string): Promise<void> {
  return deleteImage({
    imageId: friendId,
    type: 'profilePicture',
  });
}

/**
 * Upload group profile photo
 */
export async function uploadGroupPhoto(uri: string, groupId: string): Promise<ImageResult> {
  return processAndStoreImage({
    uri,
    type: 'groupPicture',
    imageId: groupId,
  });
}

/**
 * Rotate an image 90 degrees clockwise
 */
export async function rotateImage(uri: string, type: ImageType, imageId: string): Promise<ImageResult> {
  try {
    // 1. Rotate the image using manipulateAsync
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ rotate: 90 }],
      {
        compress: 1, // Keep high quality for intermediate step
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    // 2. Process and store the rotated image (this handles resizing, final compression, and saving)
    // The processAndStoreImage function will also handle the cleanup of old images for this ID
    return await processAndStoreImage({
      uri: result.uri,
      type,
      imageId
    });
  } catch (error) {
    Logger.error('[ImageService] Error rotating image:', error);
    return {
      localUri: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during rotation',
    };
  }
}

export async function deleteGroupPhoto(groupId: string): Promise<void> {
  return deleteImage({
    imageId: groupId,
    type: 'groupPicture',
  });
}

/**
 * Verify and cleanup friend images
 * Scans all friends with photos and checks if the file actually exists.
 * If not, removes the reference from the database.
 */
export async function verifyAndCleanupFriendImages(): Promise<void> {
  try {
    const { database } = await import('@/db');
    const friendsCollection = database.get('friends');

    // Get all friends with a photo_url
    const friendsWithPhotos = await friendsCollection.query().fetch(); // Fetch all first, then filter js-side or use raw query if needed
    // Note: WatermelonDB query for non-null/non-empty string can be tricky, so let's check JS side for safety

    let cleanedCount = 0;

    await database.write(async () => {
      for (const friend of friendsWithPhotos) {
        // @ts-ignore
        if (friend.photoUrl && friend.photoUrl.length > 0) {
          // @ts-ignore
          const path = friend.photoUrl;

          // Check if file exists
          let exists = false;

          if (path.startsWith('file://') || path.startsWith('/')) {
            const info = await FileSystem.getInfoAsync(path);
            exists = info.exists;
          } else {
            // Relative path
            const fullPath = (FileSystem.documentDirectory as string) + path.replace(/^\//, '');
            const info = await FileSystem.getInfoAsync(fullPath);
            exists = info.exists;
          }

          if (!exists) {
            Logger.warn('[ImageService] Found friend with missing photo file, cleaning up:', { id: friend.id, path });
            // @ts-ignore
            await friend.update(f => {
              f.photoUrl = null;
            });
            cleanedCount++;
          }
        }
      }
    });

    if (cleanedCount > 0) {
      Logger.info(`[ImageService] Cleanup complete. Removed ${cleanedCount} broken image references.`);
    }
  } catch (error) {
    Logger.error('[ImageService] Error during image cleanup:', error);
  }
}
