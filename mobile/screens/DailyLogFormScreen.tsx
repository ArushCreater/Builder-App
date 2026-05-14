import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { cameraService } from '../services/camera';
import { locationService, LocationCoordinates } from '../services/location';
import { api } from '../services/api';
import { DailyLog } from '../types';

export default function DailyLogFormScreen() {
  const { projectId, logId } = useLocalSearchParams<{ projectId: string; logId?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);

  const [formData, setFormData] = useState({
    workPerformed: '',
    contractors: '',
    subcontractors: '',
    visitors: '',
    materials: '',
    equipment: '',
    safetyIncidents: '',
    notes: '',
    weatherCondition: '',
    weatherTemperature: '',
  });

  useEffect(() => {
    getCurrentLocation();
    if (logId) {
      loadDailyLog();
    }
  }, [logId]);

  const getCurrentLocation = async () => {
    try {
      const coords = await locationService.getCurrentLocation();
      setLocation(coords);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadDailyLog = async () => {
    if (!logId) return;
    try {
      const log = await api.get<DailyLog>(`/daily-logs/${logId}`);
      setFormData({
        workPerformed: log.workPerformed,
        contractors: log.manpower.contractors.toString(),
        subcontractors: log.manpower.subcontractors.toString(),
        visitors: log.manpower.visitors.toString(),
        materials: log.materials || '',
        equipment: log.equipment || '',
        safetyIncidents: log.safetyIncidents || '',
        notes: log.notes || '',
        weatherCondition: log.weather?.condition || '',
        weatherTemperature: log.weather?.temperature.toString() || '',
      });
      setPhotos(log.photos.map(p => p.url));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load daily log');
    }
  };

  const takePhoto = async () => {
    try {
      const photo = await cameraService.takePhoto();
      if (photo) {
        setPhotos([...photos, photo.uri]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to take photo');
    }
  };

  const pickPhoto = async () => {
    try {
      const photo = await cameraService.pickFromGallery();
      if (photo) {
        setPhotos([...photos, photo.uri]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick photo');
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const handleSubmit = async () => {
    if (!formData.workPerformed.trim()) {
      Alert.alert('Error', 'Please describe the work performed');
      return;
    }

    setLoading(true);
    try {
      const data = {
        projectId,
        workPerformed: formData.workPerformed,
        manpower: {
          contractors: parseInt(formData.contractors) || 0,
          subcontractors: parseInt(formData.subcontractors) || 0,
          visitors: parseInt(formData.visitors) || 0,
        },
        materials: formData.materials || undefined,
        equipment: formData.equipment || undefined,
        safetyIncidents: formData.safetyIncidents || undefined,
        notes: formData.notes || undefined,
        weather: formData.weatherCondition
          ? {
              condition: formData.weatherCondition,
              temperature: parseFloat(formData.weatherTemperature) || 0,
            }
          : undefined,
        location: location || undefined,
      };

      let dailyLog: DailyLog;
      if (logId) {
        dailyLog = await api.patch(`/daily-logs/${logId}`, data);
      } else {
        dailyLog = await api.post('/daily-logs', data);
      }

      // Upload photos
      if (photos.length > 0) {
        if (!projectId) {
          throw new Error('Project is required before uploading photos');
        }
        await Promise.all(
          photos.map((photoUri) =>
            cameraService.uploadPhoto(photoUri, projectId, undefined, location || undefined)
          )
        );
      }

      Alert.alert('Success', 'Daily log saved successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save daily log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={logId ? 'Edit Daily Log' : 'New Daily Log'}
        showBack
        rightComponent={
          <TouchableOpacity onPress={handleSubmit} disabled={loading}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView style={styles.scrollView}>
        {/* Location */}
        {location && (
          <Card style={styles.card}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color="#10b981" />
              <Text style={styles.locationText}>
                Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            </View>
          </Card>
        )}

        {/* Work Performed */}
        <Card style={styles.card}>
          <Text style={styles.label}>Work Performed *</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Describe the work performed today..."
            value={formData.workPerformed}
            onChangeText={(text) => setFormData({ ...formData, workPerformed: text })}
          />
        </Card>

        {/* Manpower */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Manpower</Text>
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Input
                label="Contractors"
                keyboardType="number-pad"
                value={formData.contractors}
                onChangeText={(text) => setFormData({ ...formData, contractors: text })}
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Subcontractors"
                keyboardType="number-pad"
                value={formData.subcontractors}
                onChangeText={(text) => setFormData({ ...formData, subcontractors: text })}
              />
            </View>
          </View>
          <Input
            label="Visitors"
            keyboardType="number-pad"
            value={formData.visitors}
            onChangeText={(text) => setFormData({ ...formData, visitors: text })}
          />
        </Card>

        {/* Weather */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Weather</Text>
          <Input
            label="Condition"
            placeholder="Sunny, Cloudy, Rainy..."
            value={formData.weatherCondition}
            onChangeText={(text) => setFormData({ ...formData, weatherCondition: text })}
          />
          <Input
            label="Temperature (°F)"
            keyboardType="decimal-pad"
            value={formData.weatherTemperature}
            onChangeText={(text) => setFormData({ ...formData, weatherTemperature: text })}
          />
        </Card>

        {/* Materials & Equipment */}
        <Card style={styles.card}>
          <Text style={styles.label}>Materials Used</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder="List materials used..."
            value={formData.materials}
            onChangeText={(text) => setFormData({ ...formData, materials: text })}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.label}>Equipment Used</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder="List equipment used..."
            value={formData.equipment}
            onChangeText={(text) => setFormData({ ...formData, equipment: text })}
          />
        </Card>

        {/* Safety */}
        <Card style={styles.card}>
          <Text style={styles.label}>Safety Incidents</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder="Report any safety incidents..."
            value={formData.safetyIncidents}
            onChangeText={(text) => setFormData({ ...formData, safetyIncidents: text })}
          />
        </Card>

        {/* Notes */}
        <Card style={styles.card}>
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Any additional notes..."
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
          />
        </Card>

        {/* Photos */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.photoButtons}>
            <Button
              title="Take Photo"
              onPress={takePhoto}
              variant="outline"
              size="small"
            />
            <Button
              title="Choose from Gallery"
              onPress={pickPhoto}
              variant="outline"
              size="small"
              style={{ marginLeft: 8 }}
            />
          </View>
        </Card>

        <View style={styles.submitContainer}>
          <Button
            title={logId ? 'Update Daily Log' : 'Create Daily Log'}
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  saveButton: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  photoButtons: {
    flexDirection: 'row',
  },
  submitContainer: {
    padding: 16,
  },
});
