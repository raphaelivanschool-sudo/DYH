import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ME } from '@dyh/core';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, Center, DateField, Dialog, Field, Header, Icon, ListRow, ResultView, Row, Rows, Screen, Stepper, Txt } from '@dyh/ui-native';
import { BioStep, MASKED_MOBILE, OtpStep, PinCreate, useAfterAuth } from '../src/components/auth';
import { pm } from '../src/msgs';

const m = defineMessages('patient.link', {
  title: ['I-link ang Rekord', 'Link Record'],
  find: ['Hanapin ang Rekord', 'Find Record'],
  confirm: ['Kumpirmahin ang Rekord', 'Confirm Record'],
  forWho: ['Para sa **dati nang pasyente** o **nagparehistro sa Kiosk**. Hindi ka na gagawa ng bagong rekord.', 'For **existing patients** or those who **registered at the Kiosk**. No new record will be created.'],
  regMobile: ['Mobile number na nakarehistro sa ospital', 'Mobile number registered with the hospital'],
  regMobileNote: ['Ito ang numerong nakatala sa iyong rekord. Para sa seguridad, bahagi lamang ang ipinapakita at hindi ito mapapalitan sa app.', 'This is the number on your record. For security, only part of it is shown and it cannot be changed in the app.'],
  changed: ['Nagbago na ang mobile number mo?', 'Changed your mobile number?'],
  changedSub: ['Pumunta sa front desk at magdala ng valid ID para ma-update ang iyong numero at ma-link ang rekord.', 'Visit the front desk with a valid ID to update your number and link your record.'],
  found: ['May nakitang tugmang rekord.', 'A matching record was found.'],
  isThisYou: ['Ikaw ba ito?', 'Is this you?'],
  recs: ['Mga rekord', 'Records'],
  locked: ['Ang **nakarehistrong mobile number** ay naka-lock at hindi mapapalitan sa app. Para palitan, pumunta sa front desk na may valid ID.', 'The **registered mobile number** is locked and cannot be changed in the app. To change it, visit the front desk with a valid ID.'],
  verifyBday: ['I-verify: ilagay ang iyong kaarawan', 'Verify: enter your birthday'],
  notMe: ['Hindi ako ito', 'This is not me'],
  sendOtp: ['Ipadala ang OTP', 'Send OTP'],
  yesMe: ['Oo, ako ito', 'Yes, this is me'],
  linked: ['Na-link na ang Rekord!', 'Record Linked!'],
  linkedSub: ['Nakakonekta na ang app sa iyong rekord at kasaysayang medikal.', 'The app is now connected to your record and medical history.'],
  help: ['Humingi ng Tulong / Access', 'Request Assistance / Access'],
  helpBody: ['Naipadala ang iyong request. Pumunta sa **Front Desk (Unang Palapag, Pangunahing Lobby)** at magpakita ng valid ID para ma-verify at ma-link ang iyong rekord.', 'Your request was sent. Go to the **Front Desk (Ground Floor, Main Lobby)** with a valid ID to verify and link your record.'],
});

export default function LinkRecord() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const afterAuth = useAfterAuth();
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('735204');
  const [bday, setBday] = useState('1981-03-14');
  const [help, setHelp] = useState(false);
  const labels = [t('find'), 'OTP', t('confirm'), p('createPin'), 'Fingerprint'];
  const back = () => (step === 1 ? router.back() : setStep(step - 1));
  const recCount = p('consultations', { n: 3 });

  if (step === 6)
    return (
      <Screen>
        <ResultView icon="link" title={t('linked')} message={t('linkedSub')}>
          <Card className="mt-4 w-full py-1">
            <Rows rows={[['id-card', p('pid'), ME.id], ['user', tc('name'), ME.displayName], ['file-text', t('recs'), recCount]]} />
          </Card>
          <Button size="lg" full icon="smartphone" className="mt-6" onPress={afterAuth}>
            {p('openApp')}
          </Button>
        </ResultView>
      </Screen>
    );

  return (
    <Screen header={<Header title={t('title')} icon="link" onBack={back} />}>
      <Stepper total={5} current={step} label={labels[step - 1]} />
      {step === 1 && (
        <>
          <Alert kind="ok" icon="link" className="mt-3" text={t('forWho')} />
          <Field label={t('regMobile')} icon="smartphone">
            <Row className="rounded-xl border-[1.5px] border-line bg-soft px-3.5 py-3">
              <Txt w="b" className="text-muted">
                +63
              </Txt>
              <Txt w="b" size={18} className="flex-1" style={{ letterSpacing: 1 }}>
                {MASKED_MOBILE.replace(/^0/, '')}
              </Txt>
              <Icon name="lock" size={17} color="muted" />
            </Row>
            <Row gap="gap-1" className="mt-1 items-start">
              <Icon name="info" size={13} color="muted" />
              <Txt size={11.5} className="flex-1 text-muted">
                {t('regMobileNote')}
              </Txt>
            </Row>
          </Field>
          <Card className="mt-4">
            <Row>
              <Icon name="phone-off" size={17} color="ink" />
              <Txt w="b">{t('changed')}</Txt>
            </Row>
            <Txt size={12.5} className="mt-1 text-muted">
              {t('changedSub')}
            </Txt>
          </Card>
        </>
      )}
      {step === 2 && <OtpStep code="735204" value={otp} onChange={setOtp} pre={t('found')} />}
      {step === 3 && (
        <>
          <Center className="mt-4">
            <Avatar icon="user-search" size="xl" light />
            <Txt w="b" size={18} className="mt-3">
              {t('isThisYou')}
            </Txt>
          </Center>
          <Card className="mt-3 py-1">
            <Rows rows={[['user', tc('name'), 'Juan S. D*** C***'], ['id-card', p('pid'), 'DYH-2026-00••12'], ['map-pin', tc('city'), ME.city ?? ''], ['file-text', t('recs'), recCount]]} />
            <ListRow icon="smartphone" label="Mobile" last value={<Row gap="gap-1"><Txt w="b">{MASKED_MOBILE}</Txt><Icon name="lock" size={14} color="muted" /></Row>} />
          </Card>
          <Alert kind="warn" icon="lock" className="mt-3" text={t('locked')} />
          <Field label={t('verifyBday')} icon="cake">
            <DateField label={t('verifyBday')} value={bday} onChange={setBday} />
          </Field>
          <Button variant="o" full icon="user-x" className="mt-3" onPress={() => setHelp(true)}>
            {t('notMe')}
          </Button>
        </>
      )}
      {step === 4 && <PinCreate onDone={() => setStep(5)} />}
      {step === 5 && <BioStep onNext={() => setStep(6)} />}
      {step <= 3 && (
        <Row className="mt-6">
          {step > 1 && <Button variant="o" icon="chevron-left" accessibilityLabel={tc('back')} onPress={back} />}
          <Button size="lg" className="flex-1" disabled={step === 2 && otp.length < 6} icon={step === 1 ? 'send' : step === 2 ? 'shield-check' : 'check'} onPress={() => setStep(step + 1)}>
            {step === 1 ? t('sendOtp') : step === 2 ? p('verify') : t('yesMe')}
          </Button>
        </Row>
      )}
      {step === 4 && (
        <Button variant="o" full icon="chevron-left" className="mt-4" onPress={back}>
          {tc('back')}
        </Button>
      )}
      <Dialog open={help} onClose={() => setHelp(false)} title={t('help')} icon="hand-helping" actions={<Button className="flex-1" onPress={() => setHelp(false)}>{tc('ok')}</Button>}>
        <Alert icon="map-pin" text={t('helpBody')} />
        <Row className="mt-3" gap="gap-1.5">
          <Icon name="hash" size={15} color="muted" />
          <Txt size={12.5} className="text-muted">
            Reference No: HT-1030-0217
          </Txt>
        </Row>
        <View className="mt-1">
          <Badge tone="amber" icon="clock">
            {tc('st_pending')}
          </Badge>
        </View>
      </Dialog>
    </Screen>
  );
}
