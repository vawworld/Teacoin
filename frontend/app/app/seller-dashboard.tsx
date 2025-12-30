import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MenuItem {
  item_id: string;
  name: string;
  description: string | null;
  available: boolean;
  created_at: string;
}

interface Order {
  order_id: string;
  buyer_name: string;
  item_name: string;
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pending: { color: '#FF9800', icon: 'time', label: 'Pending' },
  preparing: { color: '#2196F3', icon: 'cafe', label: 'Preparing' },
  ready: { color: '#9C27B0', icon: 'checkmark-circle', label: 'Ready' },
  delivered: { color: '#4CAF50', icon: 'bicycle', label: 'Delivered' },
  confirmed: { color: '#4CAF50', icon: 'checkmark-done', label: 'Completed' },
  cancelled: { color: '#f44336', icon: 'close-circle', label: 'Cancelled' },
};

export default function SellerDashboardScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Add menu modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [ordersRes, menuRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/orders/seller`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch(`${BACKEND_URL}/api/menu/my`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setMenuItems(menuData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(orderId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        loadData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to update order');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

  const addMenuItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter a name for your tea');
      return;
    }

    setAddingItem(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: newItemName,
          description: newItemDesc || null,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Menu item added!');
        setShowAddModal(false);
        setNewItemName('');
        setNewItemDesc('');
        loadData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to add menu item');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add menu item');
    } finally {
      setAddingItem(false);
    }
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/menu/${item.item_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ available: !item.available }),
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const deleteMenuItem = async (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Delete "${item.name}" from your menu?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/menu/${item.item_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${sessionToken}` },
              });

              if (response.ok) {
                loadData();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const transitions: Record<string, string> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'delivered',
    };
    return transitions[currentStatus] || null;
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const nextStatus = getNextStatus(item.status);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          <Text style={styles.orderTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.orderItem}>{item.item_name}</Text>
          <Text style={styles.orderBuyer}>for {item.buyer_name}</Text>
        </View>

        {nextStatus && (
          <TouchableOpacity
            style={[styles.statusBtn, { backgroundColor: STATUS_CONFIG[nextStatus].color }]}
            onPress={() => updateOrderStatus(item.order_id, nextStatus)}
            disabled={actionLoading === item.order_id}
          >
            {actionLoading === item.order_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.statusBtnText}>
                Mark as {STATUS_CONFIG[nextStatus].label}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuCard}>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.menuDesc}>{item.description}</Text>
        )}
        <Text style={[styles.menuAvail, { color: item.available ? '#4CAF50' : '#f44336' }]}>
          {item.available ? 'Available' : 'Unavailable'}
        </Text>
      </View>
      <View style={styles.menuActions}>
        <TouchableOpacity
          style={styles.menuActionBtn}
          onPress={() => toggleItemAvailability(item)}
        >
          <Ionicons
            name={item.available ? 'eye-off' : 'eye'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuActionBtn}
          onPress={() => deleteMenuItem(item)}
        >
          <Ionicons name="trash" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  const activeOrders = orders.filter((o) =>
    ['pending', 'preparing', 'ready'].includes(o.status)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seller Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>
            Orders ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>
            Menu ({menuItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'orders' ? (
        activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No pending orders</Text>
          </View>
        ) : (
          <FlatList
            data={activeOrders}
            renderItem={renderOrder}
            keyExtractor={(item) => item.order_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )
      ) : (
        <>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add Tea Item</Text>
          </TouchableOpacity>

          {menuItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cafe-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No menu items yet</Text>
              <Text style={styles.emptySubtext}>Add your first tea item</Text>
            </View>
          ) : (
            <FlatList
              data={menuItems}
              renderItem={renderMenuItem}
              keyExtractor={(item) => item.item_id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
        </>
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Tea Item</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Tea Name (e.g., Green Tea)"
              value={newItemName}
              onChangeText={setNewItemName}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={newItemDesc}
              onChangeText={setNewItemDesc}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addModalBtn}
                onPress={addMenuItem}
                disabled={addingItem}
              >
                {addingItem ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addModalBtnText}>Add Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#FF9800',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF9800',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  orderDetails: {
    marginBottom: 12,
  },
  orderItem: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  orderBuyer: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  menuDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  menuAvail: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  menuActions: {
    flexDirection: 'row',
    gap: 8,
  },
  menuActionBtn: {
    padding: 8,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#666',
    fontWeight: '600',
  },
  addModalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  addModalBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
