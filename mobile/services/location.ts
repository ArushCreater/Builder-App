import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

export interface LocationAddress {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

class LocationService {
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude || undefined,
        accuracy: location.coords.accuracy || undefined,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }

  async getAddressFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<LocationAddress | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        return {
          street: address.street || undefined,
          city: address.city || undefined,
          region: address.region || undefined,
          postalCode: address.postalCode || undefined,
          country: address.country || undefined,
        };
      }
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  async watchPosition(
    callback: (location: LocationCoordinates) => void,
    errorCallback?: (error: Error) => void
  ): Promise<Location.LocationSubscription> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }

    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude || undefined,
          accuracy: location.coords.accuracy || undefined,
        });
      }
    );
  }

  calculateDistance(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ): number {
    // Haversine formula
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(to.latitude - from.latitude);
    const dLon = this.deg2rad(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(from.latitude)) *
        Math.cos(this.deg2rad(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const locationService = new LocationService();
