import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

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
  warning: '#FF9800',
  error: '#f44336',
  info: '#2196F3',
  purple: '#9C27B0',
};

interface SellerRequest {
  user_id: string;
  name: string;
  email: string;
  picture: string | null;
  profession: string | null;
  seller_requested_at: string;
}

interface Stats {
  total_users: number;
  total_sellers: number;
  pending_requests: number;
  total_orders: number;
}

export default function AdminDashboardScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [requestsRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/seller-requests`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);

      if (requestsRes.ok) {
        setRequests(await requestsRes.json());
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleApproval = async (userId: string, userName: string, approve: boolean) => {
    const action = approve ? 'approve' : 'reject';
    Alert.alert(
      `${approve ? 'Approve' : 'Reject'} Seller`,
      `Are you sure you want to ${action} ${userName} as a seller?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(userId);
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
                  'Success',
                  `${userName} has been ${approve ? 'approved' : 'rejected'} as a seller.`
                );
                loadData();
              } else {
                const error = await response.json();
                if (response.status === 403) {
                  Alert.alert(
                    'Access Denied', 
                    'Only the admin user (Kummar Sambhav - 11.kumarsambhav@gmail.com) can approve or reject sellers. Please login with the admin account.'
                  );
                } else {
                  Alert.alert('Error', error.detail || 'Failed to process request');
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to process request');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const renderRequest = ({ item }: { item: SellerRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        {item.picture ? (
          <Image source={{ uri: item.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color={COLORS.textLight} />
          </View>
        )}
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{item.name}</Text>
          <Text style={styles.requestEmail}>{item.email}</Text>
          {item.profession && (
            <Text style={styles.requestProfession}>#{item.profession}</Text>
          )}
        </View>
      </View>

      <View style={styles.requestMeta}>
        <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
        <Text style={styles.requestTime}>
          Applied {formatDistanceToNow(new Date(item.seller_requested_at), { addSuffix: true })}
        </Text>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={() => handleApproval(item.user_id, item.name, false)}
          disabled={actionLoading === item.user_id}
        >
          {actionLoading === item.user_id ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <>
              <Ionicons name="close" size={18} color={COLORS.error} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => handleApproval(item.user_id, item.name, true)}
          disabled={actionLoading === item.user_id}
        >
          {actionLoading === item.user_id ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={COLORS.white} />
              <Text style={styles.approveBtnText}>Approve</Text>
            </>
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
      <LinearGradient
        colors={['#8B4513', '#A0522D', '#CD853F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <View style={styles.headerRight} />
        </View>
        <Text style={styles.headerSubtitle}>Manage TEAFRIENDS</Text>
      </LinearGradient>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={24} color={COLORS.info} />
              <Text style={styles.statNumber}>{stats.total_users}</Text>
              <Text style={styles.statLabel}>Users</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="storefront" size={24} color={COLORS.success} />
              <Text style={styles.statNumber}>{stats.total_sellers}</Text>
              <Text style={styles.statLabel}>Sellers</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color={COLORS.warning} />
              <Text style={styles.statNumber}>{stats.pending_requests}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="receipt" size={24} color={COLORS.purple} />
              <Text style={styles.statNumber}>{stats.total_orders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
          </View>
        </View>
      )}

      {/* Pending Requests */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Seller Requests</Text>
        {requests.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requests.length}</Text>
          </View>
        )}
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          </View>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtext}>No pending seller requests</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
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
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  statsContainer: {
    padding: 20,
    paddingBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  badge: {
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    marginRight: 14,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  requestEmail: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  requestProfession: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  requestTime: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    gap: 6,
  },
  rejectBtnText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    gap: 6,
  },
  approveBtnText: {
    color: COLORS.white,
    fontWeight: '600',
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
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
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
