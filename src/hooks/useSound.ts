import { useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';

// Simple, subtle click sound using Web Audio API
const createClickSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Subtle click sound
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
};

// Soft success sound
const createSuccessSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 600;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
  
  // Second tone for harmony
  setTimeout(() => {
    const audioContext2 = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator2 = audioContext2.createOscillator();
    const gainNode2 = audioContext2.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext2.destination);
    
    oscillator2.frequency.value = 800;
    oscillator2.type = 'sine';
    
    gainNode2.gain.setValueAtTime(0.06, audioContext2.currentTime);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext2.currentTime + 0.1);
    
    oscillator2.start(audioContext2.currentTime);
    oscillator2.stop(audioContext2.currentTime + 0.1);
  }, 50);
};

export const useSound = () => {
  const [soundEnabled, setSoundEnabled] = useLocalStorage('sound-enabled', true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playClick = useCallback(() => {
    if (!soundEnabled) return;
    try {
      createClickSound();
    } catch (error) {
      console.error('Error playing click sound:', error);
    }
  }, [soundEnabled]);

  const playSuccess = useCallback(() => {
    if (!soundEnabled) return;
    try {
      createSuccessSound();
    } catch (error) {
      console.error('Error playing success sound:', error);
    }
  }, [soundEnabled]);

  return {
    soundEnabled,
    setSoundEnabled,
    playClick,
    playSuccess,
  };
};
