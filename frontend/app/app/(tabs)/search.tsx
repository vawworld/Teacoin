import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

interface User {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
  profession?: string;
  bio?: string;
  online: boolean;
}

export default function SearchScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers();
    } else {
      setUsers(allUsers);
    }
  }, [searchQuery, allUsers]);

  const loadAllUsers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/all`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllUsers();
  };

  const startConversation = async (userId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ type: 'direct', participant_ids: [userId] }),
      });
      if (response.ok) {
        const conversation = await response.json();
        router.push(`/app/chat/${conversation.conversation_id}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => router.push(`/app/user/${item.user_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.userLeft}>
        {item.picture ? (
          <Image source={{ uri: item.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color={COLORS.textLight} />
          </View>
        )}
        {item.online && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.profession && (
          <View style={styles.professionRow}>
            <Text style={styles.profession}>#{item.profession}</Text>
          </View>
        )}
        {item.bio && (
          <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => startConversation(item.user_id)}
      >
        <Ionicons name="chatbubble" size={18} color={COLORS.white} />
      </TouchableOpacity>
    </TouchableOpacity>
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
        <Text style={styles.headerSubtitle}>Find your</Text>
        <Text style={styles.headerTitle}>Tea Friends</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, profession, skills..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {users.length} {users.length === 1 ? 'person' : 'people'} found
        </Text>
      </View>

      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
          </View>
          <Text style={styles.emptyText}>No tea friends found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
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
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  resultsCount: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  userLeft: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  professionRow: {
    marginTop: 4,
  },
  profession: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  bio: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});
