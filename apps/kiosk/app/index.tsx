import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@dyh/i18n';
import { Icon, Logo, Txt } from '@dyh/ui-native';
import { go } from '../src/components/kit';
import { km } from '../src/msgs';

const AD = require('../assets/ad.mp4');

/** Attract loop: a muted hospital ad until someone taps the screen. */
export default function Attract() {
  const t = useT(km);
  const player = useVideoPlayer(AD, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('tapStart')} onPress={() => go('/home')} className="flex-1 bg-navy">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
      </View>
      <View className="absolute inset-0" style={{ backgroundColor: 'rgba(15,36,71,0.25)' }} pointerEvents="none" />
      <View className="flex-row items-center justify-between p-8" pointerEvents="none">
        <Logo height={52} light />
        <View className="flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <Icon name="tablet" size={16} color="#ffffff" />
          <Txt w="b" size={14} className="text-white">
            OPD Kiosk
          </Txt>
        </View>
      </View>
      <View className="flex-1" pointerEvents="none" />
      <View className="mb-12 flex-row items-center gap-4 self-center rounded-[26px] bg-white px-8 py-5" pointerEvents="none">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-blue">
          <Icon name="pointer" size={28} color="#ffffff" />
        </View>
        <View>
          <Txt w="x" size={24} style={{ color: '#0f2447' }}>
            Pindutin kahit saan para magsimula
          </Txt>
          <Txt size={16} style={{ color: '#5a6b85' }}>
            Tap anywhere to start
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}
