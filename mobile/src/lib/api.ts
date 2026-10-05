import { createApiClient } from './api-client';
import { config } from './config';
import { supabase } from './supabase';

export const api = createApiClient({
  baseUrl: config.apiBaseUrl,
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
});
