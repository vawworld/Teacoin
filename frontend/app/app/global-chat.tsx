import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

const COLORS = {
  primary: '#8B4513',
  secondary: '#D2691E',
  background: '#FFF8F0',
  white: '#FFFFFF',
  text: '#2D1810',
  textLight: '#8B7355',
  border: '#E8DDD4',
  success: '#4CAF50',
  mention: '#1E88E5',
  mentionBg: '#E3F2FD',
  replyBg: '#F5F5F5',
};

interface User {
  user_id: string;
  name: string;
  picture?: string;
  profession?: string;
}

interface ReplyTo {
  message_id: string;
  sender_name: string;
  content: string;
}

interface Message {
  message_id: string;
  sender_id: string;
  sender_name: string;
  sender_picture?: string;
  content: string;
  mentions?: string[];
  reply_to?: ReplyTo;
  timestamp: string;
}

export default function GlobalChatScreen() {
  const { user, sessionToken } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadMessages();
    loadUsers();
    
    // Poll for new messages every 3 seconds
    pollingIntervalRef.current = setInterval(() => {
      loadMessages(true);
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await fetch(`${BACKEND_URL}/api/chat/global`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

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

  const loadUsers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/global/users`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    
    // Check for @ mentions
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      const hasSpaceAfter = afterAt.includes(' ');
      
      if (!hasSpaceAfter && afterAt.length >= 0) {
        setMentionSearch(afterAt.toLowerCase());
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (selectedUser: User) => {
    const lastAtIndex = inputText.lastIndexOf('@');
    const beforeAt = inputText.substring(0, lastAtIndex);
    const newText = `${beforeAt}@${selectedUser.name} `;
    setInputText(newText);
    setShowMentions(false);
    
    // Track mentioned user
    if (!selectedMentions.includes(selectedUser.user_id)) {
      setSelectedMentions([...selectedMentions, selectedUser.user_id]);
    }
    
    inputRef.current?.focus();
  };

  const filteredUsers = allUsers.filter(u => 
    u.user_id !== user?.user_id &&
    (u.name.toLowerCase().includes(mentionSearch) ||
     (u.profession && u.profession.toLowerCase().includes(mentionSearch)))
  );

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    
    setSending(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ 
          content: inputText.trim(),
          mentions: selectedMentions,
          reply_to: replyTo,
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setInputText('');
        setSelectedMentions([]);
        setReplyTo(null);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo({
      message_id: message.message_id,
      sender_name: message.sender_name,
      content: message.content,
    });
    setSelectedMessage(null);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  // Render message content with highlighted mentions
  const renderContent = (content: string, mentions?: string[]) => {
    if (!content) return null;
    
    // Find @mentions in the text
    const parts = content.split(/(@\w+(?:\s\w+)?)/g);
    
    return (
      <Text style={styles.messageText}>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            return (
              <Text key={index} style={styles.mentionText}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.user_id;
    const isMentioned = item.mentions?.includes(user?.user_id || '');
    
    return (
      <Pressable 
        style={[
          styles.messageRow, 
          isMe && styles.messageRowMe,
          isMentioned && styles.messageRowMentioned,
        ]}
        onLongPress={() => setSelectedMessage(item)}
      >
        {!isMe && (
          <Image
            source={{ uri: item.sender_picture || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        )}
        <View style={[
          styles.messageBubble, 
          isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
          isMentioned && !isMe && styles.messageBubbleMentioned,
        ]}>
          {!isMe && <Text style={styles.senderName}>{item.sender_name}</Text>}
          
          {/* Reply Preview */}
          {item.reply_to && (
            <View style={styles.replyPreview}>
              <View style={styles.replyBar} />
              <View style={styles.replyContent}>
                <Text style={styles.replyName}>{item.reply_to.sender_name}</Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {item.reply_to.content}
                </Text>
              </View>
            </View>
          )}
          
          {/* Message content with mentions */}
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {renderContent(item.content, item.mentions)}
          </Text>
          
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="globe-outline" size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>TEAFRIENDS Community</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Live</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.message_id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Be the first to say hello! 👋</Text>
          </View>
        }
      />

      {/* Mentions Dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <View style={styles.mentionsDropdown}>
          <Text style={styles.mentionsTitle}>Mention someone</Text>
          {filteredUsers.slice(0, 5).map((u) => (
            <TouchableOpacity
              key={u.user_id}
              style={styles.mentionItem}
              onPress={() => selectMention(u)}
            >
              <Image
                source={{ uri: u.picture || 'https://via.placeholder.com/32' }}
                style={styles.mentionAvatar}
              />
              <View>
                <Text style={styles.mentionName}>{u.name}</Text>
                {u.profession && (
                  <Text style={styles.mentionProfession}>#{u.profession}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Ionicons name="arrow-undo" size={16} color={COLORS.primary} />
            <View style={styles.replyBarText}>
              <Text style={styles.replyBarName}>Replying to {replyTo.sender_name}</Text>
              <Text style={styles.replyBarMessage} numberOfLines={1}>
                {replyTo.content}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={cancelReply} style={styles.replyBarClose}>
            <Ionicons name="close" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Say hi to everyone... Use @ to mention"
          placeholderTextColor={COLORS.textLight}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Message Actions Modal */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setSelectedMessage(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Message Options</Text>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => selectedMessage && handleReply(selectedMessage)}
            >
              <Ionicons name="arrow-undo" size={20} color={COLORS.primary} />
              <Text style={styles.modalOptionText}>Reply</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setSelectedMessage(null)}
            >
              <Ionicons name="close" size={20} color={COLORS.textLight} />
              <Text style={[styles.modalOptionText, { color: COLORS.textLight }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
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
    padding: 16,
    paddingTop: 50,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  messageList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    flexDirection: 'row-reverse',
  },
  messageRowMentioned: {
    backgroundColor: COLORS.mentionBg,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
  },
  messageBubbleMentioned: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.mention,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  messageTextMe: {
    color: COLORS.white,
  },
  mentionText: {
    color: COLORS.mention,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 4,
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  replyPreview: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    opacity: 0.8,
  },
  replyBar: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyBarText: {
    flex: 1,
  },
  replyBarName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  replyBarMessage: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  replyBarClose: {
    padding: 4,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  replyText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  mentionsDropdown: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
    maxHeight: 200,
  },
  mentionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  mentionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  mentionProfession: {
    fontSize: 12,
    color: COLORS.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalOptionText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
});
