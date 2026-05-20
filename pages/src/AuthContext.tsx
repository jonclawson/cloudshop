import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface User {
  id: string;
  email: string;
  admin: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type StoredUser = { id: string };

function safeParseStoredUser(value: string | null): StoredUser | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredUser>;
    if (typeof parsed?.id !== 'string' || !parsed.id) return null;
    return { id: parsed.id };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const storedUser = safeParseStoredUser(localStorage.getItem('user'));
      if (!storedUser?.id) {
        // If we have a token but no stored id, attempt to fetch anyway.
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setUser(null);
          return;
        }

        const data = (await response.json()) as { user?: User };
        if (data.user) {
          setUser(data.user);
          // Ensure localStorage only stores id (no email)
          localStorage.setItem('user', JSON.stringify({ id: data.user.id }));
        }
      } catch {
        // Non-fatal; next API call will trigger refresh/login redirect behavior.
      }
    };

    void bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = (await response.json()) as { user: User };
    localStorage.setItem('access_token', (data as any).access_token);
    localStorage.setItem('refresh_token', (data as any).refresh_token);

    setUser(data.user);
    // Store only user id (no email/personal info)
    localStorage.setItem('user', JSON.stringify({ id: data.user.id }));
  };

  const signup = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Signup failed');
    }

    const data = (await response.json()) as { user: User; access_token?: string; refresh_token?: string };

    if (data.access_token) localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);

    setUser(data.user);
    localStorage.setItem('user', JSON.stringify({ id: data.user.id }));
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
