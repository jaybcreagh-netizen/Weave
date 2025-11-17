// src/modules/relationships/services/image.service.ts
import { processAndStoreImage, deleteImage, ImageResult } from '@/lib/image-service';

export type ImageType = 'profilePicture' | 'journalPhoto';

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
