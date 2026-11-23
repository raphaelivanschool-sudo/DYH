import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider } from '@dyh/api';
import type { DyhApi } from '@dyh/api';
import { ToastHost } from './overlay';
import { ThemeProvider, configurePrefs, useLangSync, usePrefs } from './theme';

function Themed({ children, statusBar }: { children: ReactNode; statusBar?: 'light' | 'dark' }) {
  useLangSync();
  const theme = usePrefs((p) => p.theme);
  return (
    <ThemeProvider scheme={theme}>
      <StatusBar style={statusBar ?? (theme === 'dark' ? 'light' : 'dark')} />
      {children}
      <ToastHost />
    </ThemeProvider>
  );
}

/**
 * Root for every DYH mobile app: fonts, persisted preferences (language, theme),
 * the API (mock or HTTP), safe areas and toasts.
 */
export function DyhAppRoot({ api, prefsKey, children, statusBar }: { api: DyhApi & { subscribe?: (fn: (t: string) => void) => () => void }; prefsKey: string; children: ReactNode; statusBar?: 'light' | 'dark' }) {
  const [store] = useState(() => configurePrefs(prefsKey));
  const [hydrated, setHydrated] = useState(store.persist.hasHydrated());
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  useEffect(() => {
    const off = store.persist.onFinishHydration(() => setHydrated(true));
    // Storage may have finished before we subscribed.
    if (store.persist.hasHydrated()) setHydrated(true);
    return off;
  }, [store]);
  // A font that fails to load falls back to the system font rather than blocking the app.
  if ((!fontsLoaded && !fontError) || !hydrated)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17325f' }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <ApiProvider api={api}>
        <Themed statusBar={statusBar}>{children}</Themed>
      </ApiProvider>
    </SafeAreaProvider>
  );
}
