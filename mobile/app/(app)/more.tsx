import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);

  React.useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const enabled = await authService.isBiometricEnabled();
    setBiometricEnabled(enabled);
  };

  const toggleBiometric = async () => {
    try {
      if (biometricEnabled) {
        await authService.disableBiometricAuth();
        setBiometricEnabled(false);
        Alert.alert('Success', 'Biometric authentication disabled');
      } else {
        await authService.enableBiometricAuth();
        setBiometricEnabled(true);
        Alert.alert('Success', 'Biometric authentication enabled');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const MenuItem = ({
    icon,
    title,
    onPress,
    rightComponent,
    danger = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.menuItemLeft}>
        <View
          style={[
            styles.iconContainer,
            danger && { backgroundColor: '#fee2e2' },
          ]}
        >
          <Ionicons
            name={icon}
            size={20}
            color={danger ? '#ef4444' : '#2563eb'}
          />
        </View>
        <Text style={[styles.menuItemText, danger && { color: '#ef4444' }]}>
          {title}
        </Text>
      </View>
      {rightComponent || (
        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color="#2563eb" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
            </View>
          </View>
        </Card>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card>
            <MenuItem
              icon="person-outline"
              title="Edit Profile"
              onPress={() => Alert.alert('Coming Soon', 'Profile editing coming soon')}
            />
            <MenuItem
              icon="notifications-outline"
              title="Notifications"
              onPress={() =>
                Alert.alert('Coming Soon', 'Notification settings coming soon')
              }
            />
            <MenuItem
              icon="lock-closed-outline"
              title="Change Password"
              onPress={() =>
                Alert.alert('Coming Soon', 'Password change coming soon')
              }
            />
          </Card>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Card>
            <MenuItem
              icon="finger-print"
              title="Biometric Login"
              rightComponent={
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                  thumbColor={biometricEnabled ? '#2563eb' : '#f1f5f9'}
                />
              }
            />
            <MenuItem
              icon="moon-outline"
              title="Dark Mode"
              rightComponent={
                <Switch
                  value={darkModeEnabled}
                  onValueChange={setDarkModeEnabled}
                  trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                  thumbColor={darkModeEnabled ? '#2563eb' : '#f1f5f9'}
                />
              }
            />
            <MenuItem
              icon="language-outline"
              title="Language"
              onPress={() => Alert.alert('Coming Soon', 'Language settings coming soon')}
            />
          </Card>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Card>
            <MenuItem
              icon="help-circle-outline"
              title="Help Center"
              onPress={() => Alert.alert('Coming Soon', 'Help center coming soon')}
            />
            <MenuItem
              icon="chatbubble-outline"
              title="Contact Support"
              onPress={() => Alert.alert('Coming Soon', 'Contact support coming soon')}
            />
            <MenuItem
              icon="document-text-outline"
              title="Terms & Privacy"
              onPress={() => Alert.alert('Coming Soon', 'Terms & Privacy coming soon')}
            />
          </Card>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Card>
            <MenuItem
              icon="information-circle-outline"
              title="App Version"
              rightComponent={<Text style={styles.versionText}>1.0.0</Text>}
            />
          </Card>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <Card>
            <MenuItem
              icon="log-out-outline"
              title="Logout"
              onPress={handleLogout}
              danger
            />
          </Card>
        </View>

        <View style={{ height: 40 }} />
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
  scrollView: {
    flex: 1,
  },
  profileCard: {
    margin: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  versionText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});
