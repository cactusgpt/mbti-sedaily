import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { authConfig } from '@/config/auth';
import { API_URL } from '@/config/api';

// Configure Amplify
Amplify.configure(authConfig as any);

interface User {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithKakao: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync user profile with backend
  const syncUserProfile = async (userData: User) => {
    try {
      const mbtiGroup = localStorage.getItem('mbti-group') || 'SF';
      await fetch(`${API_URL}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.userId,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          mbti_group: mbtiGroup,
        }),
      });
    } catch (error) {
      console.error('Failed to sync user profile:', error);
    }
  };

  // Check current auth state
  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;

      if (currentUser && idToken) {
        const userData = {
          userId: currentUser.userId,
          email: idToken.payload.email as string,
          name: idToken.payload.name as string,
          picture: idToken.payload.picture as string,
        };
        setUser(userData);
        // Sync with backend
        syncUserProfile(userData);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkUser();

    // Listen for auth events
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signInWithRedirect':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (error) {
      console.error('Google sign in error:', error);
    }
  };

  const signInWithKakao = async () => {
    // Kakao will be added later
    console.log('Kakao login not yet configured');
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signInWithGoogle,
        signInWithKakao,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
