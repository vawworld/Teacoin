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

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
    loadSellerStatus();
  }, []);

  const loadSellerStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/seller/status`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error loading seller status:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyAsSeller = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/seller/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ apply: true }),
      });

      if (response.ok) {
        Alert.alert(
          'Application Submitted! 🎉',
          'Your seller application has been submitted. You will be notified once approved.',
          [{ text: 'OK', onPress: () => loadSellerStatus() }]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to submit application');
      }
    } catch (error) {
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
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Seller</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="storefront" size={64} color="#FF9800" />
        </View>

        <Text style={styles.title}>Sell Tea, Earn TeaCoins</Text>
        <Text style={styles.subtitle}>
          Become a seller and share your favorite tea with others. Earn TeaCoins
          for every order you fulfill!
        </Text>

        {status?.seller_status === 'pending' ? (
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Ionicons name="time" size={32} color="#FF9800" />
            </View>
            <Text style={styles.statusTitle}>Application Pending</Text>
            <Text style={styles.statusText}>
              Your seller application is being reviewed. You'll be notified once
              it's approved.
            </Text>
            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={withdrawApplication}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#f44336" />
              ) : (
                <Text style={styles.withdrawBtnText}>Withdraw Application</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : status?.seller_status === 'rejected' ? (
          <View style={styles.statusCard}>
            <View style={[styles.statusIcon, { backgroundColor: '#ffebee' }]}>
              <Ionicons name="close-circle" size={32} color="#f44336" />
            </View>
            <Text style={styles.statusTitle}>Application Rejected</Text>
            <Text style={styles.statusText}>
              Unfortunately, your seller application was not approved. You can try
              again.
            </Text>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={applyAsSeller}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.applyBtnText}>Apply Again</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.benefits}>
              <Text style={styles.benefitsTitle}>Benefits</Text>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Earn 1 TeaCoin for every order delivered
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Create and manage your own tea menu
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Connect with tea lovers in the community
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={applyAsSeller}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.applyBtnText}>Apply to Become a Seller</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  benefits: {
    width: '100%',
    marginTop: 32,
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  applyBtn: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 32,
    width: '100%',
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  withdrawBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#ffebee',
  },
  withdrawBtnText: {
    color: '#f44336',
    fontWeight: '600',
  },
});
