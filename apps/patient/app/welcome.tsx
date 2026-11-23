import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Alert, Button, Card, Field, Gradient, Icon, LinkText, Logo, Row, Segmented, Txt, useColors, usePrefs } from '@dyh/ui-native';
import { BioDialog, ChoiceCard, ForgotPinDialog, useAfterAuth } from '../src/components/auth';
import { pm } from '../src/msgs';

const m = defineMessages('patient.welcome', {
  forExisting: ['Para sa may account na sa DYH Patient App', 'For existing DYH Patient App users'],
  withPin: ['Ituloy gamit ang PIN', 'Continue with PIN'],
  withBio: ['Mag-login gamit ang Fingerprint', 'Log In with Fingerprint'],
  noAcct: ['Wala pang account sa app?', 'No app account yet?'],
  newTitle: ['Bagong pasyente ako', 'I am a new patient'],
  newSub: ['Hindi pa ako nakapagpakonsulta sa DYH — gagawa ng bagong rekord', 'Never consulted at DYH — creates a new record'],
  linkTitle: ['May rekord na ako sa DYH', 'I already have a DYH record'],
  linkSub: ['Nakapagpakonsulta na o nagparehistro sa Kiosk — i-link at humingi ng access', 'Consulted before or registered at the Kiosk — link and request access'],
  guest: ['Tumingin muna bilang Guest', 'Browse as Guest'],
});

export default function Welcome() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const c = useColors();
  const { lang, setLang } = usePrefs((s) => s);
  const [mobile, setMobile] = useState('917 555 0142');
  const [bio, setBio] = useState(false);
  const [forgot, setForgot] = useState(false);
  const afterAuth = useAfterAuth();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-scr">
      <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        <Gradient colors={['#2d6cdf', '#17325f', '#0f2447']} className="mx-3 overflow-hidden rounded-[30px] px-5 pb-[74px] pt-4">
          <View className="absolute -right-10 -top-10 h-44 w-44 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <Row className="justify-between">
            <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Icon name="smartphone" size={14} color="#ffffff" />
              <Txt w="b" size={12} className="text-white">
                {p('appName')}
              </Txt>
            </View>
            <Segmented size="sm" className="w-[158px]" value={lang} onChange={setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
          </Row>
          <View className="mt-6 items-center">
            <Logo height={66} light />
            <Txt w="s" size={12.5} className="mt-2 text-white" style={{ opacity: 0.85 }}>
              Quality Healthcare Close to Home
            </Txt>
          </View>
        </Gradient>
        <View className="-mt-[52px] px-[18px]">
          <Card lift>
            <Row>
              <Icon name="log-in" size={20} color="blue" />
              <Txt w="b" size={18}>
                {p('login')}
              </Txt>
            </Row>
            <Txt size={12.5} className="mt-1 text-muted">
              {t('forExisting')}
            </Txt>
            <Field label={tc('mobile')} icon="smartphone">
              <Row className="rounded-xl border-[1.5px] border-line bg-field px-3.5">
                <Txt w="b" className="text-muted">
                  +63
                </Txt>
                <TextInput value={mobile} onChangeText={setMobile} keyboardType="phone-pad" accessibilityLabel={tc('mobile')} className="flex-1 py-3 text-ink" style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: c.ink }} />
              </Row>
            </Field>
            <Button variant="n" size="lg" full icon="key-round" className="mt-4" onPress={() => router.push('/pin')}>
              {t('withPin')}
            </Button>
            <Button variant="o" full icon="fingerprint" className="mt-2" onPress={() => setBio(true)}>
              {t('withBio')}
            </Button>
            <View className="mt-3 items-center">
              <LinkText icon="circle-help" onPress={() => setForgot(true)}>
                {p('forgotPin')}
              </LinkText>
            </View>
          </Card>
          <Row className="my-4" gap="gap-3">
            <View className="h-px flex-1 bg-line" />
            <Txt w="s" size={12} className="text-muted">
              {t('noAcct')}
            </Txt>
            <View className="h-px flex-1 bg-line" />
          </Row>
          <ChoiceCard icon="user-plus" tone="blue" title={t('newTitle')} sub={t('newSub')} onPress={() => router.push('/register')} />
          <View className="h-2" />
          <ChoiceCard icon="link" tone="green" title={t('linkTitle')} sub={t('linkSub')} onPress={() => router.push('/link')} />
          <Button variant="g" full icon="eye" className="mt-3" onPress={() => router.push('/guest')}>
            {t('guest')}
          </Button>
          <Alert kind="danger" icon="siren" className="mt-4" text={`**${p('emergencyQ')}** ${p('emergencyGo')}`} />
        </View>
      </ScrollView>
      <BioDialog open={bio} onClose={() => setBio(false)} onDone={afterAuth} />
      <ForgotPinDialog open={forgot} onClose={() => setForgot(false)} />
    </SafeAreaView>
  );
}
