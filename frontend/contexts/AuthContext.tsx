import React, { createContext, useState, useEffect, useContext } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  profession?: string;
  bio?: string;
  skills: string[];
  online: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  sessionToken: string | null;
  onSocketConnect?: (token: string) => void;
  onSocketDisconnect?: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [onSocketConnect, setOnSocketConnect] = useState<((token: string) => void) | undefined>();
  const [onSocketDisconnect, setOnSocketDisconnect] = useState<(() => void) | undefined>();

  useEffect(() => {
    // Check for session_id in current URL (for web auth callback)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
      
      if (sessionId) {
        exchangeSessionId(sessionId);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }
    
    checkAuth();
    
    // Handle deep links for mobile
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (event: { url: string }) => {
    const url = event.url;
    await processAuthUrl(url);
  };

  const processAuthUrl = async (url: string) => {
    // Check for session_id in URL
    const sessionIdMatch = url.match(/[#?]session_id=([^&]+)/);
    if (sessionIdMatch) {
      const sessionId = sessionIdMatch[1];
      await exchangeSessionId(sessionId);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/callback?session_id=${sessionId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionToken(data.session_token);
        await checkAuth(data.session_token);
      }
    } catch (error) {
      console.error('Error exchanging session ID:', error);
    }
  };

  const checkAuth = async (token?: string) => {
    try {
      const authToken = token || sessionToken;
      if (!authToken) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        if (token) {
          setSessionToken(token);
          // Notify socket to connect
          if (onSocketConnect) {
            onSocketConnect(token);
          }
        }
      } else {
        setSessionToken(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const redirectUrl = Platform.OS === 'web'
        ? window.location.origin
        : Linking.createURL('/');
      
      const authUrl = `https://auth.emergentagent.com/?app_name=TEAFRIENDS&redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (result.type === 'success' && result.url) {
          await processAuthUrl(result.url);
        }
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
      setUser(null);
      setSessionToken(null);
      // Notify socket to disconnect
      if (onSocketDisconnect) {
        onSocketDisconnect();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, sessionToken, onSocketConnect: setOnSocketConnect as any, onSocketDisconnect: setOnSocketDisconnect as any }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};