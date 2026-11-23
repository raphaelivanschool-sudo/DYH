import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ME, maskMobile } from '@dyh/core';
import { defineMessages, useT } from '@dyh/i18n';
import { Avatar, Center, Header, Icon, Keypad, LinkText, PinDots, Row, Screen, Txt } from '@dyh/ui-native';
import { BioDialog, ForgotPinDialog, useAfterAuth } from '../src/components/auth';
import { pm } from '../src/msgs';
import { useSession } from '../src/store';

const m = defineMessages('patient.pin', {
  welcomeBack: ['Maligayang pagbabalik, {{name}}!', 'Welcome back, {{name}}!'],
  enter6: ['Ilagay ang iyong 6-digit na PIN', 'Enter your 6-digit PIN'],
  notYou: ['Hindi ikaw?', 'Not you?'],
});

export default function PinLogin() {
  const t = useT(m);
  const p = useT(pm);
  const [pin, setPin] = useState('');
  const [bio, setBio] = useState(false);
  const [forgot, setForgot] = useState(false);
  const bioOn = useSession((s) => s.bioOn);
  const afterAuth = useAfterAuth();
  const key = (n: string) => {
    const v = pin + n;
    setPin(v.length >= 6 ? '' : v);
    if (v.length >= 6) void afterAuth();
  };
  return (
    <Screen header={<Header onBack={() => router.back()} />}>
      <Center>
        <Avatar text="JD" size="xl" />
        <Txt w="b" size={18} className="mt-3">
          {t('welcomeBack', { name: ME.name.first })}
        </Txt>
        <Row gap="gap-1" className="mt-1">
          <Icon name="smartphone" size={14} color="muted" />
          <Txt size={12.5} className="text-muted">
            +63 {maskMobile(ME.mobile).replace(/^0/, '')}
          </Txt>
        </Row>
        <Txt w="b" className="mt-4">
          {t('enter6')}
        </Txt>
        <PinDots value={pin} />
        <Keypad onKey={key} onDelete={() => setPin(pin.slice(0, -1))} onBio={bioOn ? () => setBio(true) : undefined} />
      </Center>
      <View className="mt-5 flex-row justify-between">
        <LinkText icon="circle-help" onPress={() => setForgot(true)}>
          {p('forgotPin')}
        </LinkText>
        <LinkText icon="user-round-x" onPress={() => router.replace('/welcome')}>
          {t('notYou')}
        </LinkText>
      </View>
      <BioDialog open={bio} onClose={() => setBio(false)} onDone={afterAuth} />
      <ForgotPinDialog open={forgot} onClose={() => setForgot(false)} />
    </Screen>
  );
}
