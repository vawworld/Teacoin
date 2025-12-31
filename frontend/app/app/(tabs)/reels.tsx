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
  TextInput,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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

interface Comment {
  comment_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  content: string;
  created_at: string;
}

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
  comments_count: number;
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
  const [caption, setCaption] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
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

  const pickFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
      });

      console.log('Gallery picker result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Selected video:', asset.uri);
        setShowUploadModal(false);
        await uploadVideo(asset.uri);
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick video from gallery');
    }
  };

  const recordWithCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to record videos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
      });

      console.log('Camera result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Recorded video:', asset.uri);
        setShowUploadModal(false);
        await uploadVideo(asset.uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to record video');
    }
  };

  const uploadVideo = async (videoUri: string) => {
    setUploading(true);
    setUploadProgress('Preparing video...');

    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      console.log('File info:', fileInfo);

      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      setUploadProgress('Uploading video...');

      // Use FileSystem.uploadAsync for reliable uploads
      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/api/reels/upload`,
        videoUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          parameters: {
            visibility: visibility,
            caption: caption || '',
          },
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      console.log('Upload result:', uploadResult);

      if (uploadResult.status === 200 || uploadResult.status === 201) {
        Alert.alert('Success! 🎬', 'Your reel has been uploaded and is being processed!');
        setCaption('');
        setVisibility('public');
        loadReels();
      } else {
        console.error('Upload failed:', uploadResult.body);
        let errorMessage = 'Failed to upload video';
        try {
          const errorData = JSON.parse(uploadResult.body);
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {}
        Alert.alert('Upload Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload video. Please try again.');
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

  const openComments = async (reel: Reel) => {
    setSelectedReel(reel);
    setShowComments(true);
    loadComments(reel.reel_id);
  };

  const loadComments = async (reelId: string) => {
    setLoadingComments(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reels/${reelId}/comments`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !selectedReel) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/reels/${selectedReel.reel_id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (response.ok) {
        const comment = await response.json();
        setComments(prev => [comment, ...prev]);
        setNewComment('');
        setReels(prev => prev.map(r => 
          r.reel_id === selectedReel.reel_id 
            ? { ...r, comments_count: (r.comments_count || 0) + 1 }
            : r
        ));
      }
    } catch (error) {
      console.error('Error posting comment:', error);
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
      onComment={() => openComments(item)}
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
        <Pressable style={styles.modalOverlay} onPress={() => setShowUploadModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Reel</Text>
            <Text style={styles.modalSubtitle}>Max 60 seconds • Auto-compressed</Text>

            {/* Caption Input */}
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#8B7355"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={200}
            />

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
              onPress={pickFromGallery}
            >
              <View style={styles.modalOptionIcon}>
                <Ionicons name="images" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.modalOptionInfo}>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionSubtitle}>Select a video from your phone</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#8B7355" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={recordWithCamera}
            >
              <View style={[styles.modalOptionIcon, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="videocam" size={28} color="#E53935" />
              </View>
              <View style={styles.modalOptionInfo}>
                <Text style={styles.modalOptionTitle}>Record Video</Text>
                <Text style={styles.modalOptionSubtitle}>Use camera to record (max 60s)</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#8B7355" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowUploadModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView 
          style={styles.commentsModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable 
            style={styles.commentsBackdrop} 
            onPress={() => setShowComments(false)} 
          />
          <View style={styles.commentsModalContent}>
            <View style={styles.commentsHeader}>
              <View style={styles.commentsHandle} />
              <Text style={styles.commentsTitle}>
                Comments {selectedReel && `(${selectedReel.comments_count || 0})`}
              </Text>
              <TouchableOpacity 
                style={styles.closeCommentsBtn}
                onPress={() => setShowComments(false)}
              >
                <Ionicons name="close" size={24} color="#2D1810" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={styles.commentsLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.noComments}>
                <Ionicons name="chatbubble-outline" size={48} color="#8B7355" />
                <Text style={styles.noCommentsText}>No comments yet</Text>
                <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.comment_id}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image
                      source={{ uri: item.user_picture || 'https://via.placeholder.com/40' }}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <Text style={styles.commentUserName}>{item.user_name}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.commentsList}
                showsVerticalScrollIndicator={false}
              />
            )}

            {/* Comment Input */}
            <View style={styles.commentInputContainer}>
              <Image
                source={{ uri: user?.picture || 'https://via.placeholder.com/36' }}
                style={styles.myCommentAvatar}
              />
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#8B7355"
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={[styles.sendCommentBtn, !newComment.trim() && styles.sendCommentBtnDisabled]}
                onPress={postComment}
                disabled={!newComment.trim()}
              >
                <Ionicons name="send" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Individual Reel Item Component
function ReelItem({ 
  reel, 
  isActive, 
  onLike, 
  onComment,
  onUserPress,
  sessionToken 
}: { 
  reel: Reel; 
  isActive: boolean; 
  onLike: () => void;
  onComment: () => void;
  onUserPress: () => void;
  sessionToken: string | null;
}) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHeart, setShowHeart] = useState(false);

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

  const handleDoubleTap = () => {
    if (!reel.is_liked) {
      onLike();
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    }
  };

  const videoUrl = `${BACKEND_URL}/api/reels/${reel.reel_id}/video`;

  return (
    <View style={styles.reelContainer}>
      <Pressable 
        style={styles.videoContainer}
        onPress={togglePlay}
        onLongPress={handleDoubleTap}
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

        {/* Double tap heart animation */}
        {showHeart && (
          <View style={styles.heartAnimation}>
            <Ionicons name="heart" size={100} color={COLORS.heart} />
          </View>
        )}
      </Pressable>

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
        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={2}>{reel.caption}</Text>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Like Button - Heart Icon */}
        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
          <Ionicons 
            name={reel.is_liked ? "heart" : "heart-outline"} 
            size={32} 
            color={reel.is_liked ? COLORS.heart : COLORS.white} 
          />
          <Text style={styles.actionCount}>{reel.likes_count || 0}</Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity style={styles.actionButton} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={28} color={COLORS.white} />
          <Text style={styles.actionCount}>{reel.comments_count || 0}</Text>
        </TouchableOpacity>

        {/* Views */}
        <View style={styles.actionButton}>
          <Ionicons name="eye-outline" size={28} color={COLORS.white} />
          <Text style={styles.actionCount}>{reel.views || 0}</Text>
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
    padding: 14,
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
  heartAnimation: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 20,
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
  // Upload Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#2D1810',
    minHeight: 60,
    marginBottom: 16,
    textAlignVertical: 'top',
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
    padding: 14,
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    marginBottom: 12,
  },
  modalOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFE4C4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modalOptionInfo: {
    flex: 1,
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
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#8B7355',
    fontWeight: '500',
  },
  // Comments Modal
  commentsModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  commentsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentsModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    minHeight: '50%',
  },
  commentsHeader: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DDD4',
  },
  commentsHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D1810',
  },
  closeCommentsBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  commentsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 12,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D1810',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#3E2723',
    lineHeight: 20,
  },
  noComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B7355',
    marginTop: 12,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#8B7355',
    marginTop: 4,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    borderTopWidth: 1,
    borderTopColor: '#E8DDD4',
    backgroundColor: '#FFFFFF',
  },
  myCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2D1810',
    maxHeight: 80,
  },
  sendCommentBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendCommentBtnDisabled: {
    backgroundColor: '#BCAAA4',
  },
});
