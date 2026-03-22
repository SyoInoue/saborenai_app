/**
 * タブナビゲーション
 * ホーム・履歴・設定の3タブ
 */

import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/config';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          paddingBottom: 8,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="🏠" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📅" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="⚙️" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

type TabIconProps = {
  emoji: string;
  color: string;
  size: number;
};

function TabIcon({ emoji, size }: TabIconProps) {
  return (
    <Text style={{ fontSize: size }}>{emoji}</Text>
  );
}
