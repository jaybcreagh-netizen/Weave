// src/modules/relationships/services/__tests__/image.service.test.ts
import { uploadFriendPhoto, deleteFriendPhoto } from '../image.service';
import { processAndStoreImage, deleteImage } from '@/lib/image-service';

// Mock the image-service
jest.mock('@/lib/image-service', () => ({
  processAndStoreImage: jest.fn(),
  deleteImage: jest.fn(),
}));

describe('image.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should upload a friend photo', async () => {
    await uploadFriendPhoto('test.jpg', '1');
    expect(processAndStoreImage).toHaveBeenCalledWith({
      uri: 'test.jpg',
      type: 'profilePicture',
      imageId: '1',
    });
  });

  it('should delete a friend photo', async () => {
    await deleteFriendPhoto('1');
    expect(deleteImage).toHaveBeenCalledWith({
      imageId: '1',
      type: 'profilePicture',
    });
  });
});
