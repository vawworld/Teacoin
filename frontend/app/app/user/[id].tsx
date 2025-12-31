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

interface FollowStatus {
  i_follow_them: boolean;
  they_follow_me: boolean;
  is_mutual: boolean;
}

interface FollowCounts {
  followers: number;
  following: number;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const userId = id as string;
  const { sessionToken, user: currentUser } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUser();
    loadFollowStatus();
    loadFollowCounts();
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

  const loadFollowStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/follow/status/${userId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        setFollowStatus(await response.json());
      }
    } catch (error) {
      console.error('Error loading follow status:', error);
    }
  };

  const loadFollowCounts = async () => {
    try {
      // Get followers of this user
      const followersRes = await fetch(`${BACKEND_URL}/api/users/${userId}/followers`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      
      // Get following of this user
      const followingRes = await fetch(`${BACKEND_URL}/api/users/${userId}/following`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (followersRes.ok && followingRes.ok) {
        const followers = await followersRes.json();
        const following = await followingRes.json();
        setFollowCounts({
          followers: followers.length,
          following: following.length,
        });
      }
    } catch (error) {
      console.error('Error loading follow counts:', error);
    }
  };

  const handleFollow = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/follow/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        Alert.alert(
          'Friend Request Sent! 🎉',
          `You are now following ${user?.name}. They can see your message requests now.`
        );
        loadFollowStatus();
        loadFollowCounts();
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

  const handleUnfollow = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/follow/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        Alert.alert('Unfollowed', `You unfollowed ${user?.name}`);
        loadFollowStatus();
        loadFollowCounts();
      } else {
        Alert.alert('Error', 'Failed to unfollow');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to unfollow');
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

          {/* Follower/Following Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followCounts.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followCounts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {/* Follow Status Badge */}
          {!isOwnProfile && followStatus && (
            <View style={styles.followStatusContainer}>
              {followStatus.is_mutual ? (
                <View style={styles.mutualBadge}>
                  <Ionicons name="people" size={16} color={COLORS.success} />
                  <Text style={styles.mutualText}>Friends</Text>
                </View>
              ) : followStatus.they_follow_me ? (
                <View style={styles.followsYouBadge}>
                  <Text style={styles.followsYouText}>Follows you</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            {followStatus?.i_follow_them ? (
              <TouchableOpacity
                style={styles.followingButton}
                onPress={handleUnfollow}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    <Text style={styles.followingButtonText}>Following</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.followButton}
                onPress={handleFollow}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color={COLORS.white} />
                    <Text style={styles.followButtonText}>Send Friend Request</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

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
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  followStatusContainer: {
    marginTop: 12,
  },
  mutualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  mutualText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  followsYouBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followsYouText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  followButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  followingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 8,
  },
  followingButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
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
