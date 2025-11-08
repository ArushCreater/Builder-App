import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from './api';
import { User, LoginCredentials, RegisterData, AuthTokens } from '../types';
import { storage } from '../utils/storage';

class AuthService {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login', credentials);
    await this.saveTokens(response.tokens);
    await storage.setItem('user', response.user);
    return response;
  }

  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await api.post<{ user: User; tokens: AuthTokens }>('/auth/register', data);
    await this.saveTokens(response.tokens);
    await storage.setItem('user', response.user);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearTokens();
      await storage.removeItem('user');
    }
  }

  async getCurrentUser(): Promise<User> {
    const user = await api.get<User>('/auth/me');
    await storage.setItem('user', user);
    return user;
  }

  async saveTokens(tokens: AuthTokens): Promise<void> {
    await SecureStore.setItemAsync('accessToken', tokens.accessToken);
    await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
    await SecureStore.setItemAsync('expiresAt', tokens.expiresAt.toString());
  }

  async getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('accessToken');
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('expiresAt');
  }

  async checkBiometricSupport(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access BuilderTrend',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });
    return result.success;
  }

  async enableBiometricAuth(): Promise<void> {
    const isSupported = await this.checkBiometricSupport();
    if (isSupported) {
      await storage.setItem('biometricEnabled', true);
    } else {
      throw new Error('Biometric authentication is not available on this device');
    }
  }

  async disableBiometricAuth(): Promise<void> {
    await storage.removeItem('biometricEnabled');
  }

  async isBiometricEnabled(): Promise<boolean> {
    return (await storage.getItem<boolean>('biometricEnabled')) ?? false;
  }
}

export const authService = new AuthService();
