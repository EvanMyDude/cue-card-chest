/**
 * Hook to handle automatic device registration
 * Ensures every authenticated user has a registered device
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useOfflineStorage } from './useOfflineStorage';
import { registerDevice } from '@/lib/syncEngine';

const DEV = import.meta.env.DEV;

interface DeviceRegistrationState {
  deviceId: string | null;
  isRegistering: boolean;
  error: Error | null;
  needsRegistration: boolean;
}

export function useDeviceRegistration() {
  const { user } = useAuth();
  const storage = useOfflineStorage();
  const { syncEnabled } = require('@/contexts/SyncContext').useSyncContext();
  
  const [state, setState] = useState<DeviceRegistrationState>({
    deviceId: null,
    isRegistering: false,
    error: null,
    needsRegistration: false,
  });

  /**
   * Get browser and platform info for default device name
   */
  const getDefaultDeviceName = useCallback((): string => {
    const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' :
                    navigator.userAgent.includes('Firefox') ? 'Firefox' :
                    navigator.userAgent.includes('Safari') ? 'Safari' :
                    navigator.userAgent.includes('Edge') ? 'Edge' : 'Browser';
    
    const platform = navigator.userAgent.includes('Mobile') ? 'Mobile' :
                     navigator.userAgent.includes('Tablet') ? 'Tablet' : 'Desktop';
    
    return `${browser} ${platform}`;
  }, []);

  /**
   * Register device with server
   */
  const registerUserDevice = useCallback(
    async (deviceName?: string): Promise<string | null> => {
      if (!user || !storage.isReady) {
        if (DEV) console.info('[DeviceRegistration] Cannot register: user or storage not ready');
        return null;
      }

      setState(prev => ({ ...prev, isRegistering: true, error: null }));

      try {
        const name = deviceName || getDefaultDeviceName();
        const deviceType = navigator.userAgent.includes('Mobile') ? 'mobile' : 'web';
        
        if (DEV) console.info('[DeviceRegistration] Registering device:', { name, deviceType, userId: user.id });
        
        const { deviceId, lastSeenAt } = await registerDevice(name, deviceType);
        
        // Store device info in IndexedDB
        await storage.setDeviceInfo({
          device_id: deviceId,
          device_name: name,
          device_type: deviceType,
          last_sync_at: lastSeenAt,
        });

        setState({
          deviceId,
          isRegistering: false,
          error: null,
          needsRegistration: false,
        });

        if (DEV) console.info('[DeviceRegistration] Device registered successfully:', deviceId);
        
        return deviceId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[DeviceRegistration] Registration failed:', error);
        
        setState(prev => ({
          ...prev,
          isRegistering: false,
          error,
        }));
        
        return null;
      }
    },
    [user, storage, getDefaultDeviceName]
  );

  /**
   * Check if device needs registration and auto-register
   */
  const checkAndRegister = useCallback(async () => {
    // Skip if sync is disabled
    if (!syncEnabled || !user || !storage.isReady) {
      return;
    }

    try {
      const deviceInfo = await storage.getDeviceInfo();
      
      if (deviceInfo?.device_id) {
        // Device already registered
        setState({
          deviceId: deviceInfo.device_id,
          isRegistering: false,
          error: null,
          needsRegistration: false,
        });
        
        if (DEV) console.info('[DeviceRegistration] Device already registered:', deviceInfo.device_id);
      } else {
        // No device ID - needs registration
        if (DEV) console.info('[DeviceRegistration] No device ID found, auto-registering...');
        
        setState(prev => ({
          ...prev,
          needsRegistration: true,
        }));
        
        // Auto-register with default name
        await registerUserDevice();
      }
    } catch (err) {
      console.error('[DeviceRegistration] Check failed:', err);
    }
  }, [user, storage, registerUserDevice]);

  /**
   * Auto-check on mount and when user/storage changes
   */
  useEffect(() => {
    checkAndRegister();
  }, [checkAndRegister]);

  return {
    deviceId: state.deviceId,
    isRegistering: state.isRegistering,
    error: state.error,
    needsRegistration: state.needsRegistration,
    registerUserDevice,
    checkAndRegister,
  };
}
