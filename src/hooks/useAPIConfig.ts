import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (user) {
      fetchAPIConfig();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchAPIConfig = async () => {
    try {
      const { data } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user?.id);

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
        }
      }
    } catch (error) {
      console.error('Error fetching API config:', error);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = Boolean(apiConfig.apiKey && apiConfig.provider);

  return { apiConfig, loading, isConfigured, refetch: fetchAPIConfig };
};
