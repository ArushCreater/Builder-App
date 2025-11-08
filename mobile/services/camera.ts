import { Camera, CameraType, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Photo } from '../types';
import { api } from './api';

export interface CameraOptions {
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
}

export interface PhotoResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

class CameraService {
  async requestCameraPermission(): Promise<boolean> {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  }

  async requestMediaLibraryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  async takePhoto(options: CameraOptions = {}): Promise<PhotoResult | null> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      throw new Error('Camera permission not granted');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: options.quality || 0.8,
      allowsEditing: options.allowsEditing || false,
      aspect: options.aspect || [4, 3],
      exif: true,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  }

  async pickFromGallery(options: CameraOptions = {}): Promise<PhotoResult | null> {
    const hasPermission = await this.requestMediaLibraryPermission();
    if (!hasPermission) {
      throw new Error('Media library permission not granted');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: options.quality || 0.8,
      allowsEditing: options.allowsEditing || false,
      aspect: options.aspect || [4, 3],
      allowsMultipleSelection: false,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  }

  async compressImage(uri: string, quality: number = 0.7): Promise<string> {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }], // Resize to max width of 1920px
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  }

  async createThumbnail(uri: string, size: number = 300): Promise<string> {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: size } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  }

  async uploadPhoto(
    uri: string,
    projectId: string,
    caption?: string,
    location?: { latitude: number; longitude: number },
    onProgress?: (progress: number) => void
  ): Promise<Photo> {
    // Compress the image before upload
    const compressedUri = await this.compressImage(uri);

    // Create thumbnail
    const thumbnailUri = await this.createThumbnail(compressedUri);

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(compressedUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Create form data
    const formData = new FormData();

    const filename = compressedUri.split('/').pop() || 'photo.jpg';
    formData.append('photo', {
      uri: compressedUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    // Add thumbnail
    const thumbnailFilename = thumbnailUri.split('/').pop() || 'thumbnail.jpg';
    formData.append('thumbnail', {
      uri: thumbnailUri,
      type: 'image/jpeg',
      name: thumbnailFilename,
    } as any);

    formData.append('projectId', projectId);
    if (caption) {
      formData.append('caption', caption);
    }
    if (location) {
      formData.append('location', JSON.stringify(location));
    }

    // Upload
    const photo = await api.upload<Photo>('/photos', formData, onProgress);

    // Clean up temporary files
    await FileSystem.deleteAsync(compressedUri, { idempotent: true });
    await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });

    return photo;
  }

  async deletePhoto(photoId: string): Promise<void> {
    await api.delete(`/photos/${photoId}`);
  }
}

export const cameraService = new CameraService();
