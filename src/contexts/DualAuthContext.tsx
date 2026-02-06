import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase } from '@/integrations/supabase/externalClient';

type AuthSource = 'lovable-cloud' | 'external' | null;

interface DualAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authSource: AuthSource;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getActiveClient: () => typeof supabase;
}

const DualAuthContext = createContext<DualAuthContextType | undefined>(undefined);

export const DualAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authSource, setAuthSource] = useState<AuthSource>(null);

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
          // 只有当当前来源是 cloud 时才清除
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
          // 只有当当前来源是 external 时才清除
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

      // 优先使用 Cloud 会话（现有用户）
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

    // 如果 Cloud 登录失败（用户不存在），尝试外部 Supabase
    const externalResult = await externalSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!externalResult.error) {
      setAuthSource('external');
      return { error: null };
    }

    // 两边都失败，返回更友好的错误
    // 如果两边都是 "Invalid login credentials"，说明用户不存在或密码错误
    return { error: cloudResult.error as Error };
  };

  // 登出 - 根据来源登出对应客户端
  const signOut = async () => {
    if (authSource === 'lovable-cloud') {
      await supabase.auth.signOut();
    } else if (authSource === 'external') {
      await externalSupabase.auth.signOut();
    } else {
      // 两边都登出以确保清理干净
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
    <DualAuthContext.Provider value={{ 
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
    </DualAuthContext.Provider>
  );
};

export const useDualAuth = () => {
  const context = useContext(DualAuthContext);
  if (context === undefined) {
    throw new Error('useDualAuth must be used within a DualAuthProvider');
  }
  return context;
};
