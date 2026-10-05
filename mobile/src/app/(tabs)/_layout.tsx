import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';
import { TabIcon } from '@/components/ui';
import { useShop } from '@/providers/shop-provider';

export default function TabLayout() {
  const { cart } = useShop();
  const count = cart.items.reduce((total, item) => total + item.quantity, 0);
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.ink,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    tabBarBadgeStyle: { backgroundColor: colors.ink, color: colors.white },
    sceneStyle: { backgroundColor: colors.paper },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Shop', tabBarIcon: ({ color }) => <TabIcon name="shop" color={color} /> }} />
    <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarBadge: count || undefined, tabBarIcon: ({ color }) => <TabIcon name="cart" color={color} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <TabIcon name="account" color={color} /> }} />
  </Tabs>;
}
