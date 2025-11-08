import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { ErrorMessage } from '../components/ErrorMessage';
import { Document } from '../types';
import { api } from '../services/api';
import { format } from 'date-fns';

export default function DocumentsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const loadDocuments = async () => {
    try {
      setError(null);
      const data = await api.get<Document[]>(`/projects/${projectId}/documents`);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      contract: 'document-text',
      blueprint: 'construct',
      permit: 'shield-checkmark',
      invoice: 'receipt',
      other: 'document',
    };
    return icons[type] || 'document';
  };

  const getDocumentColor = (type: string) => {
    const colors: Record<string, string> = {
      contract: '#3b82f6',
      blueprint: '#8b5cf6',
      permit: '#10b981',
      invoice: '#f59e0b',
      other: '#64748b',
    };
    return colors[type] || '#64748b';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleOpenDocument = async (document: Document) => {
    try {
      const supported = await Linking.canOpenURL(document.fileUrl);
      if (supported) {
        await Linking.openURL(document.fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open this document type');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <Card style={styles.documentCard} onPress={() => handleOpenDocument(item)}>
      <View style={styles.documentContent}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: getDocumentColor(item.type) + '20' },
          ]}
        >
          <Ionicons
            name={getDocumentIcon(item.type)}
            size={24}
            color={getDocumentColor(item.type)}
          />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.documentMeta}>
            <Text style={styles.documentType}>{item.type.toUpperCase()}</Text>
            <Text style={styles.documentDivider}>•</Text>
            <Text style={styles.documentSize}>{formatFileSize(item.fileSize)}</Text>
          </View>
          <Text style={styles.documentDate}>
            Uploaded {format(new Date(item.createdAt), 'MMM dd, yyyy')} by{' '}
            {item.uploadedBy.name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
      </View>
    </Card>
  );

  if (loading) {
    return <Loading message="Loading documents..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadDocuments} />;
  }

  return (
    <View style={styles.container}>
      <Header
        title="Documents"
        subtitle={`${documents.length} documents`}
        showBack
      />
      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>No documents</Text>
            <Text style={styles.emptySubtext}>
              Documents will appear here when uploaded
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
  },
  documentCard: {
    marginBottom: 12,
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  documentType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  documentDivider: {
    marginHorizontal: 6,
    color: '#cbd5e1',
    fontSize: 12,
  },
  documentSize: {
    fontSize: 12,
    color: '#94a3b8',
  },
  documentDate: {
    fontSize: 12,
    color: '#94a3b8',
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
  },
});
