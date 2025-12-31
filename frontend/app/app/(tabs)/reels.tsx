import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#8B4513',
  secondary: '#D2691E',
  background: '#000000',
  white: '#FFFFFF',
  text: '#FFFFFF',
  textLight: 'rgba(255,255,255,0.7)',
  overlay: 'rgba(0,0,0,0.3)',
  heart: '#FF4458',
};

interface Reel {
  reel_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  video_filename: string;
  thumbnail_filename: string;
  caption: string;
  visibility: 'public' | 'friends';
  duration: number;
  likes_count: number;
  is_liked: boolean;
  views: number;
  created_at: string;
}

export default function ReelsScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadReels();
    }, [])
  );

  const loadReels = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/reels`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReels(data);
      }
    } catch (error) {
      console.error('Error loading reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickVideo = async (useCamera: boolean) => {
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow camera access to record videos');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow media library access to upload videos');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.8,
      });

      if (useCamera) {
        const cameraResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          allowsEditing: true,
          videoMaxDuration: 60,
          quality: 0.8,
        });
        
        if (!cameraResult.canceled && cameraResult.assets[0]) {
          uploadVideo(cameraResult.assets[0].uri);
        }
      } else {
        if (!result.canceled && result.assets[0]) {
          uploadVideo(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to select video');
    }
  };

  const uploadVideo = async (videoUri: string) => {
    setShowUploadModal(false);
    setUploading(true);
    setUploadProgress('Preparing video...');

    try {
      // Create form data
      const formData = new FormData();
      
      const filename = videoUri.split('/').pop() || 'video.mp4';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';
      
      formData.append('file', {
        uri: videoUri,
        name: filename,
        type: type,
      } as any);
      
      formData.append('visibility', visibility);
      formData.append('caption', '');

      setUploadProgress('Uploading & compressing...');

      const response = await fetch(`${BACKEND_URL}/api/reels/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success! 🎬', 'Your reel has been uploaded!');
        loadReels();
      } else {
        const error = await response.json();
        Alert.alert('Upload Failed', error.detail || 'Failed to upload video');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleLike = async (reelId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/reels/${reelId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReels(prev => prev.map(r => 
          r.reel_id === reelId 
            ? { 
                ...r, 
                is_liked: data.liked, 
                likes_count: data.liked ? r.likes_count + 1 : r.likes_count - 1 
              }
            : r
        ));
      }
    } catch (error) {
      console.error('Error liking reel:', error);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderReel = ({ item, index }: { item: Reel; index: number }) => (
    <ReelItem
      reel={item}
      isActive={index === currentIndex}
      onLike={() => handleLike(item.reel_id)}
      onUserPress={() => router.push(`/app/user/${item.user_id}`)}
      sessionToken={sessionToken}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Reels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => setShowUploadModal(true)}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="add-circle" size={32} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Upload Progress */}
      {uploading && (
        <View style={styles.uploadingBanner}>
          <ActivityIndicator size="small" color={COLORS.white} />
          <Text style={styles.uploadingText}>{uploadProgress}</Text>
        </View>
      )}

      {/* Reels Feed */}
      {reels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="videocam-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No reels yet</Text>
          <Text style={styles.emptySubtext}>Be the first to share a reel!</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowUploadModal(true)}
          >
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.createButtonText}>Create Reel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={reels}
          keyExtractor={(item) => item.reel_id}
          renderItem={renderReel}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT - 150}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Reel</Text>
            <Text style={styles.modalSubtitle}>Max 60 seconds • Will be compressed</Text>

            {/* Visibility Options */}
            <View style={styles.visibilityOptions}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === 'public' && styles.visibilityOptionActive
                ]}
                onPress={() => setVisibility('public')}
              >
                <Ionicons 
                  name="globe-outline" 
                  size={20} 
                  color={visibility === 'public' ? COLORS.white : COLORS.primary} 
                />
                <Text style={[
                  styles.visibilityText,
                  visibility === 'public' && styles.visibilityTextActive
                ]}>Public</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility === 'friends' && styles.visibilityOptionActive
                ]}
                onPress={() => setVisibility('friends')}
              >
                <Ionicons 
                  name="people-outline" 
                  size={20} 
                  color={visibility === 'friends' ? COLORS.white : COLORS.primary} 
                />
                <Text style={[
                  styles.visibilityText,
                  visibility === 'friends' && styles.visibilityTextActive
                ]}>Friends Only</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => pickVideo(false)}
            >
              <View style={styles.modalOptionIcon}>
                <Ionicons name="images" size={24} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionSubtitle}>Select a video from your phone</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => pickVideo(true)}
            >
              <View style={styles.modalOptionIcon}>
                <Ionicons name="videocam" size={24} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.modalOptionTitle}>Record Video</Text>
                <Text style={styles.modalOptionSubtitle}>Use camera to record (max 60s)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowUploadModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Individual Reel Item Component
function ReelItem({ 
  reel, 
  isActive, 
  onLike, 
  onUserPress,
  sessionToken 
}: { 
  reel: Reel; 
  isActive: boolean; 
  onLike: () => void;
  onUserPress: () => void;
  sessionToken: string | null;
}) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  React.useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const videoUrl = `${BACKEND_URL}/api/reels/${reel.reel_id}/video`;

  return (
    <View style={styles.reelContainer}>
      <TouchableOpacity 
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={togglePlay}
      >
        <Video
          ref={videoRef}
          source={{ 
            uri: videoUrl,
            headers: { Authorization: `Bearer ${sessionToken}` }
          }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
          isMuted={false}
        />
        
        {/* Play/Pause Indicator */}
        {!isPlaying && (
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={64} color={COLORS.white} />
          </View>
        )}
      </TouchableOpacity>

      {/* Overlay Info */}
      <View style={styles.reelOverlay}>
        {/* User Info */}
        <TouchableOpacity style={styles.userInfo} onPress={onUserPress}>
          <Image
            source={{ uri: reel.user_picture || 'https://via.placeholder.com/40' }}
            style={styles.userAvatar}
          />
          <Text style={styles.userName}>{reel.user_name}</Text>
          {reel.visibility === 'friends' && (
            <View style={styles.friendsBadge}>
              <Ionicons name="people" size={12} color={COLORS.white} />
            </View>
          )}
        </TouchableOpacity>

        {/* Caption */}
        {reel.caption && (
          <Text style={styles.caption} numberOfLines={2}>{reel.caption}</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
          <Ionicons 
            name={reel.is_liked ? "heart" : "heart-outline"} 
            size={32} 
            color={reel.is_liked ? COLORS.heart : COLORS.white} 
          />
          <Text style={styles.actionCount}>{reel.likes_count}</Text>
        </TouchableOpacity>

        <View style={styles.actionButton}>
          <Ionicons name="eye-outline" size={28} color={COLORS.white} />
          <Text style={styles.actionCount}>{reel.views}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.textLight,
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
  },
  uploadButton: {
    padding: 4,
  },
  uploadingBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 101,
  },
  uploadingText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  reelContainer: {
    height: SCREEN_HEIGHT - 150,
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  reelOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 70,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.white,
    marginRight: 10,
  },
  userName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  friendsBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 4,
    marginLeft: 8,
  },
  caption: {
    color: COLORS.white,
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actionsContainer: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionCount: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D1810',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8B7355',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 8,
  },
  visibilityOptionActive: {
    backgroundColor: COLORS.primary,
  },
  visibilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  visibilityTextActive: {
    color: COLORS.white,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE4C4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D1810',
  },
  modalOptionSubtitle: {
    fontSize: 13,
    color: '#8B7355',
    marginTop: 2,
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#8B7355',
    fontWeight: '500',
  },
});
