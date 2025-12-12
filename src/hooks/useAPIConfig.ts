import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface APIConfig {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  model?: string;
}

export const useAPIConfig = () => {
  const { user } = useAuth();
  const [apiConfig, setApiConfig] = useState<APIConfig>({});
  const [loading, setLoading] = useState(true);

  const fetchAPIConfig = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching API config:', error);
        setApiConfig({});
        return;
      }

      if (data && data.length > 0) {
        const customKey = data.find(k => k.provider === 'custom');
        const deepseekKey = data.find(k => k.provider === 'deepseek');
        const openaiKey = data.find(k => k.provider === 'openai');
        const baseUrl = data.find(k => k.provider === 'custom_base_url');
        const model = data.find(k => k.provider === 'custom_model');

        if (customKey) {
          setApiConfig({
            provider: 'custom',
            apiKey: customKey.api_key,
            baseUrl: baseUrl?.api_key,
            model: model?.api_key,
          });
        } else if (deepseekKey) {
          setApiConfig({
            provider: 'deepseek',
            apiKey: deepseekKey.api_key,
          });
        } else if (openaiKey) {
          setApiConfig({
            provider: 'openai',
            apiKey: openaiKey.api_key,
          });
        } else {
          setApiConfig({});
        }
      } else {
        setApiConfig({});
      }
    } catch (error) {
      console.error('Error fetching API config:', error);
      setApiConfig({});
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAPIConfig();
  }, [fetchAPIConfig]);

  const isConfigured = Boolean(apiConfig.apiKey && apiConfig.provider);

  return { apiConfig, loading, isConfigured, refetch: fetchAPIConfig };
};
