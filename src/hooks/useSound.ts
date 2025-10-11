import { useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';

// Subtle, tactile click using short noise burst + high-pass filter
const createClickSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const duration = 0.02; // 20ms
  const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // very low amplitude noise
    data[i] = (Math.random() * 2 - 1) * 0.02;
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(0.05, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  source.start(now);
  source.stop(now + duration);
};

// Ultra-short confirm chirp
const createSuccessSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  const now = audioContext.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(900, now);
  oscillator.frequency.linearRampToValueAtTime(1200, now + 0.06);

  gainNode.gain.setValueAtTime(0.04, now);
  gainNode.gain.exponentialRampToValueAtTime(0.003, now + 0.06);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.07);
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
