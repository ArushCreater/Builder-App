import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button } from '../components/Button';
import { Project, Task, Photo } from '../types';
import { api } from '../services/api';
import { format } from 'date-fns';

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setError(null);
      const [projectData, tasksData, photosData] = await Promise.all([
        api.get<Project>(`/projects/${projectId}`),
        api.get<Task[]>(`/projects/${projectId}/tasks?limit=5`),
        api.get<Photo[]>(`/projects/${projectId}/photos?limit=6`),
      ]);
      setProject(projectData);
      setTasks(tasksData);
      setPhotos(photosData);
    } catch (err: any) {
      setError(err.message || 'Failed to load project details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProjectData();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: '#f59e0b',
      active: '#10b981',
      on_hold: '#f59e0b',
      completed: '#6366f1',
      cancelled: '#ef4444',
    };
    return colors[status] || '#64748b';
  };

  if (loading) {
    return <Loading message="Loading project details..." />;
  }

  if (error || !project) {
    return <ErrorMessage message={error || 'Project not found'} onRetry={loadProjectData} />;
  }

  return (
    <View style={styles.container}>
      <Header
        title={project.name}
        subtitle={project.address}
        showBack
      />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Project Image */}
        {project.imageUrl && (
          <Image source={{ uri: project.imageUrl }} style={styles.headerImage} />
        )}

        {/* Status and Progress */}
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(project.status) }]} />
              <Text style={styles.statusText}>{project.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
            <Text style={styles.progressText}>{project.progress}% Complete</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${project.progress}%` }]} />
          </View>
        </Card>

        {/* Project Info */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Project Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#64748b" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Start Date</Text>
              <Text style={styles.infoValue}>
                {format(new Date(project.startDate), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>
          {project.endDate && (
            <View style={styles.infoRow}>
              <Ionicons name="flag-outline" size={20} color="#64748b" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>End Date</Text>
                <Text style={styles.infoValue}>
                  {format(new Date(project.endDate), 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#64748b" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Project Manager</Text>
              <Text style={styles.infoValue}>{project.projectManager.name}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={20} color="#64748b" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Client</Text>
              <Text style={styles.infoValue}>{project.client.name}</Text>
            </View>
          </View>
        </Card>

        {/* Recent Tasks */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Tasks</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/tasks')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskItem}
              onPress={() => router.push(`/task-detail?taskId=${task.id}`)}
            >
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.dueDate && (
                  <Text style={styles.taskDate}>
                    Due: {format(new Date(task.dueDate), 'MMM dd')}
                  </Text>
                )}
              </View>
              <View style={[styles.taskStatus, { backgroundColor: getStatusColor(task.status) }]}>
                <Text style={styles.taskStatusText}>{task.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Recent Photos */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Photos</Text>
            <TouchableOpacity
              onPress={() => router.push(`/photo-gallery?projectId=${projectId}`)}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoItem}
                onPress={() => router.push(`/photo-gallery?projectId=${projectId}`)}
              >
                <Image
                  source={{ uri: photo.thumbnailUrl || photo.url }}
                  style={styles.photoImage}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Add Daily Log"
            onPress={() => router.push(`/daily-log-form?projectId=${projectId}`)}
            icon="add-circle-outline"
          />
          <Button
            title="View Documents"
            variant="outline"
            onPress={() => router.push(`/documents?projectId=${projectId}`)}
            style={styles.actionButton}
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
  headerImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e2e8f0',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 4,
  },
  taskDate: {
    fontSize: 12,
    color: '#64748b',
  },
  taskStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  taskStatusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  photoItem: {
    width: '31.333%',
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    padding: 16,
  },
  actionButton: {
    marginTop: 12,
  },
});
