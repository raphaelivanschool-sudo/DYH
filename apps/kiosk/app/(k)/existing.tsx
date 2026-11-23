import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, type KioskIdentifyInput } from '@dyh/api';
import { type Patient } from '@dyh/core';
import { useT } from '@dyh/i18n';
import { Alert, Button, Card, Icon, Txt, Viewfinder, cx, toast } from '@dyh/ui-native';
import { KPad, KResult, KTitle, go } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';
import { useKiosk } from '../../src/store';

/** "0917 555 0142" from raw digits. */
const fmtMobile = (d: string) => [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(' ');
const maskMobile = (d: string) => `${d.slice(0, 4)} ••• ${d.slice(-4)}`;

/** Existing patient: Record QR, or mobile number + OTP. */
export default function Existing() {
  const t = useT(km);
  const [code, setCode] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<0 | 1>(0);
  const [found, setFound] = useState<Patient | null>(null);
  const identify = useApiMutation((a, v: KioskIdentifyInput) => a.kioskIdentify(v));

  const done = (p?: Patient) => {
    if (!p) return;
    setFound(p);
    useKiosk.getState().set({ patient: { id: p.id, name: p.displayName, priority: p.priority } });
  };
  const sendOtp = async () => {
    const r = await identify.mutateAsync({ mobile: code });
    if (r.otpSent) {
      setOtp('');
      setStep(1);
    }
  };
  const verify = async () => {
    try {
      const r = await identify.mutateAsync({ mobile: code, otp });
      done(r.patient);
    } catch {
      toast.error(t('otpWrong'));
      setOtp('');
    }
  };
  const key = (n: string) => (step === 1 ? setOtp((o) => (o.length < 6 ? o + n : o)) : setCode((c) => (c.length < 11 ? c + n : c)));
  const del = () => (step === 1 ? setOtp((o) => o.slice(0, -1)) : setCode((c) => c.slice(0, -1)));

  if (found)
    return (
      <KPage>
        <KResult icon="user-check" color="#12805a" title={t('welcomeBack', { n: found.name.first })} body={`${found.displayName} · ${maskMobile(found.mobile.replace(/\D/g, ''))}\n${t('useRecord')}`}>
          <Button size="lg" icon="layout-grid" iconRight="chevron-right" className="mt-6 min-w-[320px]" onPress={() => go('/doctors')}>
            {t('chooseSpec')}
          </Button>
        </KResult>
      </KPage>
    );

  return (
    <KPage>
      <KTitle icon="user-search" title={t('haveRecord')} sub={t('haveSub')} />
      <View className="mt-5 flex-row items-stretch gap-5">
        <Card className="flex-1 p-6">
          <View className="flex-row items-center justify-center gap-2">
            <Icon name="qr-code" size={20} />
            <Txt w="b" size={18}>
              {t('scanQr')}
            </Txt>
          </View>
          <Txt size={13.5} className="mt-1 text-center text-muted">
            {t('openMyQr')}
          </Txt>
          <View className="mt-4">
            <Viewfinder height={290} label={t('holdQr')} />
          </View>
          <Button variant="g" size="lg" full icon="scan" className="mt-4" loading={identify.isPending && step === 0 && !code} onPress={async () => done((await identify.mutateAsync({ recordQr: 'demo-record-qr' })).patient)}>
            {t('simScan')}
          </Button>
        </Card>

        <View className="items-center justify-center">
          <View className="h-full w-[2px] bg-line" />
          <View className="absolute h-12 w-12 items-center justify-center rounded-full border border-line bg-card">
            <Txt w="b" size={14} className="text-muted">
              {t('or')}
            </Txt>
          </View>
        </View>

        <Card className="flex-1 p-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon name={step ? 'key-round' : 'smartphone'} size={20} />
              <Txt w="b" size={18}>
                {step ? t('enterOtp') : t('mobileNo')}
              </Txt>
            </View>
            <View className="flex-row gap-1">
              <View className="h-1.5 w-10 rounded-full bg-blue" />
              <View className={cx('h-1.5 w-10 rounded-full', step ? 'bg-blue' : 'bg-line')} />
            </View>
          </View>
          <Txt size={13.5} className="mt-1 text-muted">
            {step ? t('sentTo', { n: maskMobile(code) }) : t('mobileSub')}
          </Txt>
          {step ? (
            <View className="mt-3 flex-row gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} className={cx('h-[60px] flex-1 items-center justify-center rounded-2xl border-2', i < otp.length ? 'border-blue bg-sky' : 'border-line bg-card')}>
                  <Txt w="x" size={24}>
                    {otp[i] ?? ''}
                  </Txt>
                </View>
              ))}
            </View>
          ) : (
            <View className="mt-3 min-h-[60px] justify-center rounded-2xl border-2 border-line bg-card px-4">
              {code ? (
                <Txt w="x" size={26} style={{ letterSpacing: 2 }}>
                  {fmtMobile(code)}
                </Txt>
              ) : (
                <Txt size={20} className="text-muted">
                  09__ ___ ____
                </Txt>
              )}
            </View>
          )}
          <View className="mt-3">
            <KPad
              onKey={key}
              onDelete={del}
              left={
                step ? (
                  <Pressable
                    accessibilityLabel={t('changeNo')}
                    onPress={() => {
                      setStep(0);
                      setOtp('');
                    }}
                    className="h-[60px] items-center justify-center rounded-2xl border border-line bg-card"
                  >
                    <Icon name="undo-2" size={22} />
                  </Pressable>
                ) : null
              }
            />
          </View>
          {step ? (
            <>
              <Button size="lg" full icon="shield-check" className="mt-3" disabled={otp.length !== 6} loading={identify.isPending} onPress={verify}>
                {t('verify')}
              </Button>
              <Txt size={13} className="mt-2 text-center text-muted">
                {t('notReceived')}{' '}
                <Txt w="b" size={13} className="text-blue" onPress={sendOtp}>
                  {t('resend')}
                </Txt>
              </Txt>
            </>
          ) : (
            <Button size="lg" full icon="send" className="mt-3" disabled={code.length !== 11} loading={identify.isPending} onPress={sendOtp}>
              {t('sendOtp')}
            </Button>
          )}
        </Card>
      </View>
      <Alert kind="info" icon="hand-helping" className="mt-5" text={t('askDesk')} />
    </KPage>
  );
}
