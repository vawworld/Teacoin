import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  Animated,
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

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string; bg: string }> = {
  pending: { color: COLORS.warning, icon: 'time', label: 'New', bg: '#FFF3E0' },
  preparing: { color: COLORS.info, icon: 'cafe', label: 'Preparing', bg: '#E3F2FD' },
  ready: { color: COLORS.purple, icon: 'checkmark-circle', label: 'Ready', bg: '#F3E5F5' },
  delivered: { color: COLORS.success, icon: 'bicycle', label: 'Delivered', bg: '#E8F5E9' },
  confirmed: { color: COLORS.success, icon: 'checkmark-done', label: 'Done', bg: '#E8F5E9' },
  cancelled: { color: COLORS.error, icon: 'close-circle', label: 'Cancelled', bg: '#FFEBEE' },
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
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Notification state
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showNewOrderBanner, setShowNewOrderBanner] = useState(false);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const bannerAnim = useRef(new Animated.Value(-100)).current;
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Start polling for new orders every 15 seconds
      startPolling();
      
      return () => {
        // Stop polling when screen loses focus
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }, [])
  );

  const startPolling = () => {
    // Clear any existing interval
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    // Poll every 15 seconds
    pollingInterval.current = setInterval(() => {
      checkForNewOrders();
    }, 15000);
  };

  const checkForNewOrders = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/seller`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        const newOrders: Order[] = await response.json();
        const pendingOrders = newOrders.filter(o => o.status === 'pending');
        
        // Check if there are new pending orders since last check
        if (pendingOrders.length > lastOrderCount && lastOrderCount > 0) {
          const newCount = pendingOrders.length - lastOrderCount;
          setNewOrderCount(newCount);
          showNotificationBanner(newCount);
          // Vibrate to alert the seller
          Vibration.vibrate([0, 200, 100, 200]);
        }
        
        setLastOrderCount(pendingOrders.length);
        setOrders(newOrders);
      }
    } catch (error) {
      console.error('Error polling for orders:', error);
    }
  };

  const showNotificationBanner = (count: number) => {
    setShowNewOrderBanner(true);
    // Animate banner sliding in
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto-hide after 5 seconds
    setTimeout(() => {
      hideNotificationBanner();
    }, 5000);
  };

  const hideNotificationBanner = () => {
    Animated.timing(bannerAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowNewOrderBanner(false);
      setNewOrderCount(0);
    });
  };

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
        // Set initial pending order count (don't show notification on first load)
        const pendingCount = ordersData.filter((o: Order) => o.status === 'pending').length;
        setLastOrderCount(pendingCount);
      }
      if (menuRes.ok) setMenuItems(await menuRes.json());
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
        body: JSON.stringify({ name: newItemName, description: newItemDesc || null }),
      });
      if (response.ok) {
        Alert.alert('Success! \ud83c\udf75', 'Menu item added!');
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
      await fetch(`${BACKEND_URL}/api/menu/${item.item_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ available: !item.available }),
      });
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const deleteMenuItem = async (item: MenuItem) => {
    Alert.alert('Delete Item', `Delete "${item.name}" from your menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${BACKEND_URL}/api/menu/${item.item_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${sessionToken}` },
            });
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
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
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.orderTime}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderIconBg}>
            <Ionicons name="cafe" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderItem}>{item.item_name}</Text>
            <Text style={styles.orderBuyer}>for {item.buyer_name}</Text>
          </View>
        </View>

        {nextStatus && (
          <TouchableOpacity
            style={[styles.statusBtn, { backgroundColor: STATUS_CONFIG[nextStatus].color }]}
            onPress={() => updateOrderStatus(item.order_id, nextStatus)}
            disabled={actionLoading === item.order_id}
            activeOpacity={0.8}
          >
            {actionLoading === item.order_id ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name={STATUS_CONFIG[nextStatus].icon as any} size={18} color={COLORS.white} />
                <Text style={styles.statusBtnText}>Mark as {STATUS_CONFIG[nextStatus].label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuCard}>
      <View style={styles.menuIconBg}>
        <Ionicons name="cafe" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        {item.description && <Text style={styles.menuDesc} numberOfLines={1}>{item.description}</Text>}
        <View style={[styles.availBadge, { backgroundColor: item.available ? '#E8F5E9' : '#FFEBEE' }]}>
          <Text style={[styles.availText, { color: item.available ? COLORS.success : COLORS.error }]}>
            {item.available ? 'Available' : 'Hidden'}
          </Text>
        </View>
      </View>
      <View style={styles.menuActions}>
        <TouchableOpacity style={styles.menuActionBtn} onPress={() => toggleItemAvailability(item)}>
          <Ionicons name={item.available ? 'eye-off' : 'eye'} size={20} color={COLORS.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuActionBtn} onPress={() => deleteMenuItem(item)}>
          <Ionicons name="trash" size={20} color={COLORS.error} />
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

  const activeOrders = orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));

  return (
    <View style={styles.container}>
      {/* New Order Notification Banner */}
      {showNewOrderBanner && (
        <Animated.View 
          style={[
            styles.notificationBanner,
            { transform: [{ translateY: bannerAnim }] }
          ]}
        >
          <TouchableOpacity 
            style={styles.notificationContent}
            onPress={() => {
              hideNotificationBanner();
              setActiveTab('orders');
            }}
            activeOpacity={0.9}
          >
            <View style={styles.notificationIconBg}>
              <Ionicons name="notifications" size={20} color={COLORS.white} />
            </View>
            <View style={styles.notificationTextContainer}>
              <Text style={styles.notificationTitle}>🍵 New Order{newOrderCount > 1 ? 's' : ''}!</Text>
              <Text style={styles.notificationSubtitle}>
                You have {newOrderCount} new order{newOrderCount > 1 ? 's' : ''} to prepare
              </Text>
            </View>
            <TouchableOpacity onPress={hideNotificationBanner} style={styles.notificationClose}>
              <Ionicons name="close" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSubtitle}>Manage your</Text>
          <Text style={styles.headerTitle}>Tea Shop</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
          onPress={() => setActiveTab('orders')}
        >
          <Ionicons 
            name="receipt" 
            size={20} 
            color={activeTab === 'orders' ? COLORS.primary : COLORS.textLight} 
          />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>
            Orders
          </Text>
          {activeOrders.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
          onPress={() => setActiveTab('menu')}
        >
          <Ionicons 
            name="cafe" 
            size={20} 
            color={activeTab === 'menu' ? COLORS.primary : COLORS.textLight} 
          />
          <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>
            Menu
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'orders' ? (
        activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No Pending Orders</Text>
            <Text style={styles.emptySubtext}>New orders will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={activeOrders}
            renderItem={renderOrder}
            keyExtractor={(item) => item.order_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
            }
          />
        )
      ) : (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={22} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add New Tea</Text>
          </TouchableOpacity>

          {menuItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="cafe-outline" size={48} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No Menu Items</Text>
              <Text style={styles.emptySubtext}>Add your first tea to get started</Text>
            </View>
          ) : (
            <FlatList
              data={menuItems}
              renderItem={renderMenuItem}
              keyExtractor={(item) => item.item_id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
              }
            />
          )}
        </>
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Tea</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Tea Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Green Tea, Chai Latte"
              placeholderTextColor={COLORS.textLight}
              value={newItemName}
              onChangeText={setNewItemName}
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell customers about this tea..."
              placeholderTextColor={COLORS.textLight}
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
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="add" size={20} color={COLORS.white} />
                    <Text style={styles.addModalBtnText}>Add Tea</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Notification Banner Styles
  notificationBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    padding: 16,
  },
  notificationIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  notificationSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  notificationClose: {
    padding: 8,
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FFF8DC',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
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
  orderDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  orderInfo: {
    flex: 1,
  },
  orderItem: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  orderBuyer: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    gap: 8,
  },
  statusBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    margin: 20,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuInfo: {
    flex: 1,
  },
  menuName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuDesc: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  availBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
  },
  availText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuActions: {
    flexDirection: 'row',
    gap: 4,
  },
  menuActionBtn: {
    padding: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelModalBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: COLORS.textLight,
    fontWeight: '600',
    fontSize: 16,
  },
  addModalBtn: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addModalBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
});
