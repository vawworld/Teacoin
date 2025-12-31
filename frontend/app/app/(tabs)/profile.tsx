import React, { useState, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

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
  warning: '#FF9800',
  error: '#f44336',
};

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
}

interface FollowCounts {
  followers: number;
  following: number;
}

export default function ProfileScreen() {
  const { user, logout, sessionToken } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [walletRes, requestsRes, followersRes, followingRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/wallet`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/admin/seller-requests`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/followers`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/following`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);

      if (walletRes.ok) setWallet(await walletRes.json());
      if (requestsRes.ok) setSellerRequests(await requestsRes.json());
      
      if (followersRes.ok && followingRes.ok) {
        const followers = await followersRes.json();
        const following = await followingRes.json();
        setFollowCounts({
          followers: followers.length,
          following: following.length,
        });
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
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const approveSellerRequest = async (userId: string, userName: string, approve: boolean) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/seller-approve/${userId}?approve=${approve}`,
        { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      if (response.ok) {
        Alert.alert(
          approve ? 'Approved ✓' : 'Rejected',
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
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      {/* Header with Profile */}
      <LinearGradient
        colors={['#8B4513', '#A0522D', '#CD853F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/auth/profile-setup')}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Ionicons name="person" size={40} color={COLORS.textLight} />
            </View>
          )}
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          
          {user.profession && (
            <View style={styles.professionBadge}>
              <Text style={styles.professionText}>#{user.profession}</Text>
            </View>
          )}

          {/* Follower/Following Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statNumber}>{followCounts.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statNumber}>{followCounts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* TeaCoins Card */}
      <View style={styles.teacoinsContainer}>
        <View style={styles.teacoinsCard}>
          <View style={styles.teacoinsLeft}>
            <Text style={styles.teacoinsLabel}>TeaCoins Balance</Text>
            <View style={styles.teacoinsRow}>
              <Text style={styles.teacoinsAmount}>{wallet?.teacoins || 0}</Text>
              <Text style={styles.teaEmoji}>🍵</Text>
            </View>
          </View>
          {wallet?.is_seller && wallet?.seller_status === 'approved' && (
            <View style={styles.sellerBadge}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.warning} />
              <Text style={styles.sellerBadgeText}>Seller</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info Sections */}
      {user.bio && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>
      )}

      {user.skills && user.skills.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Skills</Text>
          </View>
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
          <View style={styles.sectionHeader}>
            <View style={styles.notificationDot} />
            <Text style={styles.sectionTitle}>Seller Requests</Text>
            <View style={styles.requestCount}>
              <Text style={styles.requestCountText}>{sellerRequests.length}</Text>
            </View>
          </View>
          {sellerRequests.map((request) => (
            <View key={request.user_id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                {request.picture ? (
                  <Image source={{ uri: request.picture }} style={styles.requestAvatar} />
                ) : (
                  <View style={[styles.requestAvatar, styles.placeholderAvatar]}>
                    <Ionicons name="person" size={18} color={COLORS.textLight} />
                  </View>
                )}
                <View style={styles.requestDetails}>
                  <Text style={styles.requestName}>{request.name}</Text>
                  <Text style={styles.requestProfession}>
                    {request.profession || 'Tea enthusiast'}
                  </Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => approveSellerRequest(request.user_id, request.name, false)}
                >
                  <Ionicons name="close" size={18} color={COLORS.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveSellerRequest(request.user_id, request.name, true)}
                >
                  <Ionicons name="checkmark" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/app/my-orders')}>
          <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="receipt-outline" size={22} color="#2196F3" />
          </View>
          <Text style={styles.menuText}>My Orders</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/app/become-seller')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="storefront-outline" size={22} color={COLORS.warning} />
          </View>
          <Text style={styles.menuText}>Seller Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="help-circle-outline" size={22} color="#9C27B0" />
          </View>
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>TEAFRIENDS v1.0</Text>
        <Text style={styles.footerSubtext}>Made with 🍵 for tea lovers</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  placeholderImage: {
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  professionBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  professionText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  teacoinsContainer: {
    paddingHorizontal: 20,
    marginTop: -25,
  },
  teacoinsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  teacoinsLeft: {},
  teacoinsLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  teacoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  teacoinsAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  teaEmoji: {
    fontSize: 24,
  },
  sellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sellerBadgeText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  requestCount: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  requestCountText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  skillText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 16,
    marginTop: 8,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  placeholderAvatar: {
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  requestProfession: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSection: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    gap: 8,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
});
