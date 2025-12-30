import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Sound URLs - using reliable free sounds
const SOUND_URLS = {
  // Order notification - bell/chime sound (shorter, more reliable)
  orderNotification: 'https://cdn.pixabay.com/audio/2022/03/24/audio_d1718ab41b.mp3',
  // Chat message sent - whoosh/send sound  
  messageSent: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
  // Chat message received - pop/notification sound
  messageReceived: 'https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3',
  // Success sound
  success: 'https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b73c6.mp3',
};

class SoundManager {
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
      console.log('🔊 Audio initialized successfully');
    } catch (error) {
      console.log('🔊 Error initializing audio:', error);
    }
  }

  async playSound(soundName: keyof typeof SOUND_URLS) {
    try {
      await this.initialize();
      
      const url = SOUND_URLS[soundName];
      if (!url) {
        console.log('🔊 Sound not found:', soundName);
        return;
      }

      console.log('🔊 Loading sound:', soundName);
      
      // Create and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 }
      );

      console.log('🔊 Sound playing:', soundName);

      // Clean up after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🔊 Sound finished, unloading');
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('🔊 Error playing sound:', error);
    }
  }

  async playOrderNotification() {
    console.log('🔔 Playing order notification...');
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
