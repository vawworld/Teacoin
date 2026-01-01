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
  caption: string;
  visibility: 'public' | 'friends';
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

  // Shuffle array helper function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const loadReels = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/reels`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Shuffle reels for random feed experience
        setReels(shuffleArray(data));
      }
    } catch (error) {
      console.error('Error loading reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    console.log('=== GALLERY PICKER STARTED ===');
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Gallery permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to your photo library.');
        return;
      }

      setShowUploadModal(false);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
      });

      console.log('Gallery result:', JSON.stringify(result, null, 2));

      if (result.canceled) {
        console.log('User cancelled gallery picker');
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Selected video:', asset.uri);
        await uploadVideo(asset.uri, asset.fileName || 'video.mp4', asset.fileSize);
      }
    } catch (error: any) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', error.message || 'Failed to open gallery');
    }
  };

  const recordWithCamera = async () => {
    console.log('=== CAMERA RECORDER STARTED ===');
    
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow camera access.');
        return;
      }

      setShowUploadModal(false);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
      });

      console.log('Camera result:', JSON.stringify(result, null, 2));

      if (result.canceled) {
        console.log('User cancelled camera');
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('Recorded video:', asset.uri);
        await uploadVideo(asset.uri, asset.fileName || 'video.mp4', asset.fileSize);
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      Alert.alert('Error', error.message || 'Failed to open camera');
    }
  };

  const uploadVideo = async (videoUri: string, fileName: string = 'video.mp4', fileSize?: number) => {
    console.log('=== UPLOAD STARTED ===');
    console.log('Video URI:', videoUri);
    console.log('Platform:', Platform.OS);
    
    setUploading(true);
    setUploadProgress('Preparing upload...');

    try {
      const formData = new FormData();

      // Handle both web (blob URL) and mobile (file URI)
      if (Platform.OS === 'web') {
        // For web: fetch the blob and append it
        console.log('Web platform - fetching blob...');
        setUploadProgress('Fetching video...');
        
        const response = await fetch(videoUri);
        const blob = await response.blob();
        
        console.log('Blob size:', blob.size);
        const fileSizeMB = blob.size / (1024 * 1024);
        setUploadProgress(`Uploading (${fileSizeMB.toFixed(1)} MB)...`);
        
        formData.append('file', blob, fileName);
      } else {
        // For mobile: use the file URI directly
        console.log('Mobile platform - using file URI...');
        const fileSizeMB = (fileSize || 0) / (1024 * 1024);
        setUploadProgress(`Uploading (${fileSizeMB.toFixed(1)} MB)...`);
        
        formData.append('file', {
          uri: videoUri,
          name: fileName,
          type: 'video/mp4',
        } as any);
      }

      formData.append('visibility', visibility);
      formData.append('caption', caption || '');

      console.log('Sending to:', `${BACKEND_URL}/api/reels/upload`);

      const uploadResponse = await fetch(`${BACKEND_URL}/api/reels/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
      });

      console.log('Upload response status:', uploadResponse.status);
      const responseText = await uploadResponse.text();
      console.log('Upload response:', responseText);

      if (uploadResponse.ok) {
        Alert.alert('Success! 🎬', 'Your reel has been uploaded!');
        setCaption('');
        setVisibility('public');
        loadReels();
      } else {
        let errorMsg = 'Upload failed';
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMsg = errorData.detail.map((e: any) => e.msg || e).join('\n');
            } else {
              errorMsg = JSON.stringify(errorData.detail);
            }
          }
        } catch (e) {
          errorMsg = responseText || 'Unknown error';
        }
        Alert.alert('Upload Failed', errorMsg);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload video');
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
            ? { ...r, is_liked: data.liked, likes_count: data.liked ? r.likes_count + 1 : r.likes_count - 1 }
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
        setComments(await response.json());
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

  const handleDeleteReel = async (reelId: string) => {
    Alert.alert(
      'Delete Reel',
      'Are you sure you want to delete this reel? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/reels/${reelId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${sessionToken}` },
              });

              if (response.ok) {
                setReels(prev => prev.filter(r => r.reel_id !== reelId));
                Alert.alert('Deleted', 'Your reel has been deleted.');
              } else {
                const data = await response.json();
                Alert.alert('Error', data.detail || 'Failed to delete reel');
              }
            } catch (error: any) {
              console.error('Error deleting reel:', error);
              Alert.alert('Error', 'Failed to delete reel');
            }
          },
        },
      ]
    );
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderReel = ({ item, index }: { item: Reel; index: number }) => (
    <ReelItem
      reel={item}
      isActive={index === currentIndex}
      onLike={() => handleLike(item.reel_id)}
      onComment={() => openComments(item)}
      onUserPress={() => router.push(`/app/user-reels/${item.user_id}`)}
      onDelete={() => handleDeleteReel(item.reel_id)}
      currentUserId={user?.user_id}
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

      {/* Upload Progress Banner */}
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
          <TouchableOpacity style={styles.createButton} onPress={() => setShowUploadModal(true)}>
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
      <Modal visible={showUploadModal} transparent animationType="slide" onRequestClose={() => setShowUploadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Reel</Text>
            <Text style={styles.modalSubtitle}>Max 60 seconds</Text>

            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor="#8B7355"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={200}
            />

            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityBtn, visibility === 'public' && styles.visibilityBtnActive]}
                onPress={() => setVisibility('public')}
              >
                <Ionicons name="globe-outline" size={18} color={visibility === 'public' ? '#FFF' : COLORS.primary} />
                <Text style={[styles.visibilityText, visibility === 'public' && styles.visibilityTextActive]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityBtn, visibility === 'friends' && styles.visibilityBtnActive]}
                onPress={() => setVisibility('friends')}
              >
                <Ionicons name="people-outline" size={18} color={visibility === 'friends' ? '#FFF' : COLORS.primary} />
                <Text style={[styles.visibilityText, visibility === 'friends' && styles.visibilityTextActive]}>Friends</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.optionBtn} onPress={pickFromGallery}>
              <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="images" size={28} color="#1976D2" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Choose from Gallery</Text>
                <Text style={styles.optionDesc}>Select a video from your phone</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={recordWithCamera}>
              <View style={[styles.optionIcon, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="videocam" size={28} color="#E53935" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Record Video</Text>
                <Text style={styles.optionDesc}>Use camera to record (max 60s)</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowUploadModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)}>
        <KeyboardAvoidingView style={styles.commentsOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.commentsBackdrop} onPress={() => setShowComments(false)} />
          <View style={styles.commentsContent}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments ({selectedReel?.comments_count || 0})</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : comments.length === 0 ? (
              <View style={styles.noComments}>
                <Ionicons name="chatbubble-outline" size={48} color="#999" />
                <Text style={styles.noCommentsText}>No comments yet</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.comment_id}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image source={{ uri: item.user_picture || 'https://via.placeholder.com/40' }} style={styles.commentAvatar} />
                    <View style={styles.commentBody}>
                      <Text style={styles.commentName}>{item.user_name}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
                contentContainerStyle={{ padding: 16 }}
              />
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
                maxLength={500}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !newComment.trim() && styles.sendBtnDisabled]}
                onPress={postComment}
                disabled={!newComment.trim()}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ReelItem({ reel, isActive, onLike, onComment, onUserPress, onDelete, currentUserId, sessionToken }: any) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const isOwner = reel.user_id === currentUserId;

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
      <Pressable style={styles.videoWrapper} onPress={togglePlay}>
        <Video
          ref={videoRef}
          source={{ uri: videoUrl, headers: { Authorization: `Bearer ${sessionToken}` } }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
        />
        {!isPlaying && (
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={60} color="#FFF" />
          </View>
        )}
      </Pressable>

      <View style={styles.reelInfo}>
        <TouchableOpacity style={styles.userRow} onPress={onUserPress}>
          <Image source={{ uri: reel.user_picture || 'https://via.placeholder.com/40' }} style={styles.userAvatar} />
          <View style={styles.userNameContainer}>
            <Text style={styles.userName}>{reel.user_name}</Text>
            <Text style={styles.viewReelsHint}>Tap to view all reels</Text>
          </View>
          {isOwner && <Text style={styles.ownerBadge}>You</Text>}
        </TouchableOpacity>
        {reel.caption ? <Text style={styles.caption}>{reel.caption}</Text> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Ionicons name={reel.is_liked ? "heart" : "heart-outline"} size={30} color={reel.is_liked ? COLORS.heart : "#FFF"} />
          <Text style={styles.actionText}>{reel.likes_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
          <Text style={styles.actionText}>{reel.comments_count || 0}</Text>
        </TouchableOpacity>

        <View style={styles.actionBtn}>
          <Ionicons name="eye-outline" size={26} color="#FFF" />
          <Text style={styles.actionText}>{reel.views || 0}</Text>
        </View>

        {isOwner && (
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={26} color="#FF6B6B" />
            <Text style={[styles.actionText, { color: '#FF6B6B' }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#999', marginTop: 12, fontSize: 16 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  uploadButton: { padding: 4 },
  uploadingBanner: {
    position: 'absolute', top: 100, left: 20, right: 20, zIndex: 101,
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  uploadingText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 20, fontWeight: '600', color: '#FFF', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8 },
  createButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24, gap: 8,
  },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  
  reelContainer: { height: SCREEN_HEIGHT - 150, width: SCREEN_WIDTH, position: 'relative' },
  videoWrapper: { flex: 1 },
  video: { flex: 1, backgroundColor: '#000' },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  reelInfo: { position: 'absolute', bottom: 80, left: 16, right: 70 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#FFF', marginRight: 10 },
  userNameContainer: { flex: 1 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  viewReelsHint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  ownerBadge: { backgroundColor: COLORS.primary, color: '#FFF', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8, overflow: 'hidden' },
  caption: { color: '#FFF', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  actions: { position: 'absolute', right: 12, bottom: 100, alignItems: 'center', gap: 20 },
  actionBtn: { alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#333', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  captionInput: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 15, minHeight: 60, marginBottom: 16, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  visibilityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: COLORS.primary, gap: 6 },
  visibilityBtnActive: { backgroundColor: COLORS.primary },
  visibilityText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  visibilityTextActive: { color: '#FFF' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#F9F9F9', borderRadius: 16, marginBottom: 12 },
  optionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  optionDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  cancelBtn: { alignItems: 'center', padding: 16, marginTop: 8 },
  cancelText: { fontSize: 16, color: '#999', fontWeight: '500' },

  commentsOverlay: { flex: 1, justifyContent: 'flex-end' },
  commentsBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  commentsContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', minHeight: '50%' },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  commentsTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  noComments: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  noCommentsText: { fontSize: 16, color: '#999', marginTop: 12 },
  commentItem: { flexDirection: 'row', marginBottom: 16 },
  commentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  commentBody: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 16, padding: 12 },
  commentName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  commentText: { fontSize: 14, color: '#555', lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#EEE' },
  commentInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnDisabled: { backgroundColor: '#CCC' },
});
