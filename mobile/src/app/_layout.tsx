import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/constants/theme';
import { ShopProvider } from '@/providers/shop-provider';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.paper, card: colors.paper, text: colors.ink, primary: colors.ink, border: colors.line } };

export default function RootLayout() {
  return <ThemeProvider value={theme}><ShopProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack>
  </ShopProvider></ThemeProvider>;
}
