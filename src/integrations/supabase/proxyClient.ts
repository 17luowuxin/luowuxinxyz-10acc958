// Supabase client with proxy support for China users
// This client routes requests through your custom domain to bypass GFW restrictions
import { supabase } from './client';

// Detect if we're on the custom domain (luowuxin.xyz) or development
const isCustomDomain = typeof window !== 'undefined' && 
  (window.location.hostname === 'luowuxin.xyz' || 
   window.location.hostname === 'www.luowuxin.xyz');

// client.ts already chooses the proxy URL. Reuse its Auth session and refresh lock.
export const supabaseProxy = supabase;

// Export a helper to check if proxy is being used
export const isUsingProxy = () => isCustomDomain;
