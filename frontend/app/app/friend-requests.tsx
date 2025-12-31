import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
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

interface FriendRequest {
  request_id: string;
  from_user_id: string;
  from_user_name: string;
  from_user_picture?: string;
  to_user_id: string;
  to_user_name: string;
  status: string;
  created_at: string;
}

export default function FriendRequestsScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  const loadRequests = async () => {
    try {
      setLoading(true);
      const [receivedRes, sentRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/friend-requests`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/friend-requests/sent`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);

      if (receivedRes.ok) {
        setRequests(await receivedRes.json());
      }
      if (sentRes.ok) {
        setSentRequests(await sentRes.json());
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleAccept = async (userId: string, userName: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/friend-request/${userId}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      if (response.ok) {
        Alert.alert('🎉 Friends!', `You and ${userName} are now friends!`);
        loadRequests();
      } else {
        Alert.alert('Error', 'Failed to accept request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (userId: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/friend-request/${userId}/decline`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      if (response.ok) {
        Alert.alert('Declined', 'Friend request declined');
        loadRequests();
      } else {
        Alert.alert('Error', 'Failed to decline request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to decline request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (userId: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/friend-request/${userId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      if (response.ok) {
        Alert.alert('Cancelled', 'Friend request cancelled');
        loadRequests();
      } else {
        Alert.alert('Error', 'Failed to cancel request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const renderReceivedRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => router.push(`/app/user/${item.from_user_id}`)}
      >
        <Image
          source={{ uri: item.from_user_picture || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.from_user_name}</Text>
          <Text style={styles.timeText}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actions}>
        {actionLoading === item.from_user_id ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => handleDecline(item.from_user_id)}
            >
              <Ionicons name="close" size={20} color={COLORS.error} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAccept(item.from_user_id, item.from_user_name)}
            >
              <Ionicons name="checkmark" size={20} color={COLORS.white} />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderSentRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => router.push(`/app/user/${item.to_user_id}`)}
      >
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color={COLORS.textLight} />
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.to_user_name}</Text>
          <Text style={styles.timeText}>
            Sent {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actions}>
        {actionLoading === item.to_user_id ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancel(item.to_user_id)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Requests</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Received {requests.length > 0 && `(${requests.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'received' ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.from_user_id}
          renderItem={renderReceivedRequest}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="person-add-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No friend requests</Text>
              <Text style={styles.emptySubtext}>
                When someone sends you a friend request, it'll appear here
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sentRequests}
          keyExtractor={(item) => item.to_user_id}
          renderItem={renderSentRequest}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="paper-plane-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No pending requests</Text>
              <Text style={styles.emptySubtext}>
                Friend requests you send will appear here until accepted
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  listContent: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  declineBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 6,
  },
  acceptText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
