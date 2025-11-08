import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Button } from '../../components/Button';
import { DailyLog } from '../../types';
import { api } from '../../services/api';
import { format } from 'date-fns';

export default function DailyLogsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setError(null);
      const data = await api.get<DailyLog[]>('/daily-logs');
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load daily logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const renderLog = ({ item }: { item: DailyLog }) => (
    <Card
      style={styles.logCard}
      onPress={() =>
        router.push(`/daily-log-form?projectId=${item.projectId}&logId=${item.id}`)
      }
    >
      <View style={styles.logHeader}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateDay}>
            {format(new Date(item.date), 'dd')}
          </Text>
          <Text style={styles.dateMonth}>
            {format(new Date(item.date), 'MMM')}
          </Text>
        </View>
        <View style={styles.logInfo}>
          <Text style={styles.logProject} numberOfLines={1}>
            Project ID: {item.projectId}
          </Text>
          <Text style={styles.logCreator}>
            By {item.createdBy.name}
          </Text>
        </View>
      </View>

      <Text style={styles.workPerformed} numberOfLines={3}>
        {item.workPerformed}
      </Text>

      <View style={styles.logMeta}>
        {item.weather && (
          <View style={styles.metaItem}>
            <Ionicons name="partly-sunny" size={16} color="#f59e0b" />
            <Text style={styles.metaText}>
              {item.weather.condition} {item.weather.temperature}°F
            </Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="people" size={16} color="#64748b" />
          <Text style={styles.metaText}>
            {item.manpower.contractors + item.manpower.subcontractors} workers
          </Text>
        </View>
        {item.photos.length > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="images" size={16} color="#64748b" />
            <Text style={styles.metaText}>{item.photos.length} photos</Text>
          </View>
        )}
      </View>

      {item.location && (
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={14} color="#10b981" />
          <Text style={styles.locationText}>
            {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
          </Text>
        </View>
      )}
    </Card>
  );

  if (loading) {
    return <Loading message="Loading daily logs..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadLogs} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Logs</Text>
        <TouchableOpacity
          onPress={() => router.push('/daily-log-form?projectId=select')}
        >
          <Ionicons name="add-circle" size={32} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>No daily logs yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first daily log to track progress
            </Text>
            <Button
              title="Create Daily Log"
              onPress={() => router.push('/daily-log-form?projectId=select')}
              style={styles.emptyButton}
            />
          </View>
        }
      />
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  list: {
    padding: 16,
  },
  logCard: {
    marginBottom: 16,
  },
  logHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dateContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingVertical: 8,
    marginRight: 12,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563eb',
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  logInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  logProject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  logCreator: {
    fontSize: 14,
    color: '#64748b',
  },
  workPerformed: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  logMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#10b981',
    fontFamily: 'monospace',
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
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    minWidth: 200,
  },
});
