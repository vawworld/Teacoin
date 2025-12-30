import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
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
  warning: '#FF9800',
  error: '#f44336',
  info: '#2196F3',
  purple: '#9C27B0',
};

interface Order {
  order_id: string;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  seller_name: string;
  item_id: string;
  item_name: string;
  price: number;
  status: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  confirmed_at: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string; bg: string }> = {
  pending: { color: COLORS.warning, icon: 'time', label: 'Pending', bg: '#FFF3E0' },
  preparing: { color: COLORS.info, icon: 'cafe', label: 'Preparing', bg: '#E3F2FD' },
  ready: { color: COLORS.purple, icon: 'checkmark-circle', label: 'Ready', bg: '#F3E5F5' },
  delivered: { color: COLORS.success, icon: 'bicycle', label: 'Delivered', bg: '#E8F5E9' },
  confirmed: { color: COLORS.success, icon: 'checkmark-done', label: 'Completed', bg: '#E8F5E9' },
  cancelled: { color: COLORS.error, icon: 'close-circle', label: 'Cancelled', bg: '#FFEBEE' },
};

export default function MyOrdersScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        setOrders(await response.json());
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const confirmDelivery = async (order: Order) => {
    // Direct confirmation without dialog for better mobile compatibility
    const price = order.price || 1;
    setActionLoading(order.order_id);
    try {
      console.log('Confirming delivery for order:', order.order_id);
      const response = await fetch(
        `${BACKEND_URL}/api/orders/${order.order_id}/confirm`,
        { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      console.log('Confirm response status:', response.status);
      
      if (response.ok) {
        Alert.alert('Thank You! ☕', `Delivery confirmed!\n${price} TeaCoin${price > 1 ? 's' : ''} sent to ${order.seller_name}.`);
        loadOrders();
      } else {
        const error = await response.json();
        console.log('Confirm error:', error);
        Alert.alert('Error', error.detail || 'Failed to confirm delivery');
      }
    } catch (error) {
      console.error('Confirm error:', error);
      Alert.alert('Error', 'Failed to confirm delivery');
    } finally {
      setActionLoading(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    Alert.alert(
      'Cancel Order',
      `Cancel order for "${order.item_name}"?\nYour TeaCoin will be refunded.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(order.order_id);
            try {
              const response = await fetch(
                `${BACKEND_URL}/api/orders/${order.order_id}/cancel`,
                { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } }
              );
              if (response.ok) {
                Alert.alert('Cancelled', 'Order cancelled. TeaCoin refunded.');
                loadOrders();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'Failed to cancel order');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel order');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const canConfirm = item.status === 'delivered';
    const canCancel = ['pending', 'preparing'].includes(item.status);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.orderTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>

        <View style={styles.orderContent}>
          <View style={styles.orderIconContainer}>
            <Ionicons name="cafe" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <Text style={styles.sellerName}>from {item.seller_name}</Text>
          </View>
          <View style={styles.orderPriceContainer}>
            <Text style={styles.orderPrice}>1</Text>
            <Text style={styles.orderCoin}>\ud83c\udf75</Text>
          </View>
        </View>

        {(canConfirm || canCancel) && (
          <View style={styles.orderActions}>
            {canCancel && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => cancelOrder(item)}
                disabled={actionLoading === item.order_id}
              >
                {actionLoading === item.order_id ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                )}
              </TouchableOpacity>
            )}
            {canConfirm && (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => confirmDelivery(item)}
                disabled={actionLoading === item.order_id}
              >
                {actionLoading === item.order_id ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={COLORS.white} />
                    <Text style={styles.confirmBtnText}>Confirm Received</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSubtitle}>Track your</Text>
          <Text style={styles.headerTitle}>Orders</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="receipt-outline" size={56} color={COLORS.textLight} />
          </View>
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtext}>Order some tea to see your orders here</Text>
          <TouchableOpacity
            style={styles.orderTeaBtn}
            onPress={() => router.push('/app/order-tea')}
          >
            <Ionicons name="cafe" size={20} color={COLORS.white} />
            <Text style={styles.orderTeaBtnText}>Order Tea</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.order_id}
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
  header: {
    flexDirection: 'row',
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  listContent: {
    padding: 20,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  orderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  orderInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sellerName: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  orderPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  orderCoin: {
    fontSize: 18,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
  },
  cancelBtnText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    gap: 6,
  },
  confirmBtnText: {
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  orderTeaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  orderTeaBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
