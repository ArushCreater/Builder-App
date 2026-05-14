import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Loading } from '../components/Loading';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button } from '../components/Button';
import { Photo } from '../types';
import { api } from '../services/api';
import { cameraService } from '../services/camera';
import { locationService } from '../services/location';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3;

export default function PhotoGalleryScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, [projectId]);

  const loadPhotos = async () => {
    try {
      setError(null);
      const data = await api.get<Photo[]>(`/projects/${projectId}/photos`);
      setPhotos(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!projectId) {
      Alert.alert('Error', 'Project is required before uploading photos');
      return;
    }

    try {
      const photo = await cameraService.takePhoto();
      if (photo) {
        setUploading(true);
        const location = await locationService.getCurrentLocation();
        const uploadedPhoto = await cameraService.uploadPhoto(
          photo.uri,
          projectId,
          undefined,
          location || undefined
        );
        setPhotos([uploadedPhoto, ...photos]);
        Alert.alert('Success', 'Photo uploaded successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handlePickPhoto = async () => {
    if (!projectId) {
      Alert.alert('Error', 'Project is required before uploading photos');
      return;
    }

    try {
      const photo = await cameraService.pickFromGallery();
      if (photo) {
        setUploading(true);
        const location = await locationService.getCurrentLocation();
        const uploadedPhoto = await cameraService.uploadPhoto(
          photo.uri,
          projectId,
          undefined,
          location || undefined
        );
        setPhotos([uploadedPhoto, ...photos]);
        Alert.alert('Success', 'Photo uploaded successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await cameraService.deletePhoto(photoId);
              setPhotos(photos.filter((p) => p.id !== photoId));
              setSelectedPhoto(null);
              Alert.alert('Success', 'Photo deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete photo');
            }
          },
        },
      ]
    );
  };

  const renderPhoto = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => setSelectedPhoto(item)}
    >
      <Image
        source={{ uri: item.thumbnailUrl || item.url }}
        style={styles.thumbnail}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return <Loading message="Loading photos..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadPhotos} />;
  }

  return (
    <View style={styles.container}>
      <Header
        title="Photos"
        subtitle={`${photos.length} photos`}
        showBack
      />

      <View style={styles.actions}>
        <Button
          title="Take Photo"
          onPress={handleTakePhoto}
          loading={uploading}
          size="small"
        />
        <Button
          title="Choose Photo"
          variant="outline"
          onPress={handlePickPhoto}
          loading={uploading}
          size="small"
          style={{ marginLeft: 8 }}
        />
      </View>

      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>
              Take or upload photos to get started
            </Text>
          </View>
        }
      />

      {/* Full Screen Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setSelectedPhoto(null)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectedPhoto && handleDeletePhoto(selectedPhoto.id)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {selectedPhoto && (
            <>
              <Image
                source={{ uri: selectedPhoto.url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.photoInfo}>
                {selectedPhoto.caption && (
                  <Text style={styles.caption}>{selectedPhoto.caption}</Text>
                )}
                <Text style={styles.photoDate}>
                  {format(new Date(selectedPhoto.takenAt), 'MMM dd, yyyy HH:mm')}
                </Text>
                <Text style={styles.photoUploader}>
                  By {selectedPhoto.uploadedBy.name}
                </Text>
                {selectedPhoto.location && (
                  <Text style={styles.photoLocation}>
                    📍 {selectedPhoto.location.latitude.toFixed(6)},{' '}
                    {selectedPhoto.location.longitude.toFixed(6)}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  grid: {
    padding: 12,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  modal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  closeButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  fullImage: {
    flex: 1,
    width: '100%',
  },
  photoInfo: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  caption: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  photoDate: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  photoUploader: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  photoLocation: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
});
