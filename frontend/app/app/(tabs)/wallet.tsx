import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

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
  is_admin: boolean;
  pending_orders: number;
  active_orders: number;
  pending_seller_requests: number;
}

interface Transaction {
  transaction_id: string;
  from_user_id: string | null;
  to_user_id: string;
  amount: number;
  transaction_type: string;
  order_id: string | null;
  description: string;
  timestamp: string;
}

export default function WalletScreen() {
  const { user, sessionToken } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadWalletData();
    }, [])
  );

  const loadWalletData = async () => {
    try {
      const [walletRes, transactionsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/wallet`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/wallet/transactions`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);

      if (walletRes.ok) {
        setWallet(await walletRes.json());
      }
      if (transactionsRes.ok) {
        setTransactions(await transactionsRes.json());
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };

  const getTransactionIcon = (type: string, isIncoming: boolean) => {
    switch (type) {
      case 'signup_bonus':
        return { name: 'gift', color: COLORS.success, bg: '#E8F5E9' };
      case 'order_payment':
        return isIncoming
          ? { name: 'arrow-down-circle', color: COLORS.success, bg: '#E8F5E9' }
          : { name: 'arrow-up-circle', color: COLORS.error, bg: '#FFEBEE' };
      case 'refund':
        return { name: 'refresh-circle', color: COLORS.warning, bg: '#FFF3E0' };
      default:
        return { name: 'swap-horizontal', color: COLORS.primary, bg: COLORS.background };
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={styles.headerTitle}>Your Wallet</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCardWrapper}>
        <LinearGradient
          colors={['#8B4513', '#A0522D', '#CD853F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <View style={styles.teaIconBg}>
              <Text style={styles.teaIcon}>🍵</Text>
            </View>
          </View>
          
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>{wallet?.teacoins || 0}</Text>
            <Text style={styles.balanceCurrency}>TeaCoins</Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.cardPattern}>
              {[...Array(5)].map((_, i) => (
                <View key={i} style={[styles.patternCircle, { opacity: 0.1 - i * 0.02 }]} />
              ))}
            </View>
            {wallet?.is_seller && wallet?.seller_status === 'approved' && (
              <View style={styles.sellerBadgeCard}>
                <Ionicons name="checkmark-circle" size={14} color="#FFD700" />
                <Text style={styles.sellerBadgeCardText}>Verified Seller</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/app/order-tea')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="cafe" size={28} color={COLORS.success} />
            </View>
            <Text style={styles.actionTitle}>Order Tea</Text>
            <Text style={styles.actionSubtitle}>Browse menu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/app/my-orders')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="receipt" size={28} color="#2196F3" />
              {wallet?.active_orders ? (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{wallet.active_orders}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.actionTitle}>My Orders</Text>
            <Text style={styles.actionSubtitle}>Track status</Text>
          </TouchableOpacity>

          {wallet?.is_seller && wallet?.seller_status === 'approved' ? (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/app/seller-dashboard')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBg, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="storefront" size={28} color={COLORS.warning} />
                {wallet?.pending_orders ? (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{wallet.pending_orders}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionTitle}>Seller Hub</Text>
              <Text style={styles.actionSubtitle}>Manage shop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/app/become-seller')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBg, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="add-circle" size={28} color="#9C27B0" />
              </View>
              <Text style={styles.actionTitle}>
                {wallet?.seller_status === 'pending' ? 'Pending' : 'Sell Tea'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {wallet?.seller_status === 'pending' ? 'Under review' : 'Start earning'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Admin Section */}
        {wallet?.is_admin && (
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push('/app/admin-dashboard')}
            activeOpacity={0.7}
          >
            <View style={styles.adminIconBg}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.error} />
            </View>
            <View style={styles.adminInfo}>
              <Text style={styles.adminTitle}>Admin Dashboard</Text>
              <Text style={styles.adminSubtitle}>Manage sellers & users</Text>
            </View>
            {wallet?.pending_seller_requests > 0 && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>{wallet.pending_seller_requests}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Transaction History */}
      <View style={styles.transactionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {transactions.length > 0 && (
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="wallet-outline" size={40} color={COLORS.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>Your activity will appear here</Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {transactions.slice(0, 5).map((txn) => {
              const isIncoming = txn.to_user_id === user?.user_id;
              const icon = getTransactionIcon(txn.transaction_type, isIncoming);
              
              return (
                <View key={txn.transaction_id} style={styles.transactionItem}>
                  <View style={[styles.transactionIcon, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name as any} size={22} color={icon.color} />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc} numberOfLines={1}>
                      {txn.description}
                    </Text>
                    <Text style={styles.transactionTime}>
                      {formatDistanceToNow(new Date(txn.timestamp), { addSuffix: true })}
                    </Text>
                  </View>
                  <View style={styles.transactionAmountContainer}>
                    <Text style={[
                      styles.transactionAmount,
                      { color: isIncoming ? COLORS.success : COLORS.error }
                    ]}>
                      {isIncoming ? '+' : '-'}{txn.amount}
                    </Text>
                    <Text style={styles.transactionCoin}>🍵</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  balanceCardWrapper: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    minHeight: 180,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  teaIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teaIcon: {
    fontSize: 24,
  },
  balanceRow: {
    marginTop: 16,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 1,
  },
  balanceCurrency: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  cardPattern: {
    flexDirection: 'row',
    gap: 8,
  },
  patternCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  sellerBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sellerBadgeCardText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '600',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 56) / 3,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  transactionsSection: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  transactionsList: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  transactionTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  transactionAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionCoin: {
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#FFEBEE',
  },
  adminIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  adminInfo: {
    flex: 1,
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  adminSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  adminBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 100,
  },
});
