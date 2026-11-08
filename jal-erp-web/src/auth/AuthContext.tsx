import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Permission, User } from '../types';
import { DEMO_USERS, ROLE_PERMISSIONS, toPublicUser } from '../data/users';
import { readJson, removeKey, writeJson } from '../lib/storage';

const SESSION_KEY = 'jal.session';
const LOCK_KEY = 'jal.loginLock';
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
/** NFR-SEC-002: idle session timeout. */
export const IDLE_TIMEOUT_MIN = 30;

type LockMap = Record<string, { attempts: number; until?: number }>;

export type LoginResult =
  | { status: 'ok' }
  | { status: 'mfa' }
  | { status: 'error'; remaining: number }
  | { status: 'locked'; until: number };

interface AuthValue {
  user: User | null;
  mfaPendingFor: User | null;
  signOutReason: 'idle' | null;
  login: (username: string, password: string, remember: boolean) => LoginResult;
  verifyOtp: (code: string) => boolean;
  cancelMfa: () => void;
  logout: () => void;
  can: (p: Permission) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

function restoreSession(): User | null {
  const s = readJson<{ userId: string }>('session', SESSION_KEY) ?? readJson<{ userId: string }>('local', SESSION_KEY);
  const u = s && DEMO_USERS.find((d) => d.id === s.userId);
  return u ? toPublicUser(u) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreSession);
  const [pending, setPending] = useState<{ user: User; remember: boolean } | null>(null);
  const [signOutReason, setSignOutReason] = useState<'idle' | null>(null);
  const lastActivity = useRef(Date.now());

  const startSession = useCallback((u: User, remember: boolean) => {
    writeJson(remember ? 'local' : 'session', SESSION_KEY, { userId: u.id, at: Date.now() });
    lastActivity.current = Date.now();
    setSignOutReason(null);
    setPending(null);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    removeKey('session', SESSION_KEY);
    removeKey('local', SESSION_KEY);
    setPending(null);
    setUser(null);
  }, []);

  const login = useCallback(
    (username: string, password: string, remember: boolean): LoginResult => {
      const key = username.trim().toLowerCase();
      const locks = readJson<LockMap>('local', LOCK_KEY) ?? {};
      const lock = locks[key];
      if (lock?.until && lock.until > Date.now()) return { status: 'locked', until: lock.until };

      const found = DEMO_USERS.find((u) => u.username.toLowerCase() === key);
      if (!found || found.password !== password) {
        const attempts = (lock?.until && lock.until <= Date.now() ? 0 : lock?.attempts ?? 0) + 1;
        const until = attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60000 : undefined;
        writeJson('local', LOCK_KEY, { ...locks, [key]: { attempts, until } });
        if (until) return { status: 'locked', until };
        return { status: 'error', remaining: MAX_ATTEMPTS - attempts };
      }

      delete locks[key];
      writeJson('local', LOCK_KEY, locks);
      const pub = toPublicUser(found);
      if (found.mfa) {
        setPending({ user: pub, remember });
        return { status: 'mfa' };
      }
      startSession(pub, remember);
      return { status: 'ok' };
    },
    [startSession],
  );

  const verifyOtp = useCallback(
    (code: string) => {
      if (!pending) return false;
      const demo = DEMO_USERS.find((u) => u.id === pending.user.id);
      if (!demo?.otp || demo.otp !== code.trim()) return false;
      startSession(pending.user, pending.remember);
      return true;
    },
    [pending, startSession],
  );

  // Idle timeout.
  useEffect(() => {
    if (!user) return;
    const touch = () => (lastActivity.current = Date.now());
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MIN * 60000) {
        setSignOutReason('idle');
        logout();
      }
    }, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [user, logout]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      mfaPendingFor: pending?.user ?? null,
      signOutReason,
      login,
      verifyOtp,
      cancelMfa: () => setPending(null),
      logout,
      can: (p) => !!user && ROLE_PERMISSIONS[user.role].includes(p),
    }),
    [user, pending, signOutReason, login, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
