import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase, isExternalSupabaseProxyEnabled, switchExternalSupabaseToDirect } from '@/integrations/supabase/externalClient';
import { setActiveAuthSource } from '@/lib/supabase';

type AuthSource = 'lovable-cloud' | 'external' | null;
const SIGNUP_TIMEOUT_MS = 12000;

const withSignupTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof window.setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Load failed: signup request timed out')), SIGNUP_TIMEOUT_MS);
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
  const authSourceRef = useRef<AuthSource>(null);

  // 同步认证来源到全局代理 + ref
  const updateAuthSource = (source: AuthSource) => {
    console.log('[Auth] Setting authSource:', source);
    authSourceRef.current = source;
    setAuthSource(source);
    setActiveAuthSource(source);
  };

  useEffect(() => {
    // 监听两个客户端的认证状态变化
    const { data: { subscription: cloudSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] Cloud onAuthStateChange:', event, 'session:', !!session, 'current source:', authSourceRef.current);
        if (session) {
          // 只在没有外部认证时才设置为 cloud
          // 防止 Cloud 的 INITIAL_SESSION 覆盖已有的 external 认证
          if (authSourceRef.current !== 'external') {
            setSession(session);
            setUser(session.user);
            updateAuthSource('lovable-cloud');
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
        console.log('[Auth] External onAuthStateChange:', event, 'session:', !!session, 'current source:', authSourceRef.current);
        if (session) {
          // 外部认证始终优先（因为新用户都在外部）
          setSession(session);
          setUser(session.user);
          updateAuthSource('external');
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
      console.log('[Auth] Checking existing sessions...');
      const [cloudResult, externalResult] = await Promise.all([
        supabase.auth.getSession(),
        externalSupabase.auth.getSession()
      ]);

      const hasCloud = !!cloudResult.data.session;
      const hasExternal = !!externalResult.data.session;
      console.log('[Auth] Session check - Cloud:', hasCloud, 'External:', hasExternal);

      // 优先外部认证（新用户注册在外部）
      if (hasExternal) {
        setSession(externalResult.data.session);
        setUser(externalResult.data.session!.user);
        updateAuthSource('external');
        console.log('[Auth] Using EXTERNAL session');
      } else if (hasCloud) {
        setSession(cloudResult.data.session);
        setUser(cloudResult.data.session!.user);
        updateAuthSource('lovable-cloud');
        console.log('[Auth] Using CLOUD session');
      }
      
      setLoading(false);
    };

    checkSessions();

    return () => {
      cloudSub.unsubscribe();
      externalSub.unsubscribe();
    };
  }, []);

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
        return await withSignupTimeout(externalSupabase.auth.signUp(payload));
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
      message.includes('timed out')
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
    const cloudResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!cloudResult.error) {
      updateAuthSource('lovable-cloud');
      console.log('[Auth] Signed in via CLOUD');
      return { error: null };
    }

    console.log('[Auth] Cloud login failed, trying external...');
    
    // 如果 Cloud 登录失败，尝试外部 Supabase（新用户）
    const externalResult = await externalSupabase.auth.signInWithPassword({
      email,
      password,
    });

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
