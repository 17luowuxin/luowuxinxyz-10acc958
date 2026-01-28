/**
 * 获取 Supabase URL，支持自定义域名代理
 * 
 * 在自定义域名 (luowuxin.xyz) 下，使用 Vercel 代理绕过 GFW
 * 在其他域名下，直接使用环境变量中的 Supabase URL
 */
export const getSupabaseUrl = (): string => {
  const isCustomDomain = typeof window !== 'undefined' && 
    (window.location.hostname === 'luowuxin.xyz' || 
     window.location.hostname === 'www.luowuxin.xyz');

  return isCustomDomain 
    ? `${window.location.origin}/supabase`
    : import.meta.env.VITE_SUPABASE_URL;
};

/**
 * 检查当前是否使用代理
 */
export const isUsingProxy = (): boolean => {
  return typeof window !== 'undefined' && 
    (window.location.hostname === 'luowuxin.xyz' || 
     window.location.hostname === 'www.luowuxin.xyz');
};
