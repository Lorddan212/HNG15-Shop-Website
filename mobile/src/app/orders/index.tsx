import { router } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorNotice, Header, Loading } from '@/components/ui';
import { colors, common } from '@/constants/theme';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useAccountResource } from '@/hooks/use-account-resource';
import { useShop } from '@/providers/shop-provider';

export default function OrdersScreen() {
  const shop = useShop();
  const userId = shop.hasSession ? shop.user?.id ?? null : null;
  const history = useAccountResource(userId, api.orders);
  return <SafeAreaView style={common.screen}>
    <ScrollView contentContainerStyle={common.content}
      refreshControl={<RefreshControl refreshing={history.loading} onRefresh={() => void history.reload()} tintColor={colors.ink} colors={[colors.ink]} />}>
      <Header section="Your paper trail" />
      <Button title="Back to account" secondary onPress={() => router.navigate('/account')} />
      <Text accessibilityRole="header" style={common.title}>My orders</Text>
      {shop.accountLoading && !userId ? <Loading label="Checking your account…" />
        : !userId ? <EmptyState title="Your orders, in one place" detail="Sign in with Google to view your saved orders."
          action="Go to account" onPress={() => router.navigate('/account')} />
          : <>
            <ErrorNotice message={history.error?.status === 401 ? 'Please sign in again to view My orders.' : history.error?.message ?? null}
              retry={() => void history.reload()} busy={history.loading} />
            {history.error?.status === 401 && <Button title="Go to account" onPress={() => router.navigate('/account')} />}
            {history.loading && !history.data ? <Loading label="Loading your orders…" />
              : history.data?.length === 0 ? <EmptyState title="No orders to show" detail="Explore the collection to start your next order."
                action="Browse the collection" onPress={() => router.navigate('/')} />
                : history.data?.map(order => <View key={order.id} style={common.panel}>
                  <Text selectable style={common.heading}>{order.reference}</Text>
                  <Text style={common.body}>{new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  <View style={common.row}><Text style={common.body}>Order placed</Text><Text style={common.heading}>{money(order.total_kobo)}</Text></View>
                  <Text style={common.body}>Pay on delivery</Text>
                  <Button title="View order" label={'View order ' + order.reference}
                    onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })} />
                </View>)}
          </>}
    </ScrollView>
  </SafeAreaView>;
}
