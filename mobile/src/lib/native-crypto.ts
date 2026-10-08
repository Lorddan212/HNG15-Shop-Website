import { Platform } from 'react-native';
import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

// Supabase's PKCE implementation uses these WebCrypto primitives. Hermes does
// not always supply them. Back the missing primitives with Expo's native crypto
// so Supabase never falls back to Math.random or a plain code challenge.
if (Platform.OS !== 'web') {
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  if (!globalThis.crypto.getRandomValues) Object.defineProperty(globalThis.crypto, 'getRandomValues', { value: getRandomValues });
  if (!globalThis.crypto.subtle) {
    Object.defineProperty(globalThis.crypto, 'subtle', { value: {
      digest: (algorithm: string | { name: string }, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') return Promise.reject(new Error('Unsupported digest algorithm.'));
        return digest(CryptoDigestAlgorithm.SHA256, data);
      },
    } });
  }
}
