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

interface MessageRequest {
  conversation_id: string;
  user: {
    user_id: string;
    name: string;
    picture?: string;
    profession?: string;
  };
  last_message?: {
    content: string;
    timestamp: string;
  };
  created_at: string;
}

export default function MessageRequestsScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/message-requests`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        setRequests(await response.json());
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (conversationId: string) => {
    setActionLoading(conversationId);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/message-requests/${conversationId}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      if (response.ok) {
        Alert.alert('Accepted!', 'You can now chat freely with this person.');
        // Navigate to chat
        router.push(`/app/chat/${conversationId}`);
      } else {
        Alert.alert('Error', 'Failed to accept request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setActionLoading(null);
      loadRequests();
    }
  };

  const handleDecline = async (conversationId: string) => {
    setActionLoading(conversationId);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/message-requests/${conversationId}/decline`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      if (response.ok) {
        Alert.alert('Declined', 'Message request declined.');
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

  const renderRequest = ({ item }: { item: MessageRequest }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => router.push(`/app/user/${item.user.user_id}`)}
      >
        <Image
          source={{ uri: item.user.picture || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.user.name}</Text>
          {item.user.profession && (
            <Text style={styles.userProfession}>{item.user.profession}</Text>
          )}
          {item.last_message && (
            <Text style={styles.previewMessage} numberOfLines={1}>
              "{item.last_message.content}"
            </Text>
          )}
          <Text style={styles.timeText}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => handleDecline(item.conversation_id)}
          disabled={actionLoading === item.conversation_id}
        >
          {actionLoading === item.conversation_id ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Ionicons name="close" size={20} color={COLORS.error} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAccept(item.conversation_id)}
          disabled={actionLoading === item.conversation_id}
        >
          {actionLoading === item.conversation_id ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          )}
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Message Requests</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          These are messages from people who don't follow you yet.
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.conversation_id}
        renderItem={renderRequest}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No message requests</Text>
            <Text style={styles.emptySubtext}>
              When someone new messages you, they'll appear here
            </Text>
          </View>
        }
      />
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
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
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userProfession: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 2,
  },
  previewMessage: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
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
