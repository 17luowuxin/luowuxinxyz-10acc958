import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { setActiveAuthSource } from '@/lib/supabase';

type AuthSource = 'lovable-cloud' | 'external' | null;

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

  // 同步认证来源到全局代理
  useEffect(() => {
    setActiveAuthSource(authSource);
  }, [authSource]);
  useEffect(() => {
    // 监听两个客户端的认证状态变化
    const { data: { subscription: cloudSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setSession(session);
          setUser(session.user);
          setAuthSource('lovable-cloud');
          setLoading(false);
        } else if (authSource === 'lovable-cloud') {
          setSession(null);
          setUser(null);
          setAuthSource(null);
        }
      }
    );

    const { data: { subscription: externalSub } } = externalSupabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setSession(session);
          setUser(session.user);
          setAuthSource('external');
          setLoading(false);
        } else if (authSource === 'external') {
          setSession(null);
          setUser(null);
          setAuthSource(null);
        }
      }
    );

    // 检查两个客户端的现有会话
    const checkSessions = async () => {
      const [cloudResult, externalResult] = await Promise.all([
        supabase.auth.getSession(),
        externalSupabase.auth.getSession()
      ]);

      if (cloudResult.data.session) {
        setSession(cloudResult.data.session);
        setUser(cloudResult.data.session.user);
        setAuthSource('lovable-cloud');
      } else if (externalResult.data.session) {
        setSession(externalResult.data.session);
        setUser(externalResult.data.session.user);
        setAuthSource('external');
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
    const { error } = await externalSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error: error as Error | null };
  };

  // 登录 - 先尝试 Cloud，失败后尝试外部
  const signIn = async (email: string, password: string) => {
    // 首先尝试 Lovable Cloud（现有用户）
    const cloudResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!cloudResult.error) {
      setAuthSource('lovable-cloud');
      return { error: null };
    }

    // 如果 Cloud 登录失败，尝试外部 Supabase（新用户）
    const externalResult = await externalSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!externalResult.error) {
      setAuthSource('external');
      return { error: null };
    }

    // 两边都失败，返回错误
    return { error: cloudResult.error as Error };
  };

  // 登出
  const signOut = async () => {
    if (authSource === 'lovable-cloud') {
      await supabase.auth.signOut();
    } else if (authSource === 'external') {
      await externalSupabase.auth.signOut();
    } else {
      await Promise.all([
        supabase.auth.signOut(),
        externalSupabase.auth.signOut()
      ]);
    }
    setUser(null);
    setSession(null);
    setAuthSource(null);
  };

  // 获取当前活动的 Supabase 客户端
  const getActiveClient = () => {
    return authSource === 'external' ? externalSupabase : supabase;
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
