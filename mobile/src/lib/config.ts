// Keep direct property access: Expo substitutes these public values at bundle time.
const values = {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

function required(name: keyof typeof values): string {
  const value = values[name]?.trim();
  if (!value) throw new Error(`FolioVale configuration: set ${name} in mobile/.env and restart Expo.`);
  return value;
}

function httpUrl(name: 'EXPO_PUBLIC_API_BASE_URL' | 'EXPO_PUBLIC_SUPABASE_URL'): string {
  const value = required(name);
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    throw new Error(`FolioVale configuration: ${name} must be an HTTP(S) URL without credentials, query or fragment.`);
  }
  return value.replace(/\/+$/, '');
}

export const config = {
  apiBaseUrl: httpUrl('EXPO_PUBLIC_API_BASE_URL'),
  supabaseUrl: httpUrl('EXPO_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
};
