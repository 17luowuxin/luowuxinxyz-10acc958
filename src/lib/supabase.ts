/**
 * 动态 Supabase 客户端代理
 * 
 * 根据用户认证来源（Lovable Cloud vs 外部 Supabase）自动路由数据操作到正确的实例。
 * - 数据操作（from, storage, channel 等）→ 根据认证来源路由
 * - Edge Functions（functions）→ 始终使用 Lovable Cloud（因为 Edge Functions 仅部署在 Cloud）
 * - Auth（auth）→ 根据认证来源路由
 */
import { supabase as cloudClient } from '@/integrations/supabase/client';
import { externalSupabase } from '@/integrations/supabase/externalClient';

type AuthSource = 'lovable-cloud' | 'external' | null;

let _authSource: AuthSource = null;

/**
 * 由 AuthContext 调用，同步当前认证来源
 */
export const setActiveAuthSource = (source: AuthSource) => {
  _authSource = source;
};

/**
 * 获取当前活动的 Supabase 客户端（用于数据操作）
 * 
 * 根据认证来源路由：
 * - external 用户 → 仍然使用 external（因为 RLS 依赖 auth.uid()）
 * - cloud 用户 → 使用 cloud
 */
const getActiveClient = () => {
  return _authSource === 'external' ? externalSupabase : cloudClient;
};

/**
 * 动态代理 - 自动路由到正确的 Supabase 实例
 * 
 * - supabase.from(...) → 路由到活动客户端
 * - supabase.storage → 路由到活动客户端
 * - supabase.functions → 始终路由到 Lovable Cloud
 * - supabase.channel(...) → 路由到活动客户端
 */
export const supabase = new Proxy({} as typeof cloudClient, {
  get(_target, prop: string | symbol) {
    // Edge Functions 始终使用 Lovable Cloud
    if (prop === 'functions') {
      return cloudClient.functions;
    }
    
    const client = getActiveClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

/**
 * Lovable Cloud 客户端 - 直接引用，用于需要显式指定 Cloud 的场景
 */
export const cloudSupabase = cloudClient;
