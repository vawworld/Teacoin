import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Sound URLs - using free sounds from web
const SOUND_URLS = {
  // Order notification - bell/chime sound
  orderNotification: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  // Chat message sent - whoosh/send sound  
  messageSent: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
  // Chat message received - pop/notification sound
  messageReceived: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  // Success sound
  success: 'https://assets.mixkit.co/active_storage/sfx/2190/2190-preview.mp3',
};

class SoundManager {
  private sounds: { [key: string]: Audio.Sound | null } = {};
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.isInitialized = true;
    } catch (error) {
      console.log('Error initializing audio:', error);
    }
  }

  async playSound(soundName: keyof typeof SOUND_URLS) {
    try {
      await this.initialize();
      
      const url = SOUND_URLS[soundName];
      if (!url) return;

      // Create and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.8 }
      );

      // Clean up after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  }

  async playOrderNotification() {
    await this.playSound('orderNotification');
  }

  async playMessageSent() {
    await this.playSound('messageSent');
  }

  async playMessageReceived() {
    await this.playSound('messageReceived');
  }

  async playSuccess() {
    await this.playSound('success');
  }
}

export const soundManager = new SoundManager();
