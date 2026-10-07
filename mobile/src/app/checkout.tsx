import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorNotice, Header, Loading } from '@/components/ui';
import { colors, common } from '@/constants/theme';
import { ApiError } from '@/lib/api-client';
import { deliveryFields, validateDelivery, type FieldErrors } from '@/lib/checkout-flow';
import { money } from '@/lib/format';
import type { Delivery } from '@/lib/types';
import { useShop } from '@/providers/shop-provider';

export default function CheckoutScreen() {
  const shop = useShop();
  return <SafeAreaView style={common.screen}>
    <KeyboardAvoidingView style={common.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={common.content}>
        <Header section="The finishing details" />
        <Button title="Back to cart" secondary disabled={shop.checkingOut} onPress={() => router.replace('/cart')} />
        <Text accessibilityRole="header" style={common.title}>Checkout</Text>
        {!shop.hasSession ? <EmptyState title="Your account, your order" detail="Sign in with Google to check out. Your guest cart stays saved on this device."
          action="Sign in to checkout" onPress={() => router.navigate('/account')} />
          : shop.checkoutResult ? <CheckoutForm key={shop.user?.id} />
            : shop.accountLoading && !shop.user ? <Loading label="Checking your account and cart…" />
            : shop.accountError && !shop.user ? <ErrorNotice message={shop.accountError} retry={() => void shop.refresh()} busy={shop.refreshing} />
              : <CheckoutForm key={shop.user?.id} />}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function CheckoutForm() {
  const shop = useShop();
  const [delivery, setDelivery] = useState<Delivery>(shop.checkoutDraft ?? { full_name: shop.user?.name ?? '', phone: '', address: '', city: '', state: '', notes: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [retryOnly, setRetryOnly] = useState(Boolean(shop.checkoutDraft));
  const busy = shop.checkingOut || shop.refreshing || shop.signingOut || shop.accountLoading;
  async function submit() {
    if (busy) return;
    if (!shop.checkoutResult && !retryOnly) {
      const checked = validateDelivery(delivery);
      setErrors(checked.errors);
      if (Object.keys(checked.errors).length) { setError('Check the delivery fields below.'); return; }
    }
    setError(null);
    try { await shop.placeOrder(delivery); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to place your order. Please retry.');
      if (failure instanceof ApiError && failure.status === 400) {
        setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, messages]) => [key, Array.isArray(messages) ? messages.join(' ') : 'Check this field.'])));
        setRetryOnly(false);
      } else if (failure instanceof ApiError && failure.status === 409) {
        setRetryOnly(false);
        await shop.refresh();
      } else if (failure instanceof ApiError && failure.status === 401) {
        setRetryOnly(false);
      } else setRetryOnly(true);
    }
  }
  async function continueShopping() {
    try { await shop.finishCheckout(); router.replace('/'); }
    catch { setError('Your order is saved. Retry confirmation before starting another checkout.'); }
  }
  const result = shop.checkoutResult;
  if (result) return <>
    <View style={common.panel}>
      <Text style={common.eyebrow}>Order received</Text>
      <Text accessibilityRole="header" style={common.heading}>Thank you, {result.order.full_name}.</Text>
      <Text selectable style={styles.reference}>{result.order.reference}</Text>
      <Text style={common.body}>Your order has been recorded.</Text>
      <Summary label="Order total" value={money(result.order.total_kobo)} />
      <Summary label="Payment method" value="Pay on delivery" />
      <Text style={common.body}>No online payment was taken.</Text>
      {result.cart?.items.length === 0 && <Text style={styles.confirmed}>Your cart is cleared.</Text>}
      <Text style={common.body}>{result.order.email_status === 'accepted'
        ? 'Your confirmation email was accepted for delivery. Check your inbox or spam folder. Your order is also saved in your account.'
        : 'Your order is saved even if the confirmation email has not arrived.'}</Text>
      <Text style={styles.disclosure}>Pay on delivery. No online payment is collected at checkout.</Text>
    </View>
    <ErrorNotice message={result.warning} retry={() => void submit()} busy={busy} />
    <ErrorNotice message={error} />
    <Button title="Continue shopping" disabled={busy} onPress={() => void continueShopping()} />
  </>;
  if (!shop.cart.items.length && !shop.checkoutPending) return <EmptyState title="Your cart is empty" detail="Choose something from the collection before checkout."
    action="Explore the collection" onPress={() => router.replace('/')} />;
  return <>
    <ErrorNotice message={error} />
    <ErrorNotice message={shop.accountError} retry={() => void shop.refresh()} busy={busy} />
    {shop.checkoutPending && <Text style={common.body}>Your previous checkout has not been confirmed. Try again to check its status; this will not place a duplicate order.</Text>}
    {retryOnly && <Text style={common.body}>Your order may already be saved. Keep the same details and try again to check its status.</Text>}
    {error && <Button title="Go to Account" secondary onPress={() => router.navigate('/account')} disabled={busy} />}
    <View style={common.panel}>
      <Text style={common.heading}>Delivery details</Text>
      {(Object.keys(deliveryFields) as (keyof Delivery)[]).map(key => <View key={key} style={styles.field}>
        <Text style={styles.label}>{deliveryFields[key].label}</Text>
        <TextInput accessibilityLabel={deliveryFields[key].label} accessibilityHint={errors[key]}
          value={delivery[key]} onChangeText={value => { setDelivery(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: undefined })); }}
          editable={!busy && !retryOnly} maxLength={deliveryFields[key].max}
          keyboardType={key === 'phone' ? 'phone-pad' : 'default'}
          autoComplete={key === 'full_name' ? 'name' : key === 'phone' ? 'tel' : key === 'address' ? 'street-address' : 'off'}
          autoCapitalize={key === 'phone' ? 'none' : 'words'} multiline={key === 'notes'}
          style={[styles.input, key === 'notes' && styles.notes, Boolean(errors[key]) && styles.invalid]} />
        {errors[key] && <Text accessibilityRole="alert" style={styles.fieldError}>{errors[key]}</Text>}
      </View>)}
    </View>
    <View style={common.panel}><Text style={common.heading}>Payment</Text>
      <Text style={styles.label}>Pay on delivery</Text>
      <Text style={common.body}>No card details or online payment needed.</Text>
    </View>
    <View style={common.panel}><Text style={common.heading}>Your selection</Text>
      {shop.cart.items.map(item => <Summary key={item.product_id} label={`${item.product.name} × ${item.quantity}`} value={money(item.product.price_kobo * item.quantity)} />)}
      <Summary label="Subtotal" value={money(shop.cart.subtotal_kobo)} />
      <Summary label="Delivery" value={shop.cart.shipping_kobo ? money(shop.cart.shipping_kobo) : 'Free'} />
      <Summary label="Total" value={money(shop.cart.total_kobo)} />
      <Text style={common.body}>Stock and prices are checked again when your order is placed.</Text>
      <Text style={styles.disclosure}>Pay on delivery. No online payment is collected at checkout.</Text>
      <Button title={`Place order · ${money(shop.cart.total_kobo)}`} busy={shop.checkingOut} disabled={busy || Boolean(shop.accountError)} onPress={() => void submit()} />
    </View>
  </>;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <View style={common.row}><Text style={[common.body, styles.summaryLabel]}>{label}</Text><Text style={styles.amount}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  field: { gap: 8 }, label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 13, backgroundColor: colors.paper, color: colors.ink, fontSize: 16 },
  notes: { minHeight: 100, textAlignVertical: 'top' }, invalid: { borderColor: colors.error }, fieldError: { color: colors.error, fontSize: 13 },
  reference: { color: colors.ink, fontSize: 20, fontWeight: '700' }, confirmed: { color: colors.success, fontSize: 15 },
  summaryLabel: { flex: 1 }, amount: { color: colors.ink, fontWeight: '600', fontSize: 15, flexShrink: 1 },
  disclosure: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
