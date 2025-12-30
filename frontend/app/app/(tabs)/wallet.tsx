import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface WalletData {
  teacoins: number;
  is_seller: boolean;
  seller_status: string | null;
  pending_orders: number;
  active_orders: number;
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
        const walletData = await walletRes.json();
        setWallet(walletData);
      }

      if (transactionsRes.ok) {
        const txnData = await transactionsRes.json();
        setTransactions(txnData);
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
        return { name: 'gift', color: '#4CAF50' };
      case 'order_payment':
        return isIncoming
          ? { name: 'arrow-down', color: '#4CAF50' }
          : { name: 'arrow-up', color: '#f44336' };
      case 'refund':
        return { name: 'refresh', color: '#FF9800' };
      default:
        return { name: 'swap-horizontal', color: '#2196F3' };
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncoming = item.to_user_id === user?.user_id;
    const icon = getTransactionIcon(item.transaction_type, isIncoming);

    return (
      <View style={styles.transactionItem}>
        <View style={[styles.transactionIcon, { backgroundColor: icon.color + '20' }]}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDesc}>{item.description}</Text>
          <Text style={styles.transactionTime}>
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            { color: isIncoming ? '#4CAF50' : '#f44336' },
          ]}
        >
          {isIncoming ? '+' : '-'}{item.amount} 🍵
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TeaCoins Wallet</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Balance</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceAmount}>{wallet?.teacoins || 0}</Text>
          <Text style={styles.teaEmoji}>🍵</Text>
        </View>
        <Text style={styles.balanceSubtext}>TeaCoins</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/app/order-tea')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="cafe" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.actionText}>Order Tea</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/app/my-orders')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="receipt" size={24} color="#2196F3" />
          </View>
          <Text style={styles.actionText}>My Orders</Text>
          {wallet?.active_orders ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{wallet.active_orders}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {wallet?.is_seller && wallet?.seller_status === 'approved' ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/app/seller-dashboard')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="storefront" size={24} color="#FF9800" />
            </View>
            <Text style={styles.actionText}>Seller</Text>
            {wallet?.pending_orders ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{wallet.pending_orders}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/app/become-seller')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="add-circle" size={24} color="#9C27B0" />
            </View>
            <Text style={styles.actionText}>
              {wallet?.seller_status === 'pending' ? 'Pending' : 'Become Seller'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transaction History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          transactions.map((txn) => (
            <View key={txn.transaction_id}>
              {renderTransaction({ item: txn })}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  balanceCard: {
    backgroundColor: '#4CAF50',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  teaEmoji: {
    fontSize: 40,
  },
  balanceSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    alignItems: 'center',
    position: 'relative',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  transactionTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
