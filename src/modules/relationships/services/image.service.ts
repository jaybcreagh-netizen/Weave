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

export type ImageType = 'profilePicture' | 'journalPhoto';

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
    console.log('[ImageService] Created local storage directory:', LOCAL_STORAGE_DIR);
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

    console.log(`[ImageService] Processing ${type}:`, imageId);

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
    // Only apply for profile pictures or if we want square images
    if (type === 'profilePicture' && Math.abs(width - height) > 5) {
      const size = Math.min(width, height);
      const originX = (width - size) / 2;
      const originY = (height - size) / 2;

      console.log(`[ImageService] Cropping to square: ${size}x${size} at (${originX}, ${originY})`);

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

    console.log('[ImageService] Processed:', {
      originalSize: `${width}x${height}`,
      processedUri: manipulatedImage.uri,
    });

    // Step 4: Save to local storage (persistent)
    const fileName = `${type}_${imageId}.jpg`;
    const localUri = `${LOCAL_STORAGE_DIR}${fileName}`;

    await FileSystem.copyAsync({
      from: manipulatedImage.uri,
      to: localUri
    });

    console.log('[ImageService] Saved locally:', localUri);

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
        console.log('[ImageService] Uploaded to cloud:', cloudUrl);
      } catch (cloudError) {
        console.warn('[ImageService] Cloud upload failed (continuing with local):', cloudError);
        // Don't fail the whole operation - image is still saved locally
      }
    }

    return {
      localUri,
      cloudUrl,
      success: true,
    };
  } catch (error) {
    console.error('[ImageService] Error processing image:', error);
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
    const fileName = `${type}_${imageId}.jpg`;
    const localUri = `${LOCAL_STORAGE_DIR}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(localUri);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      console.log('[ImageService] Deleted local file:', localUri);
    }

    // Delete from cloud (if enabled)
    if (ENABLE_CLOUD_STORAGE && userId) {
      try {
        await deleteFromSupabase({ userId, imageId, type });
        console.log('[ImageService] Deleted from cloud');
      } catch (cloudError) {
        console.warn('[ImageService] Cloud deletion failed:', cloudError);
      }
    }
  } catch (error) {
    console.error('[ImageService] Error deleting image:', error);
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
  const fileName = `${type}_${imageId}.jpg`;
  const localUri = `${LOCAL_STORAGE_DIR}${fileName}`;
  const fileInfo = await FileSystem.getInfoAsync(localUri);

  if (fileInfo.exists) {
    return localUri;
  }

  // If cloud URL exists, download and cache
  if (cloudUrl && ENABLE_CLOUD_STORAGE) {
    try {
      await ensureDirectoryExists();
      await FileSystem.downloadAsync(cloudUrl, localUri);
      console.log('[ImageService] Downloaded from cloud to cache:', localUri);
      return localUri;
    } catch (error) {
      console.warn('[ImageService] Failed to download from cloud:', error);
    }
  }

  return null;
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
          console.log('[ImageService] Cleaned up orphaned image:', item);
        }
      }
    }
  } catch (error) {
    console.error('[ImageService] Error cleaning up orphaned images:', error);
  }
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
    console.error('[ImageService] Error getting storage stats:', error);
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
