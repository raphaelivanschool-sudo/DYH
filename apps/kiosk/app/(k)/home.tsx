import { Pressable, View } from 'react-native';
import { useT } from '@dyh/i18n';
import { Icon, Rich, Txt } from '@dyh/ui-native';
import { KBig, go } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';
import { useKiosk } from '../../src/store';

export default function Home() {
  const t = useT(km);
  const start = (path: string) => {
    useKiosk.getState().reset();
    go(path);
  };
  return (
    <KPage>
      <View className="items-center">
        <Txt w="x" size={38}>
          {t('welcome')}
        </Txt>
        <Txt size={19} className="mt-1 text-muted">
          {t('tapBelow')}
        </Txt>
      </View>
      <View className="mt-7 h-[230px] flex-row gap-6">
        <KBig icon="user-plus" title={t('newHere')} sub={t('newHereSub')} colors={['#2d6cdf', '#1f56b0']} onPress={() => start('/register')} />
        <KBig icon="user-search" title={t('haveRecord')} sub={t('haveRecordSub')} colors={['#17325f', '#0f2447']} onPress={() => start('/existing')} />
      </View>
      <View className="mt-6 h-[150px] flex-row">
        <KBig wide icon="scan-qr-code" title={t('scanBk')} sub={t('scanBkSub')} colors={['#12805a', '#0b6a49']} onPress={() => start('/scan')} />
      </View>
      <View className="mt-6 flex-row gap-6">
        <View className="flex-1 flex-row items-center gap-3 rounded-2xl bg-red-bg p-4">
          <Icon name="siren" size={24} color="red" />
          <Rich size={16} className="flex-1 text-red" text={t('emergency')} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => start('/survey')} className="flex-1 flex-row items-center gap-3 rounded-2xl bg-sky p-4">
          <Icon name="smile" size={24} color="blue" />
          <Txt size={16} className="flex-1 text-blue">
            <Txt w="b" size={16} className="text-blue">
              {t('survey')}
            </Txt>
            {' — '}
            {t('surveySub')}
          </Txt>
          <Icon name="chevron-right" size={20} color="blue" />
        </Pressable>
      </View>
    </KPage>
  );
}
