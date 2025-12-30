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
import { useAuth } from '../../contexts/AuthContext';
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
  const [location, setLocation] = useState('');
  const [languages, setLanguages] = useState('');
  const [interests, setInterests] = useState('');
  const [helpOffered, setHelpOffered] = useState('');
  const [helpNeeded, setHelpNeeded] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [industry, setIndustry] = useState('');
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
          location: location.trim(),
          languages: languages.split(',').map(s => s.trim()).filter(s => s),
          interests: interests.split(',').map(s => s.trim()).filter(s => s),
          help_offered: helpOffered.trim(),
          help_needed: helpNeeded.trim(),
          experience_years: experienceYears ? parseInt(experienceYears) : null,
          industry: industry.trim(),
        }),
      });

      if (response.ok) {
        if (user) {
          updateUser({
            ...user,
            profession: profession.trim(),
            bio: bio.trim(),
            skills: skills.split(',').map(s => s.trim()).filter(s => s),
            picture,
          });
        }
        router.replace('/app/(tabs)/chats');
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
        <Text style={styles.subtitle}>Help others find and connect with you</Text>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {picture ? (
            <Image source={{ uri: picture }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="camera" size={40} color="#999" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Basic Info</Text>
          
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
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., New York, USA"
              value={location}
              onChangeText={setLocation}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Industry</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Technology, Entertainment"
              value={industry}
              onChangeText={setIndustry}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5"
              value={experienceYears}
              onChangeText={setExperienceYears}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Skills & Expertise</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Skills (comma separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., React, Node.js, MongoDB"
              value={skills}
              onChangeText={setSkills}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Languages (comma separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., English, Spanish, Hindi"
              value={languages}
              onChangeText={setLanguages}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Interests (comma separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Photography, Travel, Music"
              value={interests}
              onChangeText={setInterests}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Help & Support</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>What can you help others with?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., I can help with web development, career advice, music production..."
              value={helpOffered}
              onChangeText={setHelpOffered}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>What help are you looking for?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., I need help with marketing, design feedback, learning Spanish..."
              value={helpNeeded}
              onChangeText={setHelpNeeded}
              multiline
              numberOfLines={3}
            />
          </View>
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

        <Text style={styles.note}>* Required field</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8DC',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0522D',
    marginBottom: 24,
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 24,
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
    backgroundColor: '#F5DEB3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DEB887',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#8B4513',
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
  note: {
    textAlign: 'center',
    color: '#A0522D',
    fontSize: 12,
    marginTop: 16,
  },
});
