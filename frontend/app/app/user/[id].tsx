import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

const COLORS = {
  primary: '#8B4513',
  secondary: '#D2691E',
  background: '#FFF8F0',
  white: '#FFFFFF',
  text: '#2D1810',
  textLight: '#8B7355',
  border: '#E8DDD4',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
};

interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
  profession?: string;
  bio?: string;
  skills: string[];
  online: boolean;
  location?: string;
  languages?: string[];
  interests?: string[];
}

interface FriendStatus {
  status: 'friends' | 'request_sent' | 'request_received' | 'none';
  is_friend: boolean;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const userId = id as string;
  const { sessionToken, user: currentUser } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<FriendStatus | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUser();
    loadFriendStatus();
    loadFriendCount();
  }, [userId]);

  const loadUser = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        setUser(await response.json());
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriendStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/friend/status/${userId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        setFriendStatus(await response.json());
      }
    } catch (error) {
      console.error('Error loading friend status:', error);
    }
  };

  const loadFriendCount = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}/friends`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const friends = await response.json();
        setFriendCount(friends.length);
      }
    } catch (error) {
      console.error('Error loading friend count:', error);
    }
  };

  const sendFriendRequest = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/friend-request/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'accepted') {
          Alert.alert('🎉 Friends!', `You and ${user?.name} are now friends!`);
        } else {
          Alert.alert('Request Sent! 📨', `Friend request sent to ${user?.name}`);
        }
        loadFriendStatus();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to send friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const acceptFriendRequest = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/friend-request/${userId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        Alert.alert('🎉 Friends!', `You and ${user?.name} are now friends!`);
        loadFriendStatus();
        loadFriendCount();
      } else {
        Alert.alert('Error', 'Failed to accept friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const declineFriendRequest = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/friend-request/${userId}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        Alert.alert('Declined', 'Friend request declined');
        loadFriendStatus();
      } else {
        Alert.alert('Error', 'Failed to decline friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to decline friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const cancelFriendRequest = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/friend-request/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        Alert.alert('Cancelled', 'Friend request cancelled');
        loadFriendStatus();
      } else {
        Alert.alert('Error', 'Failed to cancel friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const unfriend = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/friend/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        Alert.alert('Unfriended', `You are no longer friends with ${user?.name}`);
        loadFriendStatus();
        loadFriendCount();
      } else {
        Alert.alert('Error', 'Failed to unfriend');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to unfriend');
    } finally {
      setActionLoading(false);
    }
  };

  const startChat = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          type: 'direct',
          participant_ids: [userId],
        }),
      });

      if (response.ok) {
        const conversation = await response.json();
        router.push(`/app/chat/${conversation.conversation_id}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const isOwnProfile = currentUser?.user_id === userId;

  const renderFriendButton = () => {
    if (isOwnProfile || !friendStatus) return null;

    if (actionLoading) {
      return (
        <View style={styles.friendButton}>
          <ActivityIndicator size="small" color={COLORS.white} />
        </View>
      );
    }

    switch (friendStatus.status) {
      case 'friends':
        return (
          <TouchableOpacity style={styles.friendsButton} onPress={unfriend}>
            <Ionicons name="people" size={20} color={COLORS.success} />
            <Text style={styles.friendsButtonText}>Friends ✓</Text>
          </TouchableOpacity>
        );
      
      case 'request_sent':
        return (
          <TouchableOpacity style={styles.pendingButton} onPress={cancelFriendRequest}>
            <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            <Text style={styles.pendingButtonText}>Request Sent</Text>
          </TouchableOpacity>
        );
      
      case 'request_received':
        return (
          <View style={styles.requestReceivedContainer}>
            <Text style={styles.requestReceivedText}>Wants to be friends!</Text>
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.acceptButton} onPress={acceptFriendRequest}>
                <Ionicons name="checkmark" size={20} color={COLORS.white} />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declineButton} onPress={declineFriendRequest}>
                <Ionicons name="close" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        );
      
      default:
        return (
          <TouchableOpacity style={styles.addFriendButton} onPress={sendFriendRequest}>
            <Ionicons name="person-add" size={20} color={COLORS.white} />
            <Text style={styles.addFriendButtonText}>Add Friend</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <Ionicons name="person" size={48} color={COLORS.textLight} />
              </View>
            )}
            {user.online && <View style={styles.onlineIndicator} />}
          </View>

          <Text style={styles.name}>{user.name}</Text>

          {user.profession && (
            <View style={styles.professionBadge}>
              <Text style={styles.professionText}>#{user.profession}</Text>
            </View>
          )}

          {/* Friend Count */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{friendCount}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
          </View>

          {/* Friend Status Badge */}
          {!isOwnProfile && friendStatus?.is_friend && (
            <View style={styles.friendBadge}>
              <Ionicons name="people" size={16} color={COLORS.success} />
              <Text style={styles.friendBadgeText}>Friends</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            {renderFriendButton()}
            
            <TouchableOpacity style={styles.messageButton} onPress={startChat}>
              <Ionicons name="chatbubble" size={20} color={COLORS.primary} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bio Section */}
        {user.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        )}

        {/* Location */}
        {user.location && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.textLight} />
            <Text style={styles.infoText}>{user.location}</Text>
          </View>
        )}

        {/* Skills Section */}
        {user.skills && user.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.tagsContainer}>
              {user.skills.map((skill, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests Section */}
        {user.interests && user.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.tagsContainer}>
              {user.interests.map((interest, index) => (
                <View key={index} style={[styles.tagBadge, styles.interestBadge]}>
                  <Text style={[styles.tagText, styles.interestText]}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Languages */}
        {user.languages && user.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.tagsContainer}>
              {user.languages.map((lang, index) => (
                <View key={index} style={styles.languageBadge}>
                  <Ionicons name="globe-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.languageText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    width: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  content: {
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  placeholderImage: {
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  professionBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  professionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 12,
  },
  friendBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  addFriendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  addFriendButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  friendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  friendsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  friendsButtonText: {
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '600',
  },
  pendingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: COLORS.warning,
  },
  pendingButtonText: {
    color: COLORS.warning,
    fontSize: 15,
    fontWeight: '600',
  },
  requestReceivedContainer: {
    flex: 1,
  },
  requestReceivedText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: 8,
  },
  messageButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 14,
    color: COLORS.text,
  },
  interestBadge: {
    backgroundColor: '#FFF3E0',
  },
  interestText: {
    color: COLORS.primary,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  languageText: {
    fontSize: 14,
    color: COLORS.text,
  },
  bottomPadding: {
    height: 40,
  },
});
