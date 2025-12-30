import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  name: string;
  picture?: string;
  profession?: string;
  bio?: string;
  online: boolean;
}

export default function SearchScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);

    if (text.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/users/search?q=${encodeURIComponent(text)}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setSearched(true);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (userId: string) => {
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
        router.push(`/chat/${conversation.conversation_id}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => router.push(`/user/${item.user_id}`)}
    >
      <View style={styles.userInfo}>
        {item.picture ? (
          <Image source={{ uri: item.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color="#999" />
          </View>
        )}
        {item.online && <View style={styles.onlineIndicator} />}

        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.profession && (
            <Text style={styles.userProfession}>#{item.profession}</Text>
          )}
          {item.bio && (
            <Text style={styles.userBio} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => startChat(item.user_id)}
      >
        <Ionicons name="chatbubble" size={20} color="#0084ff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search Professionals</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by profession (e.g., #singer)"
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0084ff" />
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      ) : !searched ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Search for professionals</Text>
          <Text style={styles.emptySubtext}>
            Type a profession like "singer" or "developer"
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderUser}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 36,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4caf50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userProfession: {
    fontSize: 14,
    color: '#0084ff',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    color: '#666',
  },
  chatButton: {
    padding: 8,
  },
});