/**
 * Root Layout
 * AuthProvider と PurchaseProvider でアプリ全体をラップする
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/providers/AuthProvider';
import { PurchaseProvider } from '@/providers/PurchaseProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PurchaseProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="(modals)"
            options={{ presentation: 'modal' }}
          />
        </Stack>
      </PurchaseProvider>
    </AuthProvider>
  );
}
