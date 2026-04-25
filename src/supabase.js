import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sheets-manager-auth',
  },
});

// provider_token をキャッシュ（Google access token は1時間有効）
export function cacheProviderToken(token) {
  if (!token) return;
  localStorage.setItem('sm_provider_token', token);
  localStorage.setItem('sm_provider_token_exp', String(Date.now() + 55 * 60 * 1000));
}

export function getCachedProviderToken() {
  const token = localStorage.getItem('sm_provider_token');
  const exp = parseInt(localStorage.getItem('sm_provider_token_exp') || '0');
  if (token && Date.now() < exp) return token;
  return null;
}
