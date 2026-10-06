import { useEffect } from 'react';
import { router } from 'expo-router';
import { useLinkingURL } from 'expo-linking';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, Loading } from '@/components/ui';
import { common } from '@/constants/theme';
import { useShop } from '@/providers/shop-provider';

export default function AuthCallbackScreen() {
  const url = useLinkingURL();
  const { finishGoogleSignIn } = useShop();
  useEffect(() => {
    let mounted = true;
    if (url) void finishGoogleSignIn(url).then(() => {
      if (mounted) router.replace('/account');
    });
    return () => { mounted = false; };
  }, [url, finishGoogleSignIn]);
  return <SafeAreaView style={common.screen}><View style={common.content}>
    {url ? <Loading label="Completing your Google sign-in…" />
      : <EmptyState title="Open your account" detail="Start Google sign-in from your FolioVale account to continue." />}
    <Button title="Back to Account" secondary onPress={() => router.replace('/account')} />
  </View></SafeAreaView>;
}
