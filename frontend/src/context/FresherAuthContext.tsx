import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'trustume_fresher_token';

interface Candidate {
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
}

interface FresherAuthContextType {
  candidate: Candidate | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; phone?: string; location?: string }) => Promise<void>;
  logout: () => void;
}

const FresherAuthContext = createContext<FresherAuthContextType | null>(null);

export function FresherAuthProvider({ children }: { children: ReactNode }) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      axios.get(`${BASE}/fresher/profile`, {
        headers: { Authorization: `Bearer ${stored}` },
      }).then(res => setCandidate(res.data.candidate))
        .catch(() => localStorage.removeItem(TOKEN_KEY))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${BASE}/fresher/login`, { email, password });
    const { candidate: c, token: t } = res.data;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setCandidate(c);
  };

  const register = async (data: { full_name: string; email: string; password: string; phone?: string; location?: string }) => {
    const res = await axios.post(`${BASE}/fresher/register`, data);
    const { candidate: c, token: t } = res.data;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setCandidate(c);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCandidate(null);
  };

  return (
    <FresherAuthContext.Provider value={{ candidate, token, isLoading, login, register, logout }}>
      {children}
    </FresherAuthContext.Provider>
  );
}

export function useFresherAuth() {
  const ctx = useContext(FresherAuthContext);
  if (!ctx) throw new Error('useFresherAuth must be inside FresherAuthProvider');
  return ctx;
}
