import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextData {
  backendIp: string;
  setBackendIp: (ip: string) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextData>({
  backendIp: '10.104.28.241', // Default fallback
  setBackendIp: async () => {},
  isLoading: true,
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [backendIp, setBackendIpState] = useState('10.104.28.241');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load IP from storage on mount
    const loadSettings = async () => {
      try {
        const storedIp = await AsyncStorage.getItem('@backend_ip');
        if (storedIp && storedIp !== '192.168.43.100') {
          setBackendIpState(storedIp);
        }
      } catch (e) {
        console.log('Failed to load backend IP from storage (non-critical)', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const setBackendIp = (ip: string) => {
    setBackendIpState(ip);
    AsyncStorage.setItem('@backend_ip', ip).catch((e) => {
      console.log('Failed to save backend IP to storage (non-critical)', e);
    });
  };

  return (
    <SettingsContext.Provider value={{ backendIp, setBackendIp, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}
