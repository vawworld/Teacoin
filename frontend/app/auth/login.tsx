import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubbles" size={80} color="#0084ff" />
        </View>
        
        <Text style={styles.title}>ProLink Messenger</Text>
        <Text style={styles.subtitle}>Connect with professionals worldwide</Text>
        
        <TouchableOpacity style={styles.button} onPress={login}>
          <Ionicons name="logo-google" size={20} color="white" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </TouchableOpacity>
        
        <Text style={styles.footer}>Search by profession, start chatting instantly</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#0084ff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 32,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});