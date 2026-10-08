import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorNotice, Header, Loading } from '@/components/ui';
import { ProductCover } from '@/components/product-cover';
import { colors, common, serif } from '@/constants/theme';
import { money } from '@/lib/format';
import { useShop } from '@/providers/shop-provider';

export default function CartScreen() {
  const shop = useShop();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  async function checkout() {
    setCheckoutError(null);
    if (!shop.hasSession) { router.push('/account'); return; }
    try {
      if (shop.checkoutResult) await shop.finishCheckout();
      router.push('/checkout');
    } catch { setCheckoutError('Your previous order is saved. Finish its confirmation before starting another checkout.'); }
  }
  const busy = Boolean(shop.pendingProduct) || shop.accountLoading || shop.refreshing || shop.signingOut || shop.signingIn || shop.checkingOut;
  return <SafeAreaView edges={['top', 'left', 'right']} style={common.screen}>
    <ScrollView contentContainerStyle={common.content}
      refreshControl={<RefreshControl refreshing={shop.refreshing} onRefresh={() => void shop.refresh()} tintColor={colors.ink} colors={[colors.ink]} />}>
      <Header section="Your selection" />
      <Text accessibilityRole="header" style={common.title}>Your cart</Text>
      <ErrorNotice message={checkoutError} />
      <ErrorNotice message={shop.accountError} retry={() => void shop.refresh()} busy={busy} />
      {!shop.hasSession && <ErrorNotice message={shop.productError} retry={() => void shop.refresh()} busy={busy} />}
      {!shop.hasSession && <Text style={common.body}>Sign in to save and sync this cart across devices.</Text>}
      {shop.hasSession && shop.checkoutPending && <Button title="Resume checkout" onPress={() => router.push('/checkout')} disabled={busy} />}
      {(shop.accountLoading || (!shop.hasSession && shop.productsLoading)) && !shop.user ? <Loading label="Opening your cart…" />
        : (shop.hasSession && !shop.user && shop.accountError) || (!shop.hasSession && shop.productError && !shop.products.length) ? null
          : !shop.cart.items.length ? <EmptyState title="Start with a blank page" detail="Your cart is empty. Find a notebook, a planner, or a set to make your own."
              action="Explore the collection" onPress={() => router.navigate('/')} />
            : <>
              {shop.cart.items.map((item) => <View key={item.product_id} style={styles.item}>
                <View style={styles.itemTop}><ProductCover product={item.product} compact />
                  <View style={styles.itemText}><Text style={common.eyebrow}>{item.product.category}</Text>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={common.body}>{money(item.product.price_kobo)} each</Text></View></View>
                <View style={styles.controls}>
                  <View style={styles.stepper}>
                    <QuantityButton title="−" label={`Decrease ${item.product.name} quantity`} disabled={busy}
                      onPress={() => void shop.changeCart({ product_id: item.product_id, quantity: item.quantity - 1, operation: 'set' })} />
                    <Text accessibilityLabel={`Quantity ${item.quantity}`} accessibilityLiveRegion="polite" style={styles.quantity}>{item.quantity}</Text>
                    <QuantityButton title="+" label={`Increase ${item.product.name} quantity`} disabled={busy || item.quantity >= Math.min(10, item.product.stock)}
                      onPress={() => void shop.changeCart({ product_id: item.product_id, quantity: item.quantity + 1, operation: 'set' })} />
                  </View>
                  <Button title="Remove" label={`Remove ${item.product.name}`} secondary disabled={busy}
                    busy={shop.pendingProduct === item.product_id}
                    onPress={() => void shop.changeCart({ product_id: item.product_id, quantity: 0, operation: 'set' })} />
                </View>
              </View>)}
              <View style={common.panel}><Text style={common.heading}>Order summary</Text>
                <TotalRow label="Subtotal" value={money(shop.cart.subtotal_kobo)} />
                <TotalRow label="Delivery" value={shop.cart.shipping_kobo ? money(shop.cart.shipping_kobo) : 'Free'} />
                <View style={styles.divider} /><TotalRow label="Total" value={money(shop.cart.total_kobo)} strong />
                <Text style={common.body}>{shop.hasSession ? 'Your cart is saved to your account.' : 'Your selection is saved on this device.'}</Text>
                <Button title={shop.hasSession ? 'Proceed to checkout' : 'Sign in to checkout'} disabled={busy || Boolean(shop.accountError)}
                  onPress={() => void checkout()} />
              </View>
            </>}
    </ScrollView>
  </SafeAreaView>;
}
function QuantityButton({ title, label, disabled, onPress }: { title: string; label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.quantityButton, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={styles.quantitySymbol}>{title}</Text>
  </Pressable>;
}
function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={common.row}><Text style={[common.body, strong && styles.total]}>{label}</Text>
    <Text style={[styles.amount, strong && styles.total]}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  item: { padding: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, gap: 18 },
  itemTop: { flexDirection: 'row', gap: 16 }, itemText: { flex: 1, gap: 8, justifyContent: 'center' },
  itemName: { fontFamily: serif, fontSize: 23, color: colors.ink },
  controls: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderRadius: 10 },
  quantityButton: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  quantitySymbol: { fontSize: 23, color: colors.ink }, quantity: { minWidth: 30, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.ink },
  disabled: { opacity: 0.35 }, pressed: { opacity: 0.65 }, divider: { height: 1, backgroundColor: colors.line },
  amount: { flexShrink: 1, color: colors.ink, fontSize: 16, fontWeight: '600' }, total: { fontSize: 20, fontWeight: '700', color: colors.ink },
});
