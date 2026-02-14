import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEVICE_ID_KEY = 'prompt-library-device-id';
const DEVICE_NAME_KEY = 'prompt-library-device-name';

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getDefaultDeviceName(): string {
  const stored = localStorage.getItem(DEVICE_NAME_KEY);
  if (stored) return stored;

  const type = getDeviceType();
  const browser = /chrome/i.test(navigator.userAgent) ? 'Chrome' :
                  /firefox/i.test(navigator.userAgent) ? 'Firefox' :
                  /safari/i.test(navigator.userAgent) ? 'Safari' :
                  /edge/i.test(navigator.userAgent) ? 'Edge' : 'Browser';

  return `${browser} on ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

function getOrCreateDeviceId(): string {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const newId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}

export function useDeviceId() {
  const [deviceId] = useState<string>(getOrCreateDeviceId);
  const [deviceName] = useState<string>(getDefaultDeviceName);

  const registerDevice = useCallback(async (userId: string) => {
    try {
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('id', deviceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', deviceId);
      } else {
        await supabase.from('devices').insert({
          id: deviceId,
          user_id: userId,
          device_name: deviceName,
          device_type: getDeviceType(),
        });
      }
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  }, [deviceId, deviceName]);

  return {
    deviceId,
    deviceName,
    registerDevice,
  };
}
