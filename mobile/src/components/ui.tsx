import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { colors, common, serif } from '@/constants/theme';

export function Button({ title, onPress, disabled = false, busy = false, secondary = false, label }: {
  title: string; onPress?: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; label?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? title}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
    {busy && <ActivityIndicator size="small" color={secondary ? colors.ink : colors.white} />}
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function Header({ section }: { section: string }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}><View style={styles.monogram}><Text style={styles.monogramText}>F</Text></View>
      <Text style={styles.brand}>FolioVale</Text></View>
    <Text style={common.eyebrow}>{section}</Text>
  </View>;
}

export function ErrorNotice({ message, retry, busy = false }: { message: string | null; retry?: () => void; busy?: boolean }) {
  if (!message) return null;
  return <View style={styles.error} accessibilityLiveRegion="polite">
    <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text>
    {retry && <Button title="Try again" secondary onPress={retry} disabled={busy} />}
  </View>;
}

export function Loading({ label }: { label: string }) {
  return <View style={styles.loading} accessibilityLiveRegion="polite">
    <ActivityIndicator color={colors.ink} size="large" /><Text style={common.body}>{label}</Text>
  </View>;
}

export function EmptyState({ title, detail, action, onPress }: { title: string; detail: string; action?: string; onPress?: () => void }) {
  return <View style={common.panel}><Text style={common.heading}>{title}</Text><Text style={common.body}>{detail}</Text>
    {action && <Button title={action} onPress={onPress} />}
  </View>;
}

export function TabIcon({ name, color }: { name: 'shop' | 'cart' | 'account'; color: ColorValue }) {
  return <View accessible={false} style={styles.icon}>
    {name === 'shop' ? <View style={[styles.bookIcon, { borderColor: color }]}><View style={[styles.spineIcon, { backgroundColor: color }]} /></View>
      : name === 'cart' ? <><View style={[styles.handleIcon, { borderColor: color }]} /><View style={[styles.bagIcon, { borderColor: color }]} /></>
        : <><View style={[styles.headIcon, { borderColor: color }]} /><View style={[styles.bodyIcon, { borderColor: color }]} /></>}
  </View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 14, textAlign: 'center', flexShrink: 1 },
  secondary: { backgroundColor: colors.blue }, secondaryText: { color: colors.ink },
  disabled: { opacity: 0.5 }, pressed: { opacity: 0.75 },
  header: { gap: 14, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.line },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontFamily: serif, fontSize: 28, color: colors.ink, letterSpacing: -0.7 },
  monogram: { width: 33, height: 37, backgroundColor: colors.ink, borderRadius: 3, borderLeftWidth: 3, borderLeftColor: colors.gold, justifyContent: 'center', alignItems: 'center' },
  monogramText: { fontFamily: serif, color: colors.paper, fontSize: 24 },
  loading: { padding: 36, gap: 14, alignItems: 'center' },
  error: { padding: 16, gap: 12, backgroundColor: colors.errorPaper, borderRadius: 12 },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 21 },
  icon: { height: 24, width: 24, justifyContent: 'center', alignItems: 'center' },
  bookIcon: { width: 19, height: 23, borderWidth: 1.8, borderRadius: 3 },
  spineIcon: { width: 1.5, height: 19, marginLeft: 4 },
  handleIcon: { width: 10, height: 7, borderWidth: 1.8, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  bagIcon: { width: 20, height: 17, borderWidth: 1.8, borderRadius: 3 },
  headIcon: { width: 9, height: 9, borderWidth: 1.8, borderRadius: 5 },
  bodyIcon: { width: 21, height: 11, marginTop: 3, borderWidth: 1.8, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomWidth: 0 },
});
