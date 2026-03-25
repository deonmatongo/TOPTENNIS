import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// SecureStore adapter — persists the auth session across app restarts.
// SecureStore has a 2048-byte limit per key, so large tokens are chunked
// across multiple keys to avoid silent storage failures.
const CHUNK_SIZE = 1900;

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const first = await SecureStore.getItemAsync(key);
    if (first === null) return null;
    // Not chunked — return as-is
    if (!first.startsWith('__CHUNKED__')) return first;
    const count = parseInt(first.replace('__CHUNKED__', ''), 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(key, `__CHUNKED__${chunks.length}`);
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk)));
  },
  removeItem: async (key: string): Promise<void> => {
    const first = await SecureStore.getItemAsync(key);
    if (first?.startsWith('__CHUNKED__')) {
      const count = parseInt(first.replace('__CHUNKED__', ''), 10);
      await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}_chunk_${i}`))
      );
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
