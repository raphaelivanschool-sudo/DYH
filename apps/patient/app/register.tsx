import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ME, type Address } from '@dyh/core';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Alert, Button, Card, DateField, Field, Header, Icon, Input, LinkText, ResultView, Rich, Row, Screen, SectionTitle, Segmented, Stepper, Txt, cx } from '@dyh/ui-native';
import { AddressFields, BloodPicker, NameFields, RelationPicker, SexField, type NameValue } from '../src/components/profile-form';
import { BioStep, OtpStep, PinCreate, useAfterAuth } from '../src/components/auth';
import { pm } from '../src/msgs';

const m = defineMessages('patient.register', {
  title: ['Bagong Pasyente', 'New Patient'],
  personal: ['Personal na Impormasyon', 'Personal Information'],
  verifyMobile: ['I-verify ang Mobile', 'Verify Mobile'],
  forNew: ['Para ito sa **hindi pa nakapagpakonsulta** sa DYH.', 'This is for those who have **never consulted** at DYH.'],
  haveRecord: ['May rekord na? I-link na lang', 'Have a record? Link it instead'],
  dp1: ["Alinsunod sa Data Privacy Act of 2012 (RA 10173), kinokolekta ng Dr. Yanga's Hospital ang iyong personal at medikal na impormasyon para lamang sa pagpaparehistro, pagpapareserba, rekord ng konsulta at serbisyo ng ospital.", "In accordance with the Data Privacy Act of 2012 (RA 10173), Dr. Yanga's Hospital collects your personal and medical information solely for registration, appointments, consultation records and hospital services."],
  dp2: ['May karapatan kang tingnan at itama ang iyong personal na impormasyon. Ang iyong rekord medikal ay makikita lamang ng mga awtorisadong doktor at staff.', 'You have the right to access and correct your personal information. Your medical record is visible only to authorized doctors and staff.'],
  agree: ['Nabasa ko at sumasang-ayon ako sa Data Privacy.', 'I have read and agree to the Data Privacy consent.'],
  checkNum: ['**Siguraduhing tama ang numero.** Dito ipapadala ang OTP, at ito ang gagamitin mo sa pag-login sa Patient App.', '**Make sure the number is correct.** OTPs are sent here, and you will use it to log in to the Patient App.'],
  address: ['Tirahan', 'Address'],
  allergyQ: ['May allergy ba?', 'Any allergies?'],
  none: ['Wala', 'None'],
  yes: ['Mayroon', 'Yes'],
  allergyPh: ['hal. Penicillin, hipon, mani', 'e.g. Penicillin, shrimp, peanuts'],
  sameForm: ['Pareho ang form na ito sa Kiosk para iisa ang rekord.', 'This form is the same as the Kiosk form so there is only one record.'],
  done: ['Tapos na ang Pagpaparehistro!', 'Registration Complete!'],
  yourId: ['Ito ang iyong ID ng Pasyente:', 'This is your Patient ID:'],
  oneId: ['Isang ID ng Pasyente = isang rekord medikal.', 'One Patient ID = one medical record.'],
});

export default function Register() {
  const t = useT(m);
  const p = useT(pm);
  const tc = useT(common);
  const afterAuth = useAfterAuth();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState<NameValue>({ last: 'Dela Cruz', first: 'Juan', middle: 'Santos', suffix: '' });
  const [bday, setBday] = useState('1981-03-14');
  const [sex, setSex] = useState<'M' | 'F'>('M');
  const [mobile, setMobile] = useState('0917 555 0142');
  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState<Address>({ regionCode: 'ncr', provinceCode: 'mm', cityCode: 'cal', barangay: 'Brgy. 171 (Bagumbong)' });
  const [blood, setBlood] = useState('O+');
  const [alg, setAlg] = useState<'no' | 'yes'>('no');
  const [algTxt, setAlgTxt] = useState('');
  const [ec, setEc] = useState({ name: 'Maria Dela Cruz', mobile: '0918 222 0193', rel: 'spouse' });
  const [otp, setOtp] = useState('482913');
  const labels = [tc('privacy'), t('personal'), t('verifyMobile'), p('createPin'), 'Fingerprint'];
  const back = () => (step === 1 ? router.back() : setStep(step - 1));

  if (step === 6)
    return (
      <Screen>
        <ResultView icon="check" title={t('done')} message={t('yourId')}>
          <Card className="mt-3 w-full flex-row items-center justify-center gap-2">
            <Icon name="id-card" size={22} color="blue" />
            <Txt w="x" size={22} style={{ letterSpacing: 1 }}>
              {ME.id}
            </Txt>
          </Card>
          <Txt size={12.5} className="mt-3 text-muted">
            {t('oneId')}
          </Txt>
          <Button size="lg" full icon="smartphone" className="mt-6" onPress={afterAuth}>
            {p('openApp')}
          </Button>
        </ResultView>
      </Screen>
    );

  return (
    <Screen header={<Header title={t('title')} icon="user-plus" onBack={back} />}>
      <Stepper total={5} current={step} label={labels[step - 1]} />
      {step === 1 && (
        <>
          <Alert icon="user-plus" className="mt-3">
            <Rich text={t('forNew')} size={13} className="mb-1 text-blue" />
            <LinkText onPress={() => router.replace('/link')}>{t('haveRecord')}</LinkText>
          </Alert>
          <Card className="mt-3">
            <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
              <Row>
                <Icon name="shield-check" size={18} color="blue" />
                <Txt w="b">{tc('privacy')}</Txt>
              </Row>
              <Txt size={13} className="mt-2 text-muted">
                {t('dp1')}
              </Txt>
              <Txt size={13} className="mt-2 text-muted">
                {t('dp2')}
              </Txt>
            </ScrollView>
          </Card>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} className="mt-4 flex-row items-start gap-2.5">
            <View className={cx('mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-md border-2', consent ? 'border-primary bg-primary' : 'border-line bg-field')}>
              {consent && <Icon name="check" size={15} color="#ffffff" strokeWidth={3} />}
            </View>
            <Txt w="s" className="flex-1">
              {t('agree')}
            </Txt>
          </Pressable>
        </>
      )}
      {step === 2 && (
        <>
          <NameFields value={name} onChange={setName} />
          <View className="flex-row gap-2">
            <Field label={tc('birthday')} icon="cake" className="flex-[1.6]">
              <DateField label={tc('birthday')} value={bday} onChange={setBday} />
            </Field>
          </View>
          <SexField value={sex} onChange={setSex} />
          <Field label={tc('mobile')} icon="smartphone">
            <Input value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
            <Alert kind="warn" className="mt-2" text={t('checkNum')} />
          </Field>
          <Field label="Email" icon="mail" optional>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="juan@email.com" />
          </Field>
          <SectionTitle icon="map-pin">{t('address')}</SectionTitle>
          <AddressFields value={addr} onChange={setAddr} />
          <BloodPicker value={blood} onChange={setBlood} />
          <Field label={t('allergyQ')} icon="triangle-alert">
            <Segmented value={alg} onChange={setAlg} options={[{ value: 'no', label: t('none') }, { value: 'yes', label: t('yes') }]} />
            {alg === 'yes' && <Input className="mt-2" placeholder={t('allergyPh')} value={algTxt} onChangeText={setAlgTxt} />}
          </Field>
          <Field label={tc('emergencyContact')} icon="phone-call">
            <Input placeholder={tc('name')} value={ec.name} onChangeText={(v) => setEc({ ...ec, name: v })} />
            <View className="mt-2 flex-row gap-2">
              <Input className="flex-1" keyboardType="phone-pad" value={ec.mobile} onChangeText={(v) => setEc({ ...ec, mobile: v })} />
              <View className="flex-1">
                <RelationPicker value={ec.rel} onChange={(v) => setEc({ ...ec, rel: v })} />
              </View>
            </View>
          </Field>
          <Alert className="mt-4" text={t('sameForm')} />
        </>
      )}
      {step === 3 && <OtpStep code="482913" value={otp} onChange={setOtp} />}
      {step === 4 && <PinCreate onDone={() => setStep(5)} />}
      {step === 5 && <BioStep onNext={() => setStep(6)} />}
      {step <= 3 && (
        <Row className="mt-6">
          {step > 1 && <Button variant="o" icon="chevron-left" accessibilityLabel={tc('back')} onPress={back} />}
          <Button size="lg" className="flex-1" disabled={(step === 1 && !consent) || (step === 3 && otp.length < 6)} icon={step === 3 ? 'shield-check' : undefined} iconRight={step === 3 ? undefined : 'chevron-right'} onPress={() => setStep(step + 1)}>
            {step === 3 ? p('verify') : tc('next')}
          </Button>
        </Row>
      )}
      {step === 4 && (
        <Button variant="o" full icon="chevron-left" className="mt-4" onPress={back}>
          {tc('back')}
        </Button>
      )}
    </Screen>
  );
}
