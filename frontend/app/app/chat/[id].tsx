import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { formatDistanceToNow } from 'date-fns';
import { soundManager } from '../../../utils/sounds';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  message_id: string;
  sender_id: string;
  sender_name: string;
  sender_picture?: string;
  content?: string;
  image?: string;
  timestamp: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const conversationId = id as string;
  const { user, sessionToken } = useAuth();
  const router = useRouter();
  
  console.log('🔵 CHAT SCREEN LOADED');
  console.log('🔵 Conversation ID:', conversationId);
  console.log('🔵 User:', user?.name);
  console.log('🔵 Session Token exists:', !!sessionToken);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMessages();
    
    // Start polling for new messages every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      loadMessages(true);
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [conversationId]);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await fetch(
        `${BACKEND_URL}/api/conversations/${conversationId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    if (!sessionToken) {
      alert('Error: No session token. Please log in again.');
      console.error('No session token available');
      return;
    }
    
    setSending(true);
    try {
      console.log('Sending message to:', conversationId);
      console.log('Token:', sessionToken.substring(0, 20) + '...');
      
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: inputText.trim(),
        }),
      });

      console.log('Message response status:', response.status);
      
      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setInputText('');
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd();
        }, 100);
      } else {
        const error = await response.text();
        console.error('Error sending message:', response.status, error);
        alert(`Failed to send message: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Network error sending message');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSending(true);
      try {
        const imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        const response = await fetch(`${BACKEND_URL}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            image: imageBase64,
          }),
        });

        if (response.ok) {
          const newMessage = await response.json();
          setMessages((prev) => [...prev, newMessage]);
          
          setTimeout(() => {
            flatListRef.current?.scrollToEnd();
          }, 100);
        }
      } catch (error) {
        console.error('Error sending image:', error);
      } finally {
        setSending(false);
      }
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.user_id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && item.sender_picture && (
          <Image source={{ uri: item.sender_picture }} style={styles.messageAvatar} />
        )}

        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}

          {item.image && (
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          )}

          {item.content && (
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownText : styles.otherText,
              ]}
            >
              {item.content}
            </Text>
          )}

          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}
          >
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </Text>
        </View>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.message_id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage} disabled={sending}>
          <Ionicons name="image" size={24} color={sending ? "#ccc" : "#0084ff"} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={(text) => {
            console.log('Input changed:', text);
            setInputText(text);
          }}
          multiline
          maxLength={1000}
          editable={!sending}
        />

        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={() => {
            console.log('Send button pressed! Text:', inputText);
            handleSend();
          }}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: 16,
    padding: 12,
  },
  ownBubble: {
    backgroundColor: '#0084ff',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownText: {
    color: 'white',
  },
  otherText: {
    color: '#000',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  ownTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherTimestamp: {
    color: '#999',
  },
  typingIndicator: {
    padding: 8,
    paddingLeft: 16,
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  imageButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#0084ff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});