import * as LocalAuthentication from 'expo-local-authentication';
import { Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/** QR code on a white tile, as in the prototype. */
export function QR({ value, size = 190 }: { value: string; size?: number }) {
  return (
    <View className="self-center rounded-[18px] border border-line bg-white p-3">
      <QRCode value={value} size={size} color="#0f2447" backgroundColor="#ffffff" />
    </View>
  );
}

/**
 * Fingerprint / Face ID. On devices without enrolled biometrics (and on web previews)
 * it resolves `fallback` so the demo flow still works; the caller decides what that means.
 */
export async function authenticateBiometric(prompt: string, fallback = true): Promise<boolean> {
  if (Platform.OS === 'web') return fallback;
  try {
    const [has, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    if (!has || !enrolled) return fallback;
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false });
    return r.success;
  } catch {
    return fallback;
  }
}
