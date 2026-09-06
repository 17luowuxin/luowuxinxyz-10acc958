import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase, isExternalSupabaseProxyEnabled, switchExternalSupabaseToDirect } from '@/integrations/supabase/externalClient';
import { setActiveAuthSource } from '@/lib/supabase';

type AuthSource = 'lovable-cloud' | 'external' | null;
const AUTH_TIMEOUT_MS = 12000;

const withAuthTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('登录服务连接超时，请检查网络后重试')), AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authSource: AuthSource;
  authError: string | null;
  retryAuth: () => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getActiveClient: () => typeof supabase;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authSource, setAuthSource] = useState<AuthSource>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authAttempt, setAuthAttempt] = useState(0);
  const authSourceRef = useRef<AuthSource>(null);

  // 同步认证来源到全局代理 + ref
  const updateAuthSource = (source: AuthSource) => {
    console.log('[Auth] Setting authSource:', source);
    authSourceRef.current = source;
    setAuthSource(source);
    setActiveAuthSource(source);
  };

  useEffect(() => {
    let cancelled = false;
    let initializing = true;
    setLoading(true);
    setAuthError(null);
    // 监听两个客户端的认证状态变化
    const { data: { subscription: cloudSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled || initializing || event === 'INITIAL_SESSION') return;
        console.log('[Auth] Cloud onAuthStateChange:', event, 'session:', !!session, 'current source:', authSourceRef.current);
        if (session) {
          // 只在没有外部认证时才设置为 cloud
          // 防止 Cloud 的 INITIAL_SESSION 覆盖已有的 external 认证
          if (authSourceRef.current !== 'external') {
            setSession(session);
            setUser(session.user);
            updateAuthSource('lovable-cloud');
            setAuthError(null);
            setLoading(false);
          }
        } else if (authSourceRef.current === 'lovable-cloud') {
          setSession(null);
          setUser(null);
          updateAuthSource(null);
        }
      }
    );

    const { data: { subscription: externalSub } } = externalSupabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled || initializing || event === 'INITIAL_SESSION') return;
        console.log('[Auth] External onAuthStateChange:', event, 'session:', !!session, 'current source:', authSourceRef.current);
        if (session) {
          // 外部认证始终优先（因为新用户都在外部）
          setSession(session);
          setUser(session.user);
          updateAuthSource('external');
          setAuthError(null);
          setLoading(false);
        } else if (authSourceRef.current === 'external') {
          setSession(null);
          setUser(null);
          updateAuthSource(null);
        }
      }
    );

    // 检查两个客户端的现有会话
    const checkSessions = async () => {
      try {
        const results = await Promise.allSettled([
          withAuthTimeout(supabase.auth.getSession()),
          withAuthTimeout(externalSupabase.auth.getSession()),
        ]);
        if (cancelled) return;
        const [cloudResult, externalResult] = results;
        const cloudSession = cloudResult.status === 'fulfilled' && !cloudResult.value.error
          ? cloudResult.value.data.session : null;
        const externalSession = externalResult.status === 'fulfilled' && !externalResult.value.error
          ? externalResult.value.data.session : null;
        const nextSession = externalSession ?? cloudSession;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        updateAuthSource(externalSession ? 'external' : cloudSession ? 'lovable-cloud' : null);
        if (!nextSession && results.some((result) => result.status === 'rejected' || result.value.error)) {
          setAuthError('暂时无法确认登录状态，请检查网络后重试。');
        }
      } catch {
        if (!cancelled) setAuthError('登录状态读取失败，请重试。');
      } finally {
        initializing = false;
        if (!cancelled) setLoading(false);
      }
    };

    void checkSessions();

    return () => {
      cancelled = true;
      cloudSub.unsubscribe();
      externalSub.unsubscribe();
    };
  }, [authAttempt]);

  // 新用户注册 - 使用外部 Supabase
  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const payload = {
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    };

    const runSignup = async () => {
      try {
        return await withAuthTimeout(externalSupabase.auth.signUp(payload));
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    };

    const firstResult = await runSignup();
    if (!firstResult.error) {
      return { error: null };
    }

    const message = firstResult.error.message || '';
    const looksLikeProxyFailure = isExternalSupabaseProxyEnabled() && (
      message.includes('Load failed') ||
      message.includes('Failed to fetch') ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('Unexpected token') ||
      message.includes('JSON') ||
      message.includes('timed out') ||
      message.includes('超时')
    );

    if (looksLikeProxyFailure) {
      console.warn('[Auth] External signup proxy failed, retrying direct connection');
      switchExternalSupabaseToDirect();
      const retryResult = await runSignup();
      return { error: retryResult.error as Error | null };
    }

    return { error: firstResult.error as Error };
  };

  // 登录 - 先尝试 Cloud，失败后尝试外部
  const signIn = async (email: string, password: string) => {
    console.log('[Auth] Attempting sign in');
    
    // 首先尝试 Lovable Cloud（现有用户）
    const cloudResult = await withAuthTimeout(supabase.auth.signInWithPassword({
      email,
      password,
    })).catch((error: Error) => ({ error }));

    if (!cloudResult.error) {
      updateAuthSource('lovable-cloud');
      console.log('[Auth] Signed in via CLOUD');
      return { error: null };
    }

    console.log('[Auth] Cloud login failed, trying external...');
    
    // 如果 Cloud 登录失败，尝试外部 Supabase（新用户）
    const externalResult = await withAuthTimeout(externalSupabase.auth.signInWithPassword({
      email,
      password,
    })).catch((error: Error) => ({ error }));

    if (!externalResult.error) {
      updateAuthSource('external');
      console.log('[Auth] Signed in via EXTERNAL');
      return { error: null };
    }

    // 两边都失败，返回错误
    return { error: cloudResult.error as Error };
  };

  // 登出
  const signOut = async () => {
    console.log('[Auth] Signing out, current source:', authSourceRef.current);
    if (authSourceRef.current === 'lovable-cloud') {
      await supabase.auth.signOut();
    } else if (authSourceRef.current === 'external') {
      await externalSupabase.auth.signOut();
    } else {
      await Promise.all([
        supabase.auth.signOut(),
        externalSupabase.auth.signOut()
      ]);
    }
    setUser(null);
    setSession(null);
    updateAuthSource(null);
  };

  // 获取当前活动的 Supabase 客户端
  const getActiveClient = () => {
    return authSourceRef.current === 'external' ? externalSupabase : supabase;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      authSource,
      authError,
      retryAuth: () => setAuthAttempt((attempt) => attempt + 1),
      signUp, 
      signIn, 
      signOut,
      getActiveClient 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
