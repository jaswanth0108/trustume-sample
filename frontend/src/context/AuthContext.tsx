import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Recruiter } from '../types';

interface AuthContextType {
  recruiter: Recruiter | null;
  token: string | null;
  login: (recruiter: Recruiter, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [recruiter, setRecruiter] = useState<Recruiter | null>(() => {
    try {
      const r = localStorage.getItem('trustume_recruiter');
      return r ? JSON.parse(r) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('trustume_token')
  );

  const login = (rec: Recruiter, tok: string) => {
    setRecruiter(rec);
    setToken(tok);
    localStorage.setItem('trustume_recruiter', JSON.stringify(rec));
    localStorage.setItem('trustume_token', tok);
  };

  const logout = () => {
    setRecruiter(null);
    setToken(null);
    localStorage.removeItem('trustume_recruiter');
    localStorage.removeItem('trustume_token');
  };

  return (
    <AuthContext.Provider value={{ recruiter, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
