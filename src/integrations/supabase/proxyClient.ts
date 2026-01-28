// Supabase client with proxy support for China users
// This client routes requests through your custom domain to bypass GFW restrictions
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Detect if we're on the custom domain (luowuxin.xyz) or development
const isCustomDomain = typeof window !== 'undefined' && 
  (window.location.hostname === 'luowuxin.xyz' || 
   window.location.hostname === 'www.luowuxin.xyz');

// Use proxy URL on custom domain, direct URL otherwise
const SUPABASE_URL = isCustomDomain 
  ? `${window.location.origin}/supabase`
  : import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Create the Supabase client with proxy support
export const supabaseProxy = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export a helper to check if proxy is being used
export const isUsingProxy = () => isCustomDomain;
