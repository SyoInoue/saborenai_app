/**
 * Root Layout
 * AuthProvider と PurchaseProvider でアプリ全体をラップする
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/providers/AuthProvider';
import { PurchaseProvider } from '@/providers/PurchaseProvider';
import { COLORS } from '@/constants/config';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PurchaseProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="(modals)"
            options={{
              presentation: 'modal',
              contentStyle: { backgroundColor: COLORS.background },
            }}
          />
        </Stack>
      </PurchaseProvider>
    </AuthProvider>
  );
}
