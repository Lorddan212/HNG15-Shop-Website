import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorNotice, Header, Loading } from '@/components/ui';
import { colors, common } from '@/constants/theme';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useAccountResource } from '@/hooks/use-account-resource';
import { useShop } from '@/providers/shop-provider';

const emailLabels = { queued: 'Pending', sending: 'Being processed', accepted: 'Accepted for delivery', failed: 'Not sent' };

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shop = useShop();
  const userId = shop.hasSession ? shop.user?.id ?? null : null;
  const load = useCallback((owner: string) => api.order(owner, typeof id === 'string' ? id : ''), [id]);
  const detail = useAccountResource(userId, load, id);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const operation = useRef(false);
  const focused = useRef<symbol | null>(null);
  useFocusEffect(useCallback(() => {
    focused.current = Symbol(userId + ':' + id);
    setDeleting(false); setDeleteError(null);
    return () => { focused.current = null; };
  }, [userId, id]));

  function confirmRemoval() {
    if (!userId || !detail.data || operation.current) return;
    const scope = focused.current;
    const orderId = detail.data.id;
    Alert.alert('Delete from history?', 'Remove this order from your visible history? This does not cancel the order or restore stock.', [
      { text: 'Keep order', style: 'cancel' },
      { text: 'Delete from history', style: 'destructive', onPress: () => {
        if (!scope || focused.current !== scope || operation.current) return;
        operation.current = true; setDeleting(true); setDeleteError(null);
        void api.deleteOrder(userId, orderId).then(() => {
          if (focused.current === scope) router.dismissTo('/orders');
        }).catch((error: unknown) => {
          if (focused.current === scope) setDeleteError(error instanceof ApiError ? error : new ApiError('This order could not be removed. Please try again.'));
        }).finally(() => {
          operation.current = false;
          if (focused.current === scope) setDeleting(false);
        });
      } },
    ]);
  }

  const error = deleteError ?? detail.error;
  const order = detail.data;
  return <SafeAreaView style={common.screen}>
    <ScrollView contentContainerStyle={common.content}
      refreshControl={<RefreshControl refreshing={detail.loading} enabled={!deleting} onRefresh={() => { setDeleteError(null); void detail.reload(); }} tintColor={colors.ink} colors={[colors.ink]} />}>
      <Header section="My orders" />
      <Button title="Back to My orders" secondary disabled={deleting} onPress={() => router.dismissTo('/orders')} />
      {shop.accountLoading && !userId ? <Loading label="Checking your account…" />
        : !userId ? <EmptyState title="Sign in to view your order" detail="Your saved orders are available in your FolioVale account."
          action="Go to account" onPress={() => router.navigate('/account')} />
          : error ? <>
            <ErrorNotice message={error.status === 404 ? 'This order is no longer available in your history.'
              : error.status === 401 ? 'Please sign in again to view this order.' : error.message}
              retry={error.status === 404 ? undefined : () => { setDeleteError(null); void detail.reload(); }} busy={detail.loading || deleting} />
            {error.status === 401 && <Button title="Go to account" onPress={() => router.navigate('/account')} />}
          </>
            : detail.loading && !order ? <Loading label="Loading your order…" />
              : order ? <>
                <Text accessibilityRole="header" selectable style={common.title}>{order.reference}</Text>
                <Text style={common.body}>{new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                <View style={common.panel}>
                  <Text style={common.heading}>Your order</Text>
                  {order.items.map((item, index) => <View key={item.product_id + ':' + index}>
                    <Text style={common.body}>{item.product_name}</Text>
                    <Text style={common.body}>Qty {item.quantity} · {money(item.unit_price_kobo)} each</Text>
                    <Text style={common.body}>{money(item.quantity * item.unit_price_kobo)}</Text>
                  </View>)}
                  <Row label="Subtotal" value={money(order.subtotal_kobo)} />
                  <Row label="Delivery fee" value={order.shipping_kobo ? money(order.shipping_kobo) : 'Free'} />
                  <Row label="Total" value={money(order.total_kobo)} />
                </View>
                <View style={common.panel}>
                  <Text style={common.heading}>Delivery details</Text>
                  <Text selectable style={common.body}>{order.full_name}</Text>
                  <Text selectable style={common.body}>{order.phone}</Text>
                  <Text selectable style={common.body}>{order.address}{'\n'}{order.city}, {order.state}</Text>
                  {order.notes ? <><Text style={common.eyebrow}>Delivery note</Text><Text selectable style={common.body}>{order.notes}</Text></> : null}
                </View>
                <View style={common.panel}>
                  <Row label="Payment method" value="Pay on delivery" />
                  <Row label="Order status" value="Order placed" />
                  <Row label="Email status" value={emailLabels[order.email_status]} />
                  <Text selectable style={common.body}>{order.email}</Text>
                  <Text style={common.body}>Pay on delivery. No online payment is collected at checkout.</Text>
                  {order.email_status === 'accepted' && <Text style={common.body}>Your confirmation email was accepted for delivery. Check your inbox or spam folder.</Text>}
                </View>
                <Button title="Delete from history" secondary busy={deleting} disabled={detail.loading || shop.signingOut} onPress={confirmRemoval} />
              </> : null}
    </ScrollView>
  </SafeAreaView>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <View style={common.row}><Text style={common.body}>{label}</Text><Text style={common.body}>{value}</Text></View>;
}
