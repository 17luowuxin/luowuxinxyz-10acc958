/**
 * 外部 Supabase 客户端 - 用于新用户注册
 * 
 * 这个客户端连接到外部的 Supabase 项目，用于处理新用户的注册和登录
 * 现有用户继续使用 Lovable Cloud (src/integrations/supabase/client.ts)
 */
import { createClient } from '@supabase/supabase-js';
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

// 创建外部 Supabase 客户端
export const externalSupabase = createClient<Database>(EXTERNAL_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'external-supabase-auth', // 使用不同的存储键避免冲突
  }
});

// 导出配置信息供其他模块使用
export const externalSupabaseConfig = {
  url: EXTERNAL_SUPABASE_URL,
  anonKey: EXTERNAL_SUPABASE_ANON_KEY,
  projectId: 'lxbusdoqghkcajlctbqg',
};
