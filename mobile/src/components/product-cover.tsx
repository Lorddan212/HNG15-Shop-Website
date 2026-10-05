import { StyleSheet, Text, View } from 'react-native';
import { colors, serif } from '@/constants/theme';
import type { Product } from '@/lib/types';

/** Native illustration; the label and cover colour come from the real catalogue. */
export function ProductCover({ product, compact = false }: { product: Product; compact?: boolean }) {
  const color = /^#[0-9a-f]{3,8}$/i.test(product.color) ? product.color : colors.ink;
  return <View accessible={false} style={[styles.stage, compact && styles.compactStage]}>
    <View style={[styles.pages, compact && styles.compactPages]} />
    <View style={[styles.cover, { backgroundColor: color }, compact && styles.compactCover]}>
      <View style={styles.spine} /><View style={styles.frame}>
        <Text style={[styles.label, compact && styles.compactLabel]} numberOfLines={3}>{product.cover_label}</Text>
        {!compact && <Text style={styles.brand}>FOLIOVALE</Text>}
      </View><View style={styles.ribbon} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { height: 202, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue, borderRadius: 12, overflow: 'hidden' },
  pages: { position: 'absolute', width: 106, height: 149, backgroundColor: '#eee9dc', borderRadius: 4, transform: [{ rotate: '-7deg' }, { translateX: 5 }, { translateY: 4 }], borderWidth: 1, borderColor: '#cbc8bc' },
  cover: { width: 108, height: 152, borderRadius: 4, transform: [{ rotate: '-7deg' }], padding: 11, paddingLeft: 16, boxShadow: '3px 7px 12px rgba(16,44,65,0.16)' },
  spine: { position: 'absolute', left: 6, top: 0, bottom: 0, width: 2, backgroundColor: '#ffffff25' },
  frame: { flex: 1, borderWidth: 1, borderColor: '#ffffff66', alignItems: 'center', justifyContent: 'center', padding: 5, gap: 16 },
  label: { fontFamily: serif, fontSize: 15, lineHeight: 19, color: '#ffffff', textAlign: 'center', textShadowColor: '#00000066', textShadowRadius: 2 },
  brand: { color: '#ffffff', fontSize: 6, letterSpacing: 1.4 },
  ribbon: { position: 'absolute', width: 5, height: 12, bottom: -8, right: 14, backgroundColor: colors.gold },
  compactStage: { height: 104, width: 80, borderRadius: 8 },
  compactCover: { height: 76, width: 54, padding: 5, paddingLeft: 8 },
  compactPages: { height: 73, width: 52 },
  compactLabel: { fontSize: 8, lineHeight: 10 },
});
