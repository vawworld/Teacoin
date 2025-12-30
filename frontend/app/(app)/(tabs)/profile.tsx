import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface WalletData {
  teacoins: number;
  is_seller: boolean;
  seller_status: string | null;
}

interface SellerRequest {
  user_id: string;
  name: string;
  email: string;
  picture: string | null;
  profession: string | null;
  seller_requested_at: string;
}

export default function ProfileScreen() {
  const { user, logout, sessionToken } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      // Load wallet
      const walletRes = await fetch(`${BACKEND_URL}/api/wallet`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (walletRes.ok) {
        setWallet(await walletRes.json());
      }

      // Load seller requests (for admin)
      const requestsRes = await fetch(`${BACKEND_URL}/api/admin/seller-requests`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (requestsRes.ok) {
        setSellerRequests(await requestsRes.json());
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const approveSellerRequest = async (userId: string, userName: string, approve: boolean) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/seller-approve/${userId}?approve=${approve}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      if (response.ok) {
        Alert.alert(
          approve ? 'Approved' : 'Rejected',
          `Seller request ${approve ? 'approved' : 'rejected'} for ${userName}`
        );
        loadData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process request');
    }
  };

  if (!user) return null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/profile-setup')}>
          <Ionicons name="create-outline" size={24} color="#0084ff" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        {user.picture ? (
          <Image source={{ uri: user.picture }} style={styles.profileImage} />
        ) : (
          <View style={[styles.profileImage, styles.placeholderImage]}>
            <Ionicons name="person" size={48} color="#999" />
          </View>
        )}

        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>

        {user.profession && (
          <View style={styles.professionBadge}>
            <Text style={styles.professionText}>#{user.profession}</Text>
          </View>
        )}

        {/* TeaCoins Balance */}
        <View style={styles.teacoinsCard}>
          <Text style={styles.teacoinsLabel}>TeaCoins Balance</Text>
          <View style={styles.teacoinsRow}>
            <Text style={styles.teacoinsAmount}>{wallet?.teacoins || 0}</Text>
            <Text style={styles.teaEmoji}>🍵</Text>
          </View>
          {wallet?.is_seller && wallet?.seller_status === 'approved' && (
            <View style={styles.sellerBadge}>
              <Ionicons name="storefront" size={14} color="#FF9800" />
              <Text style={styles.sellerBadgeText}>Verified Seller</Text>
            </View>
          )}
        </View>
      </View>

      {user.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>
      )}

      {user.skills && user.skills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skillsContainer}>
            {user.skills.map((skill, index) => (
              <View key={index} style={styles.skillBadge}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Admin: Seller Requests */}
      {sellerRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Seller Requests ({sellerRequests.length})</Text>
          {sellerRequests.map((request) => (
            <View key={request.user_id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                {request.picture ? (
                  <Image source={{ uri: request.picture }} style={styles.requestAvatar} />
                ) : (
                  <View style={[styles.requestAvatar, styles.placeholderAvatar]}>
                    <Ionicons name="person" size={20} color="#999" />
                  </View>
                )}
                <View style={styles.requestDetails}>
                  <Text style={styles.requestName}>{request.name}</Text>
                  <Text style={styles.requestProfession}>
                    {request.profession || 'No profession'}
                  </Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => approveSellerRequest(request.user_id, request.name, false)}
                >
                  <Ionicons name="close" size={18} color="#f44336" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveSellerRequest(request.user_id, request.name, true)}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>TEAFRIENDS v1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  profileSection: {
    alignItems: 'center',
    padding: 32,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  professionBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  professionText: {
    fontSize: 14,
    color: '#0084ff',
    fontWeight: '600',
  },
  teacoinsCard: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
  },
  teacoinsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  teacoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  teacoinsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  teaEmoji: {
    fontSize: 28,
  },
  sellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  sellerBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  section: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    fontSize: 14,
    color: '#666',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  placeholderAvatar: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  requestProfession: {
    fontSize: 12,
    color: '#666',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#f44336',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});