import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorNotice, Header, Loading } from '@/components/ui';
import { ProductCover } from '@/components/product-cover';
import { colors, common, serif } from '@/constants/theme';
import { money } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useShop } from '@/providers/shop-provider';

export default function ShopScreen() {
  const shop = useShop();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 380 && fontScale < 1.4 ? 2 : 1;
  const [notice, setNotice] = useState<string | null>(null);
  async function add(product: Product) {
    setNotice(null);
    if (await shop.changeCart({ product_id: product.id, quantity: 1, operation: 'add' })) setNotice(`${product.name} added to your cart.`);
  }
  const busy = Boolean(shop.pendingProduct) || shop.accountLoading || shop.refreshing || shop.signingOut || shop.signingIn || shop.checkingOut;
  return <SafeAreaView edges={['top', 'left', 'right']} style={common.screen}>
    <FlatList key={columns} data={shop.products} keyExtractor={(item) => item.id} numColumns={columns}
      contentContainerStyle={common.content} columnWrapperStyle={columns > 1 ? styles.columns : undefined}
      refreshControl={<RefreshControl refreshing={shop.refreshing} onRefresh={() => void shop.refresh()} tintColor={colors.ink} colors={[colors.ink]} />}
      ListHeaderComponent={<View style={styles.intro}>
        <Header section="The paper collection" />
        <View style={styles.hero}><Text style={common.eyebrow}>Room for your next idea</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>A little space.{ '\n' }Room for your ideas.</Text>
          <Text style={common.body}>Notebooks, planners, and sets for everyday notes and plans.</Text>
          <View style={styles.heroRule} /></View>
        <View style={common.row}><Text accessibilityRole="header" style={common.heading}>The collection</Text>
          {!shop.productsLoading && <Text style={styles.count}>{shop.products.length} pieces</Text>}</View>
        <ErrorNotice message={shop.productError} retry={() => void shop.refresh()} busy={shop.refreshing} />
        <ErrorNotice message={shop.accountError} retry={() => void shop.refresh()} busy={busy} />
        {notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      </View>}
      ListEmptyComponent={shop.productsLoading ? <Loading label="Opening the collection…" /> : !shop.productError
        ? <EmptyState title="A fresh page awaits" detail="There are no products available right now. Pull down to check again." /> : null}
      renderItem={({ item }) => {
        const quantity = shop.cart.items.find((entry) => entry.product_id === item.id)?.quantity ?? 0;
        const atLimit = quantity >= Math.min(10, item.stock);
        return <View style={[styles.card, columns === 2 && styles.halfCard]}>
          <ProductCover product={item} />
          <View style={styles.cardBody}><Text style={styles.category}>{item.category}</Text>
            <Text accessibilityRole="header" style={styles.productName}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.subtitle || item.description}</Text>
            <View style={styles.cardBottom}><Text style={styles.price}>{money(item.price_kobo)}</Text>
              <Text style={[styles.stock, item.stock <= 0 && styles.outOfStock]}>{item.stock > 0 ? 'In stock' : 'Sold out'}</Text>
              <Button title={item.stock <= 0 ? 'Sold out' : atLimit ? 'Cart limit reached' : 'Add to cart'}
                label={`Add ${item.name} to cart`} onPress={() => void add(item)}
                disabled={busy || item.stock <= 0 || atLimit} busy={shop.pendingProduct === item.id} />
            </View>
          </View>
        </View>;
      }}
      ListFooterComponent={shop.products.length ? <Text style={styles.footer}>For plans, possibilities, and everything in between.</Text> : null}
    />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  intro: { gap: 22 }, hero: { paddingVertical: 8, gap: 16 },
  heroTitle: { fontFamily: serif, fontSize: 37, lineHeight: 44, color: colors.ink, letterSpacing: -1 },
  heroRule: { height: 3, width: 42, backgroundColor: colors.gold, marginTop: 2 },
  columns: { gap: 14 }, count: { fontSize: 12, color: colors.muted },
  card: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 14, padding: 8 },
  halfCard: { maxWidth: '50%' }, cardBody: { padding: 6, paddingTop: 14, gap: 8, flex: 1 },
  category: { fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.muted, fontWeight: '600' },
  productName: { fontFamily: serif, fontSize: 21, lineHeight: 26, color: colors.ink },
  subtitle: { fontSize: 13, lineHeight: 19, color: colors.muted },
  cardBottom: { marginTop: 'auto', paddingTop: 12, gap: 10 },
  price: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  stock: { color: colors.success, fontSize: 11 }, outOfStock: { color: colors.muted },
  notice: { color: colors.success, backgroundColor: colors.blue, padding: 14, borderRadius: 10, fontSize: 14 },
  footer: { textAlign: 'center', color: colors.muted, fontFamily: serif, fontSize: 17, lineHeight: 26, paddingVertical: 20 },
});
