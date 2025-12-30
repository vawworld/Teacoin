import React, { useState, useEffect, useCallback } from 'react';
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

interface Order {
  order_id: string;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  seller_name: string;
  item_id: string;
  item_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  confirmed_at: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pending: { color: '#FF9800', icon: 'time', label: 'Pending' },
  preparing: { color: '#2196F3', icon: 'cafe', label: 'Preparing' },
  ready: { color: '#9C27B0', icon: 'checkmark-circle', label: 'Ready' },
  delivered: { color: '#4CAF50', icon: 'bicycle', label: 'Delivered' },
  confirmed: { color: '#4CAF50', icon: 'checkmark-done', label: 'Completed' },
  cancelled: { color: '#f44336', icon: 'close-circle', label: 'Cancelled' },
};

export default function MyOrdersScreen() {
  const { sessionToken, user } = useAuth();
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
        const data = await response.json();
        setOrders(data);
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
    Alert.alert(
      'Confirm Delivery',
      `Confirm that you received "${order.item_name}"? This will transfer 1 TeaCoin to the seller.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(order.order_id);
            try {
              const response = await fetch(
                `${BACKEND_URL}/api/orders/${order.order_id}/confirm`,
                {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${sessionToken}` },
                }
              );

              if (response.ok) {
                Alert.alert('Success', 'Delivery confirmed! TeaCoin transferred to seller.');
                loadOrders();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'Failed to confirm delivery');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to confirm delivery');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const cancelOrder = async (order: Order) => {
    Alert.alert(
      'Cancel Order',
      `Cancel order for "${order.item_name}"? Your TeaCoin will be refunded.`,
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
                {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${sessionToken}` },
                }
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
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon as any} size={16} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          <Text style={styles.orderTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>

        <View style={styles.orderContent}>
          <View style={styles.orderIconContainer}>
            <Ionicons name="cafe" size={24} color="#4CAF50" />
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <Text style={styles.sellerName}>from {item.seller_name}</Text>
          </View>
          <Text style={styles.orderPrice}>1 🍵</Text>
        </View>

        {(canConfirm || canCancel) && (
          <View style={styles.orderActions}>
            {canCancel && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => cancelOrder(item)}
                disabled={actionLoading === item.order_id}
              >
                {actionLoading === item.order_id ? (
                  <ActivityIndicator size="small" color="#f44336" />
                ) : (
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                )}
              </TouchableOpacity>
            )}
            {canConfirm && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.confirmBtn]}
                onPress={() => confirmDelivery(item)}
                disabled={actionLoading === item.order_id}
              >
                {actionLoading === item.order_id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Received</Text>
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
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySubtext}>Order some tea to see your orders here</Text>
          <TouchableOpacity
            style={styles.orderTeaBtn}
            onPress={() => router.push('/order-tea')}
          >
            <Text style={styles.orderTeaBtnText}>Order Tea</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.order_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderTime: {
    fontSize: 12,
    color: '#999',
  },
  orderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  sellerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelBtn: {
    backgroundColor: '#ffebee',
  },
  cancelBtnText: {
    color: '#f44336',
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#4CAF50',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
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
  orderTeaBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  orderTeaBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
