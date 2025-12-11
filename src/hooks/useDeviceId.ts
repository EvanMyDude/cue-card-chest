import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEVICE_ID_KEY = 'prompt-library-device-id';
const DEVICE_NAME_KEY = 'prompt-library-device-name';

function generateDeviceId(): string {
  return crypto.randomUUID();
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getDeviceName(): string {
  const stored = localStorage.getItem(DEVICE_NAME_KEY);
  if (stored) return stored;
  
  const type = getDeviceType();
  const browser = /chrome/i.test(navigator.userAgent) ? 'Chrome' :
                  /firefox/i.test(navigator.userAgent) ? 'Firefox' :
                  /safari/i.test(navigator.userAgent) ? 'Safari' :
                  /edge/i.test(navigator.userAgent) ? 'Edge' : 'Browser';
  
  return `${browser} on ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string>(() => {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    
    const newId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  });
  
  const [deviceName, setDeviceName] = useState<string>(getDeviceName);
  const [isRegistered, setIsRegistered] = useState(false);

  const registerDevice = useCallback(async (userId: string) => {
    try {
      // Check if device already exists
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('id', deviceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        // Update last seen
        await supabase
          .from('devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', deviceId);
      } else {
        // Register new device
        await supabase.from('devices').insert({
          id: deviceId,
          user_id: userId,
          device_name: deviceName,
          device_type: getDeviceType(),
        });
      }
      
      setIsRegistered(true);
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  }, [deviceId, deviceName]);

  const updateDeviceName = useCallback(async (newName: string, userId?: string) => {
    setDeviceName(newName);
    localStorage.setItem(DEVICE_NAME_KEY, newName);
    
    if (userId) {
      await supabase
        .from('devices')
        .update({ device_name: newName })
        .eq('id', deviceId)
        .eq('user_id', userId);
    }
  }, [deviceId]);

  return {
    deviceId,
    deviceName,
    deviceType: getDeviceType(),
    isRegistered,
    registerDevice,
    updateDeviceName,
  };
}
