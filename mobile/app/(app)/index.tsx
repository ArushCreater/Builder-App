import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { ErrorMessage } from '../../components/ErrorMessage';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { Project, Task } from '../../types';

interface DashboardStats {
  activeProjects: number;
  pendingTasks: number;
  completedThisWeek: number;
  upcomingDeadlines: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const [statsData, projectsData, tasksData] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<Project[]>('/projects?limit=3&sort=updatedAt'),
        api.get<Task[]>('/tasks?priority=urgent,high&status=todo,in_progress&limit=5'),
      ]);
      setStats(statsData);
      setRecentProjects(projectsData);
      setUrgentTasks(tasksData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <Loading message="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadDashboardData} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={40} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        {stats && (
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="folder" size={24} color="#2563eb" />
              </View>
              <Text style={styles.statValue}>{stats.activeProjects}</Text>
              <Text style={styles.statLabel}>Active Projects</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="time" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{stats.pendingTasks}</Text>
              <Text style={styles.statLabel}>Pending Tasks</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{stats.completedThisWeek}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
              </View>
              <Text style={styles.statValue}>{stats.upcomingDeadlines}</Text>
              <Text style={styles.statLabel}>Due Soon</Text>
            </Card>
          </View>
        )}

        {/* Recent Projects */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Projects</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/projects')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentProjects.map((project) => (
            <Card
              key={project.id}
              style={styles.projectCard}
              onPress={() => router.push(`/project-detail?projectId=${project.id}`)}
            >
              <View style={styles.projectHeader}>
                <Text style={styles.projectName}>{project.name}</Text>
                <View style={styles.progressBadge}>
                  <Text style={styles.progressText}>{project.progress}%</Text>
                </View>
              </View>
              <Text style={styles.projectAddress}>{project.address}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${project.progress}%` }]}
                />
              </View>
            </Card>
          ))}
        </View>

        {/* Urgent Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Priority Tasks</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/tasks')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {urgentTasks.length > 0 ? (
            urgentTasks.map((task) => (
              <Card
                key={task.id}
                style={styles.taskCard}
                onPress={() => router.push(`/task-detail?taskId=${task.id}`)}
              >
                <View style={styles.taskHeader}>
                  <View style={styles.taskInfo}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.assignee && (
                      <Text style={styles.taskAssignee}>
                        Assigned to {task.assignee.name}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor:
                          task.priority === 'urgent' ? '#fee2e2' : '#fed7aa',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        {
                          color: task.priority === 'urgent' ? '#dc2626' : '#ea580c',
                        },
                      ]}
                    >
                      {task.priority}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Text style={styles.emptyText}>No priority tasks</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(app)/projects')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="add" size={24} color="#2563eb" />
              </View>
              <Text style={styles.actionText}>New Project</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(app)/daily-logs')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="document-text" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.actionText}>Daily Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(app)/tasks')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="checkmark-done" size={24} color="#10b981" />
              </View>
              <Text style={styles.actionText}>New Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  viewAll: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  projectCard: {
    marginBottom: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  progressBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  projectAddress: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  taskCard: {
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  taskAssignee: {
    fontSize: 14,
    color: '#64748b',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 24,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
});
