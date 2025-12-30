import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
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

interface SellerStatus {
  is_seller: boolean;
  seller_status: string | null;
  seller_requested_at: string | null;
}

export default function BecomeSellerScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionToken) {
      loadSellerStatus();
    }
  }, [sessionToken]);

  const loadSellerStatus = async () => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/seller/status`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.ok) {
        setStatus(await response.json());
      }
    } catch (error) {
      console.error('Error loading seller status:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyAsSeller = async () => {
    if (!sessionToken) {
      Alert.alert('Error', 'Please login first');
      return;
    }
    setSubmitting(true);
    try {
      console.log('Applying as seller with token:', sessionToken ? 'present' : 'missing');
      const response = await fetch(`${BACKEND_URL}/api/seller/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ apply: true }),
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        Alert.alert(
          'Application Submitted! 🎉',
          'Your seller application is under review. You\'ll be notified once approved.',
          [{ text: 'OK', onPress: loadSellerStatus }]
        );
      } else {
        const error = await response.json();
        console.log('Error response:', error);
        Alert.alert('Error', error.detail || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Apply error:', error);
      Alert.alert('Error', 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawApplication = async () => {
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw your seller application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const response = await fetch(`${BACKEND_URL}/api/seller/apply`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ apply: false }),
              });
              if (response.ok) {
                Alert.alert('Withdrawn', 'Your application has been withdrawn.');
                loadSellerStatus();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to withdraw application');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Already approved seller
  if (status?.is_seller && status?.seller_status === 'approved') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Seller Status</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          <View style={styles.successIconBg}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>You're a Seller! \ud83c\udf89</Text>
          <Text style={styles.successSubtext}>
            You can now create menu items and start earning TeaCoins!
          </Text>
          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => router.push('/app/seller-dashboard')}
          >
            <Ionicons name="storefront" size={20} color={COLORS.white} />
            <Text style={styles.dashboardBtnText}>Go to Seller Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Seller</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <LinearGradient
          colors={['#FF9800', '#F57C00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name="storefront" size={56} color={COLORS.white} />
        </LinearGradient>

        <Text style={styles.title}>Sell Tea, Earn TeaCoins</Text>
        <Text style={styles.subtitle}>
          Become a seller and share your favorite tea with the community.
          Earn TeaCoins for every order you fulfill!
        </Text>

        {status?.seller_status === 'pending' ? (
          <View style={styles.statusCard}>
            <View style={styles.pendingIcon}>
              <Ionicons name="time" size={32} color={COLORS.warning} />
            </View>
            <Text style={styles.statusTitle}>Application Pending</Text>
            <Text style={styles.statusText}>
              Your seller application is being reviewed.{"\n"}You'll be notified once it's approved.
            </Text>
            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={withdrawApplication}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Text style={styles.withdrawBtnText}>Withdraw Application</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : status?.seller_status === 'rejected' ? (
          <View style={styles.statusCard}>
            <View style={[styles.pendingIcon, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="close-circle" size={32} color={COLORS.error} />
            </View>
            <Text style={styles.statusTitle}>Application Rejected</Text>
            <Text style={styles.statusText}>
              Unfortunately, your application was not approved.{"\n"}You can try again.
            </Text>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={applyAsSeller}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.applyBtnText}>Apply Again</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>Benefits</Text>
              
              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="cash" size={22} color={COLORS.success} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Earn TeaCoins</Text>
                  <Text style={styles.benefitText}>Get 1 TeaCoin for every order delivered</Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="create" size={22} color={COLORS.info} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Create Your Menu</Text>
                  <Text style={styles.benefitText}>List your favorite teas for others to order</Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="people" size={22} color={COLORS.purple} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Connect</Text>
                  <Text style={styles.benefitText}>Meet tea lovers in your community</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={applyAsSeller}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="rocket" size={20} color={COLORS.white} />
                  <Text style={styles.applyBtnText}>Apply to Become a Seller</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const COLORS_EXTRA = {
  info: '#2196F3',
  purple: '#9C27B0',
};

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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    marginTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  benefitText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 28,
    width: '100%',
    gap: 10,
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '600',
  },
  statusCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginTop: 28,
  },
  pendingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  withdrawBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
  },
  withdrawBtnText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  successIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  successSubtext: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 28,
    gap: 10,
  },
  dashboardBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
