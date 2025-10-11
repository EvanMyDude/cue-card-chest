import { useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';

// Crisp, tactile click sound using Web Audio API
const createClickSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Sharp, minimal click
  oscillator.frequency.value = 1200;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.03);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.03);
};

// Crisp success sound with gentle upward tone
const createSuccessSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.06, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.08);
  
  // Second tone for subtle harmony
  setTimeout(() => {
    const audioContext2 = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator2 = audioContext2.createOscillator();
    const gainNode2 = audioContext2.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext2.destination);
    
    oscillator2.frequency.value = 1000;
    oscillator2.type = 'sine';
    
    gainNode2.gain.setValueAtTime(0.05, audioContext2.currentTime);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext2.currentTime + 0.08);
    
    oscillator2.start(audioContext2.currentTime);
    oscillator2.stop(audioContext2.currentTime + 0.08);
  }, 40);
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
