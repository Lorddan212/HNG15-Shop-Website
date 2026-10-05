import { Platform, StyleSheet } from 'react-native';

export const colors = {
  ink: '#18364b', navy: '#102c41', paper: '#f8f6f0', white: '#ffffff',
  blue: '#e4edf2', muted: '#586e7c', line: '#d7dfe2', gold: '#a38a58',
  error: '#923d34', errorPaper: '#fff0eb', success: '#3c6353',
};
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 22, paddingBottom: 36, gap: 20, width: '100%', maxWidth: 840, alignSelf: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: colors.muted, textTransform: 'uppercase' },
  title: { fontFamily: serif, fontSize: 36, color: colors.ink, lineHeight: 43 },
  heading: { fontFamily: serif, fontSize: 25, color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  panel: { padding: 22, gap: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
