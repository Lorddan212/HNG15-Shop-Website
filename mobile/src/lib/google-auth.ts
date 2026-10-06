import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { config } from './config';
import { supabase } from './supabase';
import { createGoogleAuthFlow, GoogleAuthError, MOBILE_CALLBACK } from './google-auth-flow';

function requireNativeBuild() {
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new GoogleAuthError('Open the FolioVale Android development build to sign in. Google sign-in is not available in Expo Go or this web preview.');
  }
}

const flow = createGoogleAuthFlow({
  supabaseUrl: config.supabaseUrl,
  storage: AsyncStorage,
  authorize: async () => {
    requireNativeBuild();
    const redirectTo = makeRedirectUri({ scheme: 'foliovale', path: 'auth/callback', native: MOBILE_CALLBACK });
    if (redirectTo !== MOBILE_CALLBACK) throw new GoogleAuthError('This build does not have the FolioVale sign-in callback. Rebuild the development app.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, scopes: 'email profile', queryParams: { prompt: 'select_account' } },
    });
    if (error || !data.url || !data.flowId) throw new GoogleAuthError('Google sign-in is unavailable. Check your connection and try again.');
    return { url: data.url, flowId: data.flowId };
  },
  exchange: async (code, flowId) => {
    requireNativeBuild();
    // The installed SDK validates the server response, persists the session,
    // removes the matching verifier and emits SIGNED_IN. URL user fields are ignored.
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, { flowId });
    if (error || !data.session || !data.user) throw new Error('Code exchange failed.');
  },
  openBrowser: (url, redirect) => WebBrowser.openAuthSessionAsync(url, redirect),
});

export const signInWithGoogle = () => flow.signIn();
export const completeGoogleSignIn = (url: string) => flow.complete(url);
export const authErrorMessage = (error: unknown) => error instanceof GoogleAuthError
  ? error.message : 'Unable to complete sign-in. Please try again.';
