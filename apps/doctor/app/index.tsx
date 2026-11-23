import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Gradient, Logo, Txt } from '@dyh/ui-native';
import { useSession } from '../src/store';

/** Splash: brand, then Home when signed in, otherwise Login. */
export default function Splash() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    const id = setTimeout(() => router.replace(token ? '/home' : '/login'), 1100);
    return () => clearTimeout(id);
  }, [token]);
  return (
    <Gradient colors={['#2d6cdf', '#17325f', '#0f2447']} className="flex-1 items-center justify-center">
      <Logo height={84} light />
      <Txt w="s" size={13} className="mt-3 text-white" style={{ opacity: 0.85 }}>
        Quality Healthcare Close to Home
      </Txt>
      <View className="absolute bottom-14 rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
        <Txt w="b" size={11} className="text-white" style={{ letterSpacing: 2 }}>
          DOCTOR APP · v1.0
        </Txt>
      </View>
    </Gradient>
  );
}
