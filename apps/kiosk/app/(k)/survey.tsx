import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation } from '@dyh/api';
import { common, useT } from '@dyh/i18n';
import { Button, Card, Icon, Txt, cx } from '@dyh/ui-native';
import { KResult, endSession } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';

type Cat = 'facility' | 'clean' | 'service';

export default function Survey() {
  const t = useT(km);
  const tc = useT(common);
  const [ans, setAns] = useState<Partial<Record<Cat, number>>>({});
  const [done, setDone] = useState(false);
  const send = useApiMutation((a, v: Record<string, number>) => a.submitSurvey(v));
  const cats: [Cat, string][] = [
    ['facility', 'building-2'],
    ['clean', 'sparkles'],
    ['service', 'heart-handshake'],
  ];
  const faces: [string, string, string][] = [
    ['frown', t('unsat'), '#c0392b'],
    ['meh', t('sat'), '#b26a00'],
    ['smile', t('vsat'), '#12805a'],
  ];
  if (done)
    return (
      <KPage>
        <KResult icon="heart" color="#12805a" title={t('thanks')} body={t('thanksSub')}>
          <Button size="lg" icon="house" className="mt-6 min-w-[280px]" onPress={() => endSession('/home')}>
            {t('backStart')}
          </Button>
        </KResult>
      </KPage>
    );
  return (
    <KPage max={860}>
      <View className="items-center">
        <Txt w="x" size={30}>
          {t('survey')}
        </Txt>
        <Txt size={17} className="mt-1 text-muted">
          {t('surveyQ')}
        </Txt>
      </View>
      {cats.map(([k, ic]) => (
        <Card key={k} className="mt-4 p-5">
          <View className="flex-row items-center gap-2">
            <Icon name={ic} size={22} />
            <Txt w="b" size={19}>
              {t(k)}
            </Txt>
          </View>
          <View className="mt-3 flex-row gap-3">
            {faces.map(([f, l, col], i) => {
              const on = ans[k] === i;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={l}
                  onPress={() => setAns({ ...ans, [k]: i })}
                  className={cx('flex-1 items-center gap-1.5 rounded-2xl border-2 py-4', on ? 'border-blue bg-sky' : 'border-line bg-card')}
                >
                  <Icon name={f} size={36} color={on ? col : 'muted'} />
                  <Txt w="b" size={14} className={on ? 'text-ink' : 'text-muted'}>
                    {l}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
      <Button
        size="lg"
        full
        icon="send"
        className="mt-5"
        disabled={Object.keys(ans).length < 3}
        loading={send.isPending}
        onPress={async () => {
          await send.mutateAsync(ans as Record<string, number>);
          setDone(true);
        }}
      >
        {tc('submit')}
      </Button>
    </KPage>
  );
}
