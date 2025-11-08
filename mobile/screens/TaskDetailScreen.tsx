import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button } from '../components/Button';
import { Task } from '../types';
import { api } from '../services/api';
import { format } from 'date-fns';

export default function TaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      setError(null);
      const data = await api.get<Task>(`/tasks/${taskId}`);
      setTask(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (status: Task['status']) => {
    if (!task) return;

    setUpdating(true);
    try {
      const updatedTask = await api.patch<Task>(`/tasks/${taskId}`, { status });
      setTask(updatedTask);
      Alert.alert('Success', 'Task status updated');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#f97316',
      urgent: '#ef4444',
    };
    return colors[priority] || '#64748b';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: '#64748b',
      in_progress: '#3b82f6',
      review: '#f59e0b',
      completed: '#10b981',
    };
    return colors[status] || '#64748b';
  };

  if (loading) {
    return <Loading message="Loading task..." />;
  }

  if (error || !task) {
    return <ErrorMessage message={error || 'Task not found'} onRetry={loadTask} />;
  }

  return (
    <View style={styles.container}>
      <Header title="Task Details" showBack />
      <ScrollView style={styles.scrollView}>
        {/* Task Header */}
        <Card style={styles.card}>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: getStatusColor(task.status) }]}>
              <Text style={styles.badgeText}>{task.status.replace('_', ' ')}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getPriorityColor(task.priority) }]}>
              <Text style={styles.badgeText}>{task.priority}</Text>
            </View>
          </View>
        </Card>

        {/* Task Details */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          {task.description && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={20} color="#64748b" />
              <Text style={styles.description}>{task.description}</Text>
            </View>
          )}
          {task.assignee && (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={20} color="#64748b" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Assigned To</Text>
                <Text style={styles.detailValue}>{task.assignee.name}</Text>
              </View>
            </View>
          )}
          {task.startDate && (
            <View style={styles.detailRow}>
              <Ionicons name="play-outline" size={20} color="#64748b" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Start Date</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(task.startDate), 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>
          )}
          {task.dueDate && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#64748b" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Due Date</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>
          )}
          {task.completedAt && (
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Completed At</Text>
                <Text style={styles.detailValue}>
                  {format(new Date(task.completedAt), 'MMM dd, yyyy HH:mm')}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Status Update */}
        {task.status !== 'completed' && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.statusButtons}>
              {task.status === 'todo' && (
                <Button
                  title="Start Task"
                  onPress={() => updateTaskStatus('in_progress')}
                  loading={updating}
                  style={styles.statusButton}
                />
              )}
              {task.status === 'in_progress' && (
                <>
                  <Button
                    title="Move to Review"
                    onPress={() => updateTaskStatus('review')}
                    loading={updating}
                    style={styles.statusButton}
                  />
                  <Button
                    title="Complete"
                    variant="primary"
                    onPress={() => updateTaskStatus('completed')}
                    loading={updating}
                    style={styles.statusButton}
                  />
                </>
              )}
              {task.status === 'review' && (
                <Button
                  title="Mark Complete"
                  onPress={() => updateTaskStatus('completed')}
                  loading={updating}
                  style={styles.statusButton}
                />
              )}
            </View>
          </Card>
        )}
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
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  description: {
    flex: 1,
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    marginLeft: 12,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  statusButtons: {
    gap: 12,
  },
  statusButton: {
    marginBottom: 0,
  },
});
