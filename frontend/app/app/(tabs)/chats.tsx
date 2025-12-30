import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// TEAFRIENDS Brand Colors
const COLORS = {
  primary: '#8B4513',
  secondary: '#D2691E',
  accent: '#F4A460',
  background: '#FFF8DC',
  cardBg: '#FFFAF0',
  white: '#FFFFFF',
  text: '#3E2723',
  textLight: '#8D6E63',
  success: '#4CAF50',
};

interface Conversation {
  conversation_id: string;
  type: string;
  name?: string;
  other_user?: {
    user_id: string;
    name: string;
    picture?: string;
    online: boolean;
    profession?: string;
  };
  last_message?: {
    content?: string;
    sender_name: string;
    timestamp: string;
  };
}

export default function ChatsScreen() {
  const { sessionToken } = useAuth();
  const { socket, connectSocket } = useSocket();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (sessionToken) {
      connectSocket(sessionToken);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadConversations();
    if (socket) {
      socket.on('new_message', () => loadConversations());
    }
    return () => {
      if (socket) socket.off('new_message');
    };
  }, [socket]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        setConversations(await response.json());
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isGroup = item.type === 'group';
    const displayName = isGroup ? item.name : item.other_user?.name;
    const displayPicture = isGroup ? null : item.other_user?.picture;
    const online = isGroup ? false : item.other_user?.online;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/app/chat/${item.conversation_id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {displayPicture ? (
            <Image source={{ uri: displayPicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons
                name={isGroup ? 'people' : 'person'}
                size={24}
                color={COLORS.textLight}
              />
            </View>
          )}
          {online && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{displayName}</Text>
            {item.last_message && (
              <Text style={styles.timestamp}>
                {formatDistanceToNow(new Date(item.last_message.timestamp), {
                  addSuffix: false,
                })}
              </Text>
            )}
          </View>

          {item.last_message ? (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message.sender_name}: {item.last_message.content || '📷 Photo'}
            </Text>
          ) : (
            <Text style={styles.lastMessage}>No messages yet</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
        <View>
          <Text style={styles.headerSubtitle}>Welcome back</Text>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push('/app/create-group')}
        >
          <Ionicons name="create-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textLight} />
          </View>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Search for tea friends to start chatting</Text>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.push('/app/(tabs)/search')}
          >
            <Text style={styles.startButtonText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.conversation_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  startButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  listContent: {
    padding: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.textLight,
  },
});
