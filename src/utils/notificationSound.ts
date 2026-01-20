/**
 * Utility for playing notification sounds
 */

let audioContext: AudioContext | null = null;
let notificationAudio: HTMLAudioElement | null = null;

/**
 * Initialize audio context (needed for some browsers)
 */
const initAudioContext = () => {
  if (!audioContext && typeof window !== 'undefined') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

/**
 * Play notification sound
 * Uses a simple beep sound generated programmatically if no audio file is available
 */
export const playNotificationSound = async (volume: number = 0.5): Promise<void> => {
  try {
    // Try to play custom notification sound file first
    if (!notificationAudio) {
      notificationAudio = new Audio('/notification-sound.mp3');
      notificationAudio.volume = volume;
    }

    // Clone the audio to allow multiple simultaneous plays
    const sound = notificationAudio.cloneNode() as HTMLAudioElement;
    sound.volume = volume;
    
    await sound.play().catch(() => {
      // If file doesn't exist or fails, generate a simple beep
      generateBeepSound(volume);
    });
  } catch (error) {
    console.warn('Could not play notification sound:', error);
    // Fallback to generated beep
    generateBeepSound(volume);
  }
};

/**
 * Generate a simple beep sound using Web Audio API
 */
const generateBeepSound = (volume: number = 0.5) => {
  try {
    initAudioContext();
    
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set frequency for a pleasant notification sound
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    // Set volume
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    // Play the sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn('Could not generate beep sound:', error);
  }
};

/**
 * Check if audio playback is supported and allowed
 */
export const isAudioSupported = (): boolean => {
  return typeof Audio !== 'undefined' && typeof AudioContext !== 'undefined';
};
