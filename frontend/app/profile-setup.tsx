import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileSetup() {
  const { user, sessionToken, updateUser } = useAuth();
  const router = useRouter();
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [picture, setPicture] = useState(user?.picture || '');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPicture(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    if (!profession.trim()) {
      Alert.alert('Error', 'Please enter your profession');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          profession: profession.trim(),
          bio: bio.trim(),
          skills: skills.split(',').map(s => s.trim()).filter(s => s),
          picture,
        }),
      });

      if (response.ok) {
        // Update user in context
        if (user) {
          updateUser({
            ...user,
            profession: profession.trim(),
            bio: bio.trim(),
            skills: skills.split(',').map(s => s.trim()).filter(s => s),
            picture,
          });
        }
        router.replace('/(tabs)/chats');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Help others find you by profession</Text>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {picture ? (
            <Image source={{ uri: picture }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="camera" size={40} color="#999" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Profession *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Singer, Developer, Designer"
            value={profession}
            onChangeText={setProfession}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Skills (comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., React, Node.js, MongoDB"
            value={skills}
            onChangeText={setSkills}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#0084ff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});