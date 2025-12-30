import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Sound URLs - using reliable sources
const SOUND_URLS = {
  // Order notification - notification sound
  orderNotification: 'https://www.soundjay.com/buttons/sounds/button-09a.mp3',
  // Chat message sent
  messageSent: 'https://www.soundjay.com/buttons/sounds/button-21.mp3',
  // Chat message received
  messageReceived: 'https://www.soundjay.com/buttons/sounds/button-16.mp3',
  // Success sound
  success: 'https://www.soundjay.com/buttons/sounds/button-35.mp3',
};

class SoundManager {
  private isInitialized = false;
  private soundCache: Audio.Sound | null = null;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Configure audio mode for mobile
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
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

      console.log('🔊 Loading sound:', soundName, 'URL:', url);
      
      // Unload previous sound if exists
      if (this.soundCache) {
        try {
          await this.soundCache.unloadAsync();
        } catch (e) {
          // Ignore unload errors
        }
        this.soundCache = null;
      }
      
      // Create and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 }
      );
      
      this.soundCache = sound;
      console.log('🔊 Sound playing:', soundName);

      // Clean up after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🔊 Sound finished');
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
