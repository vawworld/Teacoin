import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MenuItem {
  item_id: string;
  seller_id: string;
  seller_name: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  available: boolean;
  created_at: string;
}

export default function OrderTeaScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ordering, setOrdering] = useState<string | null>(null);

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/menu`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMenuItems(data);
      }
    } catch (error) {
      console.error('Error loading menu:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMenuItems();
  };

  const handleOrder = async (item: MenuItem) => {
    Alert.alert(
      'Confirm Order',
      `Order "${item.name}" from ${item.seller_name} for 1 TeaCoin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Order',
          onPress: async () => {
            setOrdering(item.item_id);
            try {
              const response = await fetch(`${BACKEND_URL}/api/orders`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ item_id: item.item_id }),
              });

              if (response.ok) {
                Alert.alert(
                  'Order Placed! 🍵',
                  `Your order for "${item.name}" has been placed. The seller will prepare it soon!`,
                  [
                    {
                      text: 'View Orders',
                      onPress: () => router.push('/my-orders'),
                    },
                    { text: 'OK' },
                  ]
                );
              } else {
                const error = await response.json();
                Alert.alert('Order Failed', error.detail || 'Failed to place order');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to place order. Please try again.');
            } finally {
              setOrdering(null);
            }
          },
        },
      ]
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuItem}>
      <View style={styles.menuImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.menuImage} />
        ) : (
          <View style={styles.menuImagePlaceholder}>
            <Ionicons name="cafe" size={40} color="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.sellerName}>by {item.seller_name}</Text>
        {item.description && (
          <Text style={styles.menuDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price} 🍵</Text>
          <TouchableOpacity
            style={[
              styles.orderButton,
              ordering === item.item_id && styles.orderButtonDisabled,
            ]}
            onPress={() => handleOrder(item)}
            disabled={ordering === item.item_id}
          >
            {ordering === item.item_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cart" size={16} color="#fff" />
                <Text style={styles.orderButtonText}>Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tea</Text>
        <View style={{ width: 24 }} />
      </View>

      {menuItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cafe-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No tea available</Text>
          <Text style={styles.emptySubtext}>
            No sellers have listed their tea yet.
          </Text>
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
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuImageContainer: {
    height: 150,
    backgroundColor: '#f0f0f0',
  },
  menuImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  menuImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuInfo: {
    padding: 16,
  },
  menuName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  sellerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  menuDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  orderButtonDisabled: {
    backgroundColor: '#ccc',
  },
  orderButtonText: {
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
});
