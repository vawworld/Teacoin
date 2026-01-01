import React, { useState, useRef, useCallback, useEffect } from 'react';
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

// Screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#8B4513',
  heart: '#FF4458',
};

interface Reel {
  reel_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  caption: string;
  likes_count: number;
  is_liked: boolean;
  views: number;
  comments_count: number;
}

interface Comment {
  comment_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  content: string;
}

export default function ReelsScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [caption, setCaption] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [reelToDelete, setReelToDelete] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadReels();
    }, [])
  );

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
        setReels(shuffleArray(data));
      }
    } catch (error) {
      console.error('Error loading reels:', error);
    } finally {
      setLoading(false);
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

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow gallery access.');
        return;
      }
      setShowUploadModal(false);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        await uploadVideo(asset.uri, asset.fileName || 'video.mp4', asset.fileSize);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick video');
    }
  };

  const recordWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow camera access.');
        return;
      }
      setShowUploadModal(false);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        await uploadVideo(asset.uri, asset.fileName || 'video.mp4', asset.fileSize);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record video');
    }
  };

  const uploadVideo = async (uri: string, fileName: string, fileSize?: number) => {
    try {
      setUploading(true);
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', {
          uri,
          name: fileName,
          type: 'video/mp4',
        } as any);
      }
      formData.append('visibility', visibility);
      formData.append('caption', caption);

      const response = await fetch(`${BACKEND_URL}/api/reels/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: formData,
      });

      if (response.ok) {
        Alert.alert('Success', 'Reel uploaded!');
        setCaption('');
        loadReels();
      } else {
        const data = await response.json();
        Alert.alert('Error', data.detail || 'Upload failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openComments = async (reel: Reel) => {
    setSelectedReel(reel);
    setShowComments(true);
    setLoadingComments(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reels/${reel.reel_id}/comments`, {
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

  const handleDeleteReel = (reelId: string) => {
    setReelToDelete(reelId);
  };

  const confirmDeleteReel = async () => {
    if (!reelToDelete) return;
    const reelId = reelToDelete;
    setReelToDelete(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reels/${reelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        setReels(prev => prev.filter(r => r.reel_id !== reelId));
        Alert.alert('Deleted', 'Your reel has been deleted.');
      } else {
        Alert.alert('Error', 'Failed to delete reel');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete reel');
    }
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
        <TouchableOpacity onPress={() => setShowUploadModal(true)} disabled={uploading}>
          <Ionicons name="add-circle-outline" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.uploadingBanner}>
          <ActivityIndicator color="#FFF" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}

      {reels.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="videocam-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No reels yet</Text>
          <TouchableOpacity style={styles.createButton} onPress={() => setShowUploadModal(true)}>
            <Ionicons name="add" size={20} color="#FFF" />
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
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
        />
      )}

      {/* Upload Modal */}
      <Modal visible={showUploadModal} transparent animationType="slide" onRequestClose={() => setShowUploadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Reel</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              value={caption}
              onChangeText={setCaption}
              multiline
            />
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityBtn, visibility === 'public' && styles.visibilityBtnActive]}
                onPress={() => setVisibility('public')}
              >
                <Ionicons name="globe-outline" size={18} color={visibility === 'public' ? '#FFF' : '#333'} />
                <Text style={[styles.visibilityText, visibility === 'public' && { color: '#FFF' }]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityBtn, visibility === 'friends' && styles.visibilityBtnActive]}
                onPress={() => setVisibility('friends')}
              >
                <Ionicons name="people-outline" size={18} color={visibility === 'friends' ? '#FFF' : '#333'} />
                <Text style={[styles.visibilityText, visibility === 'friends' && { color: '#FFF' }]}>Friends</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.optionBtn} onPress={recordWithCamera}>
              <Ionicons name="videocam" size={24} color={COLORS.primary} />
              <Text style={styles.optionText}>Record Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtn} onPress={pickFromGallery}>
              <Ionicons name="images" size={24} color={COLORS.primary} />
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowUploadModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)}>
        <KeyboardAvoidingView style={styles.commentsOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.commentsBackdrop} onPress={() => setShowComments(false)} />
          <View style={styles.commentsContent}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {loadingComments ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.comment_id}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                  <View style={styles.noComments}>
                    <Ionicons name="chatbubble-outline" size={48} color="#CCC" />
                    <Text style={styles.noCommentsText}>No comments yet</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image source={{ uri: item.user_picture || 'https://via.placeholder.com/40' }} style={styles.commentAvatar} />
                    <View style={styles.commentBody}>
                      <Text style={styles.commentName}>{item.user_name}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
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

      {/* Delete Confirmation Modal */}
      <Modal visible={!!reelToDelete} transparent animationType="fade" onRequestClose={() => setReelToDelete(null)}>
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Ionicons name="warning" size={48} color="#FF6B6B" />
            <Text style={styles.deleteModalTitle}>Delete Reel?</Text>
            <Text style={styles.deleteModalText}>This action cannot be undone.</Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity style={styles.deleteModalCancelBtn} onPress={() => setReelToDelete(null)}>
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteModalConfirmBtn} onPress={confirmDeleteReel}>
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Simple ReelItem Component
function ReelItem({ reel, isActive, onLike, onComment, onUserPress, onDelete, currentUserId, sessionToken }: any) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isOwner = reel.user_id === currentUserId;

  useEffect(() => {
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
      setIsPlaying(false);
    } else {
      videoRef.current?.playAsync();
      setIsPlaying(true);
    }
  };

  const videoUrl = `${BACKEND_URL}/api/reels/${reel.reel_id}/video`;

  return (
    <View style={styles.reelContainer}>
      {/* Video - fills entire container */}
      <Pressable style={StyleSheet.absoluteFill} onPress={togglePlay}>
        <Video
          ref={videoRef}
          source={{ uri: videoUrl, headers: { Authorization: `Bearer ${sessionToken}` } }}
          style={StyleSheet.absoluteFill}
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

      {/* User Info - bottom left overlay */}
      <View style={styles.reelInfo}>
        <TouchableOpacity style={styles.userRow} onPress={onUserPress}>
          <Image source={{ uri: reel.user_picture || 'https://via.placeholder.com/40' }} style={styles.userAvatar} />
          <Text style={styles.userName}>{reel.user_name}</Text>
          {isOwner && <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>You</Text></View>}
        </TouchableOpacity>
        {reel.caption ? <Text style={styles.caption}>{reel.caption}</Text> : null}
      </View>

      {/* Actions - right side overlay */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Ionicons name={reel.is_liked ? "heart" : "heart-outline"} size={30} color={reel.is_liked ? COLORS.heart : "#FFF"} />
          <Text style={styles.actionText}>{reel.likes_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
          <Text style={styles.actionText}>{reel.comments_count || 0}</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={26} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#999', marginTop: 12 },
  
  header: {
    position: 'absolute', top: 50, left: 16, right: 16, zIndex: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  
  uploadingBanner: {
    position: 'absolute', top: 100, left: 20, right: 20, zIndex: 101,
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  uploadingText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#666', marginTop: 16 },
  createButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 20, gap: 8,
  },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // REEL CONTAINER - exactly screen height
  reelContainer: { 
    width: SCREEN_WIDTH, 
    height: SCREEN_HEIGHT, 
    backgroundColor: '#000',
  },
  
  playOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.3)' 
  },
  
  // User info overlay
  reelInfo: { 
    position: 'absolute', 
    bottom: 100, 
    left: 16, 
    right: 80,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#FFF', marginRight: 10 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  ownerBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  ownerBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  caption: { color: '#FFF', fontSize: 14 },
  
  // Actions overlay
  actions: { position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 16 },
  actionBtn: { alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 12, marginTop: 4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  captionInput: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16, minHeight: 60 },
  visibilityRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  visibilityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F0F0F0', gap: 8 },
  visibilityBtnActive: { backgroundColor: COLORS.primary },
  visibilityText: { fontSize: 14, fontWeight: '600', color: '#333' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 12, gap: 12 },
  optionText: { fontSize: 16, fontWeight: '500' },
  cancelBtn: { alignItems: 'center', padding: 16 },
  cancelText: { fontSize: 16, color: '#666' },

  commentsOverlay: { flex: 1, justifyContent: 'flex-end' },
  commentsBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  commentsContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', minHeight: '50%' },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  commentsTitle: { fontSize: 17, fontWeight: '700' },
  noComments: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  noCommentsText: { fontSize: 16, color: '#999', marginTop: 12 },
  commentItem: { flexDirection: 'row', marginBottom: 16 },
  commentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  commentBody: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 16, padding: 12 },
  commentName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  commentText: { fontSize: 14, color: '#555' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#EEE' },
  commentInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnDisabled: { backgroundColor: '#CCC' },

  deleteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  deleteModalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center', width: '100%', maxWidth: 320 },
  deleteModalTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  deleteModalText: { fontSize: 14, color: '#666', marginTop: 8, marginBottom: 24 },
  deleteModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  deleteModalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F0F0F0', alignItems: 'center' },
  deleteModalCancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
  deleteModalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FF4444', alignItems: 'center' },
  deleteModalConfirmText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
