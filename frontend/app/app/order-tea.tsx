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
};

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
        setMenuItems(await response.json());
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
    const price = item.price || 1;
    
    // Direct order without confirmation dialog for better mobile compatibility
    setOrdering(item.item_id);
    try {
      console.log('Placing order for item:', item.item_id);
      const response = await fetch(`${BACKEND_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ item_id: item.item_id }),
      });

      console.log('Order response status:', response.status);

      if (response.ok) {
        Alert.alert(
          'Order Placed! 🎉',
          `Your order is being prepared by ${item.seller_name}! (${price} TeaCoin${price > 1 ? 's' : ''} deducted)`,
          [
            { text: 'View Orders', onPress: () => router.push('/app/my-orders') },
            { text: 'OK' },
          ]
        );
        loadMenuItems();
      } else {
        const error = await response.json();
        console.log('Order error:', error);
        Alert.alert('Order Failed', error.detail || 'Failed to place order');
      }
    } catch (error) {
      console.error('Order error:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setOrdering(null);
    }
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuCard}>
      <View style={styles.menuImageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.menuImage} />
        ) : (
          <LinearGradient
            colors={['#D2691E', '#8B4513']}
            style={styles.menuImagePlaceholder}
          >
            <Ionicons name="cafe" size={48} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        )}
        <View style={styles.priceTag}>
          <Ionicons name="logo-bitcoin" size={14} color={COLORS.primary} />
          <Text style={styles.priceText}>{item.price || 1}</Text>
        </View>
      </View>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        <View style={styles.sellerRow}>
          <Ionicons name="person-circle" size={16} color={COLORS.textLight} />
          <Text style={styles.sellerName}>{item.seller_name}</Text>
        </View>
        {item.description && (
          <Text style={styles.menuDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.orderButton,
            ordering === item.item_id && styles.orderButtonDisabled,
          ]}
          onPress={() => handleOrder(item)}
          disabled={ordering === item.item_id}
          activeOpacity={0.8}
        >
          {ordering === item.item_id ? (
            <>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.orderButtonText}>Processing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cart" size={18} color={COLORS.white} />
              <Text style={styles.orderButtonText}>Order Now</Text>
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSubtitle}>Browse & Order</Text>
          <Text style={styles.headerTitle}>Tea Menu</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {menuItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="cafe-outline" size={56} color={COLORS.textLight} />
          </View>
          <Text style={styles.emptyTitle}>No Tea Available</Text>
          <Text style={styles.emptySubtext}>
            No sellers have listed their tea yet.{"\n"}Check back soon!
          </Text>
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
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  menuImageContainer: {
    height: 160,
    position: 'relative',
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
  priceTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  menuInfo: {
    padding: 20,
  },
  menuName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  sellerName: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  menuDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 10,
    lineHeight: 20,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    gap: 8,
  },
  orderButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  orderButtonText: {
    color: COLORS.white,
    fontSize: 16,
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
    lineHeight: 22,
  },
});
