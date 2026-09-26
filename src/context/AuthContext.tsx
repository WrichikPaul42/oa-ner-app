import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { authenticateWorker, resetAuth, touchSession, isSessionActive } from '@/services/authService';

// ─── Types ───────────────────────────────────────────────────────────

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (pin: string) => { success: boolean; attemptsRemaining: number; lockoutSeconds: number };
  logout: () => void;
  checkSession: () => boolean;
}

// ─── Context ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = useCallback((pin: string) => {
    const result = authenticateWorker(pin);
    if (result.success) {
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    resetAuth();
  }, []);

  const checkSession = useCallback(() => {
    const active = isSessionActive();
    if (!active) {
      setIsAuthenticated(false);
    } else {
      touchSession();
    }
    return active;
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
