import { router } from 'expo-router';
import { accountContent } from '@/lib/account-content';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNotice, Header, Loading } from '@/components/ui';
import { colors, common, serif } from '@/constants/theme';
import { useShop } from '@/providers/shop-provider';

export default function AccountScreen() {
  const shop = useShop();
  const content = accountContent(shop.hasSession, shop.hasGuestItems);
  return <SafeAreaView edges={['top', 'left', 'right']} style={common.screen}>
    <ScrollView contentContainerStyle={common.content}
      refreshControl={<RefreshControl refreshing={shop.refreshing} onRefresh={() => void shop.refresh()} tintColor={colors.ink} colors={[colors.ink]} />}>
      <Header section="A space of your own" />
      <Text accessibilityRole="header" style={common.title}>Your FolioVale</Text>
      <ErrorNotice message={shop.authError} />
      <ErrorNotice message={shop.accountError} retry={() => void shop.refresh()} busy={shop.refreshing || shop.signingOut} />
      {shop.accountLoading && !shop.user ? <Loading label="Checking your account…" /> : shop.hasSession
        ? <View style={common.panel}>
            {shop.user ? <><View style={styles.avatar}><Text style={styles.initial}>{(shop.user.name || shop.user.email).slice(0, 1).toUpperCase()}</Text></View>
              <Text style={common.eyebrow}>Welcome back</Text>
              <Text style={common.heading}>{shop.user.name || 'Your account'}</Text><Text selectable style={common.body}>{shop.user.email}</Text>
              <Text style={common.body}>Your cart is saved to your account and shared with the FolioVale website.</Text>
              {content.showOrders && <Button title="My orders" onPress={() => router.push('/orders')} />}
              <Button title="View your cart" onPress={() => router.navigate('/cart')} />
            </> : <Text style={common.body}>We could not load your account details. Refresh this page, or sign out and try again.</Text>}
            <Button title="Sign out" secondary busy={shop.signingOut} disabled={Boolean(shop.pendingProduct) || shop.signingIn || shop.accountLoading || shop.checkingOut} onPress={() => void shop.signOut()} />
          </View>
        : <>
            <View style={styles.introduction}><Text style={styles.folio}>F</Text>
              <Text style={styles.introTitle}>Good things begin{ '\n' }with a little space.</Text>
              <Text style={common.body}>Save your cart and keep your notebooks, planners, and sets together across devices.</Text>
            </View>
            <View style={common.panel}><Text style={common.heading}>{content.heading}</Text>
              <Text style={common.body}>{content.body}</Text>
              <Button title={shop.signingIn ? "Connecting to Google…" : "Continue with Google"} busy={shop.signingIn}
                onPress={() => void shop.googleSignIn()} />
              <Text style={styles.phaseNote}>New here? Continue with Google to get started. Already shop with us? Choose the same Google account to see your saved cart and orders.</Text>
              <Button title="Browse the collection" secondary onPress={() => router.navigate('/')} />
            </View>
          </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  introduction: { padding: 24, gap: 20, backgroundColor: colors.blue, borderRadius: 16 },
  folio: { fontFamily: serif, fontSize: 56, color: colors.gold },
  introTitle: { fontFamily: serif, fontSize: 30, lineHeight: 38, color: colors.ink },
  phaseNote: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  avatar: { height: 62, width: 62, borderRadius: 31, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: serif, fontSize: 29, color: colors.ink },
});
