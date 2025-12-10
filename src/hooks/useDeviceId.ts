import { useState, useEffect } from 'react';

const DEVICE_ID_KEY = 'promptLibrary_deviceId';
const DEVICE_NAME_KEY = 'promptLibrary_deviceName';

function generateUUID(): string {
  return crypto.randomUUID();
}

function detectDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Mobile') || ua.includes('Android')) return 'mobile';
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet';
  return 'desktop';
}

interface UseDeviceIdReturn {
  deviceId: string;
  deviceName: string;
  deviceType: string;
}

export function useDeviceId(): UseDeviceIdReturn {
  const [deviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'local-device';
    
    let stored = localStorage.getItem(DEVICE_ID_KEY);
    if (!stored) {
      stored = generateUUID();
      localStorage.setItem(DEVICE_ID_KEY, stored);
    }
    return stored;
  });

  const [deviceName] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Unknown Device';
    
    let stored = localStorage.getItem(DEVICE_NAME_KEY);
    if (!stored) {
      stored = detectDeviceName();
      localStorage.setItem(DEVICE_NAME_KEY, stored);
    }
    return stored;
  });

  const [deviceType] = useState<string>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getDeviceType();
  });

  return {
    deviceId,
    deviceName,
    deviceType,
  };
}
