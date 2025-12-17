// src/modules/relationships/services/__tests__/image.service.test.ts
import { uploadFriendPhoto, deleteFriendPhoto } from '../image.service';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';

// Mock external dependencies
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/doc/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Image: {
    getSize: jest.fn(),
  },
}));

describe('image.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'manipulated.jpg',
    });
    (Image.getSize as jest.Mock).mockImplementation((uri, success) => {
      success(1000, 1000); // Default square image
    });
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['profilePicture_1.jpg']);
  });

  it('should upload a friend photo (square)', async () => {
    await uploadFriendPhoto('original.jpg', '1');

    // Should get size
    expect(Image.getSize).toHaveBeenCalled();

    // Should manipulate (resize only since it's square)
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'original.jpg',
      [
        { resize: { width: 400, height: 400 } }
      ],
      expect.any(Object)
    );
  });

  it('should upload a friend photo (landscape) and crop it', async () => {
    // Mock landscape image
    (Image.getSize as jest.Mock).mockImplementation((uri, success) => {
      success(1000, 500); // Width 1000, Height 500
    });

    await uploadFriendPhoto('original.jpg', '1');

    expect(Image.getSize).toHaveBeenCalled();

    // Should manipulate with crop then resize
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'original.jpg',
      [
        {
          crop: {
            originX: 250, // (1000 - 500) / 2
            originY: 0,
            width: 500,
            height: 500
          }
        },
        { resize: { width: 400, height: 400 } }
      ],
      expect.any(Object)
    );
  });

  it('should delete a friend photo', async () => {
    await deleteFriendPhoto('1');
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });
});
