/**
 * 外部 Supabase 客户端 - 用于新用户注册
 * 
 * 这个客户端连接到外部的 Supabase 项目，用于处理新用户的注册和登录
 * 现有用户继续使用 Lovable Cloud (src/integrations/supabase/client.ts)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// 外部 Supabase 项目配置
const EXTERNAL_SUPABASE_URL = 'https://lxbusdoqghkcajlctbqg.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4YnVzZG9xZ2hrY2FqbGN0YnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NzgyNDUsImV4cCI6MjA4NTA1NDI0NX0.OwB402cKHTxnaVdv7KgpCQ1VYaHt7qXoq6C3hngzM00';

// 检测是否在自定义域名下，使用代理
const isCustomDomain = typeof window !== 'undefined' && 
  (window.location.hostname === 'luowuxin.xyz' || 
   window.location.hostname === 'www.luowuxin.xyz');

// 外部 Supabase 使用代理路径（如果在自定义域名下）
const EXTERNAL_URL = isCustomDomain 
  ? `${window.location.origin}/external-supabase`
  : EXTERNAL_SUPABASE_URL;

const externalClientOptions = {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'external-supabase-auth', // 使用不同的存储键避免冲突
  }
};

const proxiedExternalSupabase = createClient<Database>(EXTERNAL_URL, EXTERNAL_SUPABASE_ANON_KEY, externalClientOptions);
const directExternalSupabase = createClient<Database>(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, externalClientOptions);

let activeExternalClient: SupabaseClient<Database> = proxiedExternalSupabase;

export const switchExternalSupabaseToDirect = () => {
  activeExternalClient = directExternalSupabase;
};

export const isExternalSupabaseProxyEnabled = () => isCustomDomain;

// 创建外部 Supabase 客户端（支持在自定义域名代理失败时切换为直连）
export const externalSupabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop: string | symbol) {
    const value = (activeExternalClient as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeExternalClient);
    }
    return value;
  }
});

// 导出配置信息供其他模块使用
export const externalSupabaseConfig = {
  url: EXTERNAL_SUPABASE_URL,
  activeUrl: EXTERNAL_URL,
  anonKey: EXTERNAL_SUPABASE_ANON_KEY,
  projectId: 'lxbusdoqghkcajlctbqg',
};
