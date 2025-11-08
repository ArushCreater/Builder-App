import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return {
    isOffline,
    isConnected,
  };
}
