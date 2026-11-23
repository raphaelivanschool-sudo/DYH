/**
 * Building blocks shared by the staff apps (Doctor and Secretary):
 * staff login + forgot-password flow, identity check (PIN / fingerprint),
 * vital signs, month calendar, simple bar charts and display settings.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DAY_SHORT, MONTH_LONG, bmi, daysInMonth, toISO, vitalFlags, type ISODate, type Vitals } from '@dyh/core';

import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { authenticateBiometric } from './extras';
import { Field, Input, OtpBoxes, Segmented, Toggle } from './form';
import { Icon } from './icon';
import { Dialog } from './overlay';
import { Keypad, PinDots } from './pin';
import { Alert, Avatar, Badge, Button, Card, Gradient, IconButton, LinkText, ListRow, Logo, Row, cx } from './primitives';
import { Rich, Txt } from './text';
import { useColors, usePrefs } from './theme';

export const staffMsgs = defineMessages('staff', {
  login: ['Mag-login', 'Log In'],
  loginSub: ['Gamitin ang iyong staff account mula sa Admin.', 'Use the staff account issued by the Admin.'],
  emailOrId: ['Email o Staff ID', 'Email or Staff ID'],
  password: ['Password', 'Password'],
  show: ['Ipakita', 'Show'],
  withBio: ['Mag-login gamit ang Fingerprint', 'Log In with Fingerprint'],
  forgotPw: ['Nakalimutan ang password?', 'Forgot password?'],
  acctNote: ['Ang account ay ginagawa ng Admin ng ospital. Awtomatikong lalabas pagkatapos ng {{n}} minutong walang galaw.', 'Accounts are created by the hospital Admin. You are logged out automatically after {{n}} minutes of inactivity.'],
  fpStep0: ['Ilagay ang iyong email o Staff ID. Magpapadala kami ng OTP sa iyong rehistradong mobile number para ma-verify ka.', 'Enter your email or Staff ID. We will send an OTP to your registered mobile number to verify you.'],
  sendOtp: ['Ipadala ang OTP', 'Send OTP'],
  otpTitle: ['Ilagay ang OTP', 'Enter the OTP'],
  otpSent: ['Nagpadala kami ng 6-digit na code sa', 'We sent a 6-digit code to'],
  notReceived: ['Hindi natanggap?', 'Did not receive it?'],
  resend: ['Ipadala ulit (0:45)', 'Resend (0:45)'],
  verify: ['I-verify', 'Verify'],
  toAdmin: ['Ipadala ang request sa Admin', 'Send request to Admin'],
  numVerified: ['Na-verify ang iyong numero.', 'Your number is verified.'],
  msgAdmin: ['Mensahe sa Admin', 'Message to Admin'],
  msgAdminPh: ['hal. Nakalimutan ko ang password ko.', 'e.g. I forgot my password.'],
  sendAdmin: ['Ipadala sa Admin', 'Send to Admin'],
  reqSent: ['Naipadala ang Request', 'Request Sent'],
  reqSentBody: ['Natanggap ng Admin ang iyong request. Hintayin ang email mula sa Admin na may link para mag-reset ng password.', 'The Admin has received your request. Please wait for an email from the Admin with a link to reset your password.'],
  verifyTitle: ['I-verify ang iyong pagkakakilanlan', 'Verify your identity'],
  enterPin: ['Ilagay ang iyong 6-digit na PIN', 'Enter your 6-digit PIN'],
  orFinger: ['o pindutin ang fingerprint', 'or tap the fingerprint'],
  bioTitle: ['Fingerprint / Face ID', 'Fingerprint / Face ID'],
  bioPrompt: ['Ilapat ang iyong daliri sa sensor o tumingin sa camera.', 'Place your finger on the sensor or look at the camera.'],
  pulse: ['Pulso', 'Pulse'],
  weight: ['Timbang', 'Weight'],
  height: ['Taas', 'Height'],
  vitalsToday: ['Vital Signs Ngayon', 'Vital Signs Today'],
  noVitals: ['Wala pang vital signs na naitala ng sekretarya ngayong araw.', 'No vital signs recorded by the secretary today.'],
  chief: ['Pangunahing reklamo', 'Chief complaint'],
  sec: ['Sek.', 'Sec.'],
  prevMonth: ['Nakaraang buwan', 'Previous month'],
  nextMonth: ['Susunod na buwan', 'Next month'],
  clinicDay: ['May clinic', 'Clinic day'],
  noClinicPast: ['Walang clinic / lumipas na', 'No clinic / past'],
  blocked: ['Naka-block', 'Blocked'],
  scanTitle: ['I-scan ang QR ng Pasyente', 'Scan Patient QR'],
  scanPoint: ['Itapat sa QR sa app ng pasyente', 'Point at the QR in the patient app'],
  scanConsent: ['Ang QR ng pasyente ang nagsisilbing pahintulot. Nakatala ang bawat pagbukas sa Audit Logs.', 'The patient QR serves as consent. Every access is recorded in Audit Logs.'],
  simScan: ['Subukang I-scan', 'Simulate Scan'],
  display: ['Itsura at Wika', 'Display & Language'],
  bigText: ['Mas Malaking Text', 'Larger Text'],
  hide: ['Itago', 'Hide'],
  showAll: ['Ipakita', 'Show'],
  correct: ['Tama', 'Correct'],
  selectAll: ['Piliin Lahat', 'Select All'],
  clearAll: ['Alisin Lahat', 'Clear All'],
});

/* ---------------- Login ---------------- */

/** Staff login screen (Doctor / Secretary). Accounts come from the Admin portal. */
export function StaffLogin({ appLabel, icon, email: defaultEmail, autoLogoutMin, onLogin, maskedMobile }: { appLabel: string; icon: string; email: string; autoLogoutMin: number; onLogin: (how: { email: string; password: string } | 'bio') => Promise<void> | void; maskedMobile: string }) {
  const t = useT(staffMsgs);
  const tc = useT(common);
  const { lang, setLang } = usePrefs((s) => s);
  const [email, setEmail] = useState(defaultEmail);
  const [pw, setPw] = useState('password123');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const [forgot, setForgot] = useState(false);
  const run = async (how: Parameters<typeof onLogin>[0]) => {
    setBusy(true);
    try {
      await onLogin(how);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-scr">
      <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        <Gradient colors={['#2d6cdf', '#17325f', '#0f2447']} className="mx-3 overflow-hidden rounded-[30px] px-5 pb-[80px] pt-4">
          <View className="absolute -right-10 -top-10 h-44 w-44 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <Row className="justify-between">
            <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Icon name={icon} size={14} color="#ffffff" />
              <Txt w="b" size={12} className="text-white">
                {appLabel}
              </Txt>
            </View>
            <Segmented size="sm" className="w-[158px]" value={lang} onChange={setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
          </Row>
          <View className="mt-6 items-center">
            <Logo height={66} light />
            <Txt w="s" size={12.5} className="mt-2 text-white" style={{ opacity: 0.85 }}>
              {tc('tagline')}
            </Txt>
          </View>
        </Gradient>
        <View className="-mt-[56px] px-[18px]">
          <Card lift>
            <Row>
              <Icon name="log-in" size={20} color="blue" />
              <Txt w="b" size={18}>
                {t('login')}
              </Txt>
            </Row>
            <Txt size={12.5} className="mt-1 text-muted">
              {t('loginSub')}
            </Txt>
            <Field label={t('emailOrId')} icon="mail">
              <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" accessibilityLabel={t('emailOrId')} />
            </Field>
            <Field label={t('password')} icon="lock">
              <View>
                <Input value={pw} onChangeText={setPw} secureTextEntry={!show} accessibilityLabel={t('password')} className="pr-12" />
                <View className="absolute bottom-0 right-1 top-0 justify-center">
                  <IconButton icon={show ? 'eye-off' : 'eye'} size="sm" label={t('show')} onPress={() => setShow(!show)} className="bg-transparent" />
                </View>
              </View>
            </Field>
            <Button variant="n" size="lg" full icon="log-in" className="mt-4" loading={busy} onPress={() => run({ email, password: pw })}>
              {t('login')}
            </Button>
            <Button variant="o" full icon="fingerprint" className="mt-2" onPress={() => setBio(true)}>
              {t('withBio')}
            </Button>
            <View className="mt-3 items-center">
              <LinkText icon="circle-help" onPress={() => setForgot(true)}>
                {t('forgotPw')}
              </LinkText>
            </View>
          </Card>
          <Alert kind="info" icon="shield-check" className="mt-4" text={t('acctNote', { n: autoLogoutMin })} />
        </View>
      </ScrollView>
      <BioLoginDialog
        open={bio}
        onClose={() => setBio(false)}
        onOk={() => {
          setBio(false);
          void run('bio');
        }}
      />
      <StaffForgotDialog open={forgot} onClose={() => setForgot(false)} email={defaultEmail} maskedMobile={maskedMobile} />
    </SafeAreaView>
  );
}

function BioLoginDialog({ open, onClose, onOk }: { open: boolean; onClose: () => void; onOk: () => void }) {
  const t = useT(staffMsgs);
  const tc = useT(common);
  const scan = async () => {
    if (await authenticateBiometric(t('bioPrompt'))) onOk();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('bioTitle')}
      icon="fingerprint"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button className="flex-1" icon="scan-face" onPress={scan}>
            {tc('simulate')}
          </Button>
        </>
      }
    >
      <View className="items-center">
        <Avatar icon="fingerprint" size="xl" light />
        <Txt className="mt-3 text-center text-muted">{t('bioPrompt')}</Txt>
      </View>
    </Dialog>
  );
}

/** Forgot password: email → OTP to registered mobile → request to Admin → reference number. */
export function StaffForgotDialog({ open, onClose, email, maskedMobile }: { open: boolean; onClose: () => void; email: string; maskedMobile: string }) {
  const t = useT(staffMsgs);
  const tc = useT(common);
  const [step, setStep] = useState(0);
  const [em, setEm] = useState(email);
  const [otp, setOtp] = useState('519274');
  const [msg, setMsg] = useState('');
  const close = () => {
    setStep(0);
    onClose();
  };
  const dots = (
    <Row gap="gap-1.5">
      {[0, 1, 2].map((i) => (
        <View key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-soft')} />
      ))}
    </Row>
  );
  const head = [t('forgotPw'), t('otpTitle'), t('toAdmin'), t('reqSent')][step];
  const icon = ['key-round', 'message-square-lock', 'send', 'mail-check'][step];
  const actions = [
    [
      <Button key="a" variant="o" className="flex-1" onPress={close}>
        {tc('cancel')}
      </Button>,
      <Button key="b" className="flex-1" icon="send" onPress={() => setStep(1)}>
        {t('sendOtp')}
      </Button>,
    ],
    [
      <Button key="a" variant="o" className="flex-1" icon="chevron-left" onPress={() => setStep(0)}>
        {tc('back')}
      </Button>,
      <Button key="b" className="flex-1" icon="shield-check" disabled={otp.length < 6} onPress={() => setStep(2)}>
        {t('verify')}
      </Button>,
    ],
    [
      <Button key="a" variant="o" className="flex-1" onPress={close}>
        {tc('cancel')}
      </Button>,
      <Button key="b" className="flex-1" icon="send" onPress={() => setStep(3)}>
        {t('sendAdmin')}
      </Button>,
    ],
    [
      <Button key="b" className="flex-1" icon="check" onPress={close}>
        {tc('ok')}
      </Button>,
    ],
  ][step];
  return (
    <Dialog open={open} onClose={close} title={head} icon={icon} actions={actions}>
      {step < 3 && dots}
      {step === 0 && (
        <>
          <Txt className="mt-3 text-muted">{t('fpStep0')}</Txt>
          <Field label={t('emailOrId')} icon="mail">
            <Input value={em} onChangeText={setEm} autoCapitalize="none" accessibilityLabel={t('emailOrId')} />
          </Field>
        </>
      )}
      {step === 1 && (
        <>
          <Txt className="mt-3 text-center text-muted">
            {t('otpSent')}{' '}
            <Txt w="b" className="text-ink">
              {maskedMobile}
            </Txt>
          </Txt>
          <OtpBoxes value={otp} onChange={setOtp} />
          <Txt size={12.5} className="mt-3 text-center text-muted">
            {t('notReceived')}{' '}
            <Txt w="b" size={12.5} className="text-blue">
              {t('resend')}
            </Txt>
          </Txt>
        </>
      )}
      {step === 2 && (
        <>
          <Alert kind="ok" icon="shield-check" className="mt-3" text={t('numVerified')} />
          <Field label="Email" icon="mail">
            <Input value={em} editable={false} accessibilityLabel="Email" />
          </Field>
          <Field label={t('msgAdmin')} icon="message-square" optional>
            <Input value={msg} onChangeText={setMsg} multiline placeholder={t('msgAdminPh')} accessibilityLabel={t('msgAdmin')} />
          </Field>
        </>
      )}
      {step === 3 && (
        <>
          <View className="items-center">
            <Avatar icon="mail-check" size="xl" color="#12805a" />
          </View>
          <Txt className="mt-4 text-center text-muted">{t('reqSentBody')}</Txt>
          <Alert kind="info" icon="hash" className="mt-3" text="Reference No: PW-1031-0042" />
        </>
      )}
    </Dialog>
  );
}

/* ---------------- Identity check ---------------- */

/** PIN keypad + fingerprint, required before opening a record or reports. */
export function VerifyDialog({ open, onClose, onOk, children }: { open: boolean; onClose: () => void; onOk: () => void; children?: ReactNode }) {
  const t = useT(staffMsgs);
  const tc = useT(common);
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (!open) setPin('');
  }, [open]);
  const ok = () => {
    setPin('');
    onOk();
  };
  const key = (d: string) => {
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length === 6) setTimeout(ok, 120);
  };
  const bio = async () => {
    if (await authenticateBiometric(t('bioPrompt'))) ok();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('verifyTitle')}
      icon="shield-check"
      actions={
        <Button variant="o" full icon="x" onPress={onClose}>
          {tc('cancel')}
        </Button>
      }
    >
      {children}
      <Txt w="b" className="mt-4 text-center">
        {t('enterPin')}
      </Txt>
      <PinDots value={pin} />
      <Keypad className="mt-3.5" onKey={key} onDelete={() => setPin(pin.slice(0, -1))} onBio={bio} />
      <Txt size={12.5} className="mt-3 text-center text-muted">
        {t('orFinger')}
      </Txt>
    </Dialog>
  );
}

/** Camera viewfinder placeholder for scanning the patient's record QR. */
export function ScanQrDialog({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: () => void }) {
  const t = useT(staffMsgs);
  const tc = useT(common);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('scanTitle')}
      icon="scan-qr-code"
      actions={
        <>
          <Button variant="o" className="flex-1" icon="x" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button className="flex-1" icon="scan" onPress={onScan}>
            {t('simScan')}
          </Button>
        </>
      }
    >
      <Viewfinder label={t('scanPoint')} />
      <Alert kind="info" icon="shield-check" className="mt-3" text={t('scanConsent')} />
    </Dialog>
  );
}

export function Viewfinder({ label, height = 260, children }: { label?: string; height?: number; children?: ReactNode }) {
  return (
    <View className="items-center justify-center overflow-hidden rounded-[20px]" style={{ height, backgroundColor: '#0f2447' }}>
      {children ?? <View className="h-[150px] w-[150px] rounded-[22px] border-[3px]" style={{ borderColor: '#7fb0ff' }} />}
      {!children && <View className="absolute h-[2px] w-[170px]" style={{ backgroundColor: '#7fb0ff', opacity: 0.8 }} />}
      {label && (
        <Txt size={12.5} className="absolute bottom-3" style={{ color: '#c9d6ee' }}>
          {label}
        </Txt>
      )}
    </View>
  );
}

/* ---------------- Vital signs ---------------- */

export function VitalsGrid({ v, compact, dark }: { v: Vitals; compact?: boolean; dark?: boolean }) {
  const t = useT(staffMsgs);
  const f = vitalFlags(v);
  const all: [string, string, string | number | undefined, string, boolean?][] = [
    ['heart-pulse', 'BP', v.bp, 'mmHg', f.bp],
    ['activity', t('pulse'), v.hr, 'bpm'],
    ['thermometer', 'Temp', v.temp, '°C', f.temp],
    ['wind', 'RR', v.rr, '/min'],
    ['droplets', 'SpO₂', v.o2, '%', f.o2],
    ['weight', t('weight'), v.wt, 'kg'],
    ['ruler', t('height'), v.ht, 'cm'],
    ['calculator', 'BMI', bmi(v), ''],
  ];
  const items = compact ? all.filter((_, i) => [0, 1, 2, 5].includes(i)) : all;
  return (
    <View className="mt-2 flex-row flex-wrap justify-between gap-y-1.5">
      {items.map(([i, l, val, u, hi]) => (
        <View
          key={l}
          className={cx('w-[24%] rounded-xl p-2', !dark && 'border', !dark && (hi ? 'border-red bg-red-bg' : 'border-line bg-soft'))}
          style={dark ? { backgroundColor: hi ? 'rgba(224,74,85,0.35)' : 'rgba(255,255,255,0.12)' } : undefined}
        >
          <Row gap="gap-1">
            <Icon name={i} size={12} color={dark ? '#ffffffcc' : hi ? 'red' : 'muted'} />
            <Txt size={10} className={dark ? 'text-white' : hi ? 'text-red' : 'text-muted'} numberOfLines={1}>
              {l}
            </Txt>
          </Row>
          <Txt w="x" size={14} className={dark ? 'text-white' : hi ? 'text-red' : 'text-ink'}>
            {val ?? '—'}
          </Txt>
          <Txt size={9.5} className={dark ? 'text-white' : 'text-muted'} style={dark ? { opacity: 0.75 } : undefined}>
            {val ? u : ' '}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function VitalsCard({ v, title, className }: { v?: Vitals; title?: string; className?: string }) {
  const t = useT(staffMsgs);
  const loc = useLoc();
  if (!v)
    return (
      <Card className={cx('mt-3 flex-row items-center gap-2.5 border-dashed', className)}>
        <Icon name="heart-pulse" size={18} color="muted" />
        <Txt size={12.5} className="flex-1 text-muted">
          {t('noVitals')}
        </Txt>
      </Card>
    );
  const cc = typeof v.chiefComplaint === 'string' ? v.chiefComplaint : loc(v.chiefComplaint);
  return (
    <Card className={cx('mt-3', className)}>
      <Row className="justify-between">
        <Row gap="gap-1.5">
          <Icon name="heart-pulse" size={15} color="red" />
          <Txt w="b" size={13}>
            {title ?? t('vitalsToday')}
          </Txt>
        </Row>
        <Txt size={11} className="text-muted">
          {t('sec')} {v.recordedBy} · {v.recordedAt}
        </Txt>
      </Row>
      <VitalsGrid v={v} />
      {!!cc && (
        <Txt size={12.5} className="mt-2">
          <Txt size={12.5} className="text-muted">
            {t('chief')}:{' '}
          </Txt>
          <Txt w="b" size={12.5}>
            {cc}
          </Txt>
        </Txt>
      )}
    </Card>
  );
}

/* ---------------- Month calendar ---------------- */

export type DayKind = 'ok' | 'dis' | 'blk';

/** Month grid with clinic / unavailable / blocked days (follow-up booking). */
export function MonthCalendar({ year, month0, kind, selected, onSelect, today, canPrev, canNext, onPrev, onNext, legend }: { year: number; month0: number; kind: (d: ISODate) => DayKind; selected?: ISODate | null; onSelect: (d: ISODate) => void; today?: ISODate; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; legend?: [DayKind, string][] }) {
  const t = useT(staffMsgs);
  const [lang] = useLang();
  const c = useColors();
  const first = new Date(year, month0, 1).getDay();
  const n = daysInMonth(year, month0);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const lg = legend ?? [['ok', t('clinicDay')], ['dis', t('noClinicPast')], ['blk', t('blocked')]];
  const sw: Record<DayKind, string> = { ok: c.blue2, dis: c.line, blk: c.red };
  return (
    <Card>
      <Row className="justify-between">
        <View style={{ opacity: canPrev ? 1 : 0.35 }}>
          <IconButton icon="chevron-left" size="sm" label={t('prevMonth')} onPress={canPrev ? onPrev : undefined} />
        </View>
        <Txt w="b" size={16}>
          {MONTH_LONG[lang][month0]} {year}
        </Txt>
        <View style={{ opacity: canNext ? 1 : 0.35 }}>
          <IconButton icon="chevron-right" size="sm" label={t('nextMonth')} onPress={canNext ? onNext : undefined} />
        </View>
      </Row>
      <View className="mt-3 flex-row flex-wrap">
        {DAY_SHORT[lang].map((d) => (
          <View key={d} className="w-[14.28%] items-center pb-1">
            <Txt w="b" size={11} className="text-muted">
              {d.slice(0, 2)}
            </Txt>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={i} className="aspect-square w-[14.28%]" />;
          const iso = toISO(year, month0, d);
          const k = kind(iso);
          const on = selected === iso;
          return (
            <View key={i} className="aspect-square w-[14.28%] p-[3px]">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={iso}
                disabled={k !== 'ok'}
                onPress={() => onSelect(iso)}
                className={cx('flex-1 items-center justify-center rounded-[10px]', on ? 'bg-primary' : k === 'ok' ? 'bg-sky' : k === 'blk' ? 'bg-red-bg' : '', iso === today && !on && 'border-[1.5px] border-blue')}
              >
                <Txt w={k === 'ok' || on ? 'b' : 'm'} size={13} className={on ? 'text-white' : k === 'ok' ? 'text-blue' : k === 'blk' ? 'text-red' : 'text-muted'} style={k === 'dis' && !on ? { opacity: 0.55 } : undefined}>
                  {d}
                </Txt>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Row className="mt-3 flex-wrap" gap="gap-3">
        {lg.map(([k, l]) => (
          <Row key={k} gap="gap-1.5">
            <View className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: sw[k] }} />
            <Txt size={11} className="text-muted">
              {l}
            </Txt>
          </Row>
        ))}
      </Row>
    </Card>
  );
}

/* ---------------- Charts ---------------- */

/** Vertical bars, optionally stacked ("vbars" / "sbars"). Parts stack bottom-up. */
export function VBars({ rows, height = 130, showTotal = true }: { rows: { label: string; parts: { value: number; color: string }[] }[]; height?: number; showTotal?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  const area = height - 40;
  return (
    <View className="flex-row items-end justify-around" style={{ height }}>
      {rows.map((r) => {
        const tot = r.parts.reduce((a, p) => a + p.value, 0);
        return (
          <View key={r.label} className="flex-1 items-center">
            {showTotal && (
              <Txt w="b" size={11}>
                {tot}
              </Txt>
            )}
            <View className="mt-1 w-[60%] max-w-[34px] overflow-hidden rounded-t-[7px]" style={{ flexDirection: 'column-reverse' }}>
              {r.parts.map((p, i) => (
                <View key={i} style={{ height: (p.value / max) * area, backgroundColor: p.color }} />
              ))}
            </View>
            <Txt size={10.5} className="mt-1 text-muted" numberOfLines={1}>
              {r.label}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/** Label + value row with a progress bar underneath. */
export function MeterRow({ label, value, pct, color, right }: { label: string; value: ReactNode; pct: number; color?: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View className="mt-3">
      <Row className="justify-between">
        <Txt size={13} className="flex-1" numberOfLines={1}>
          {label}
        </Txt>
        <Txt w="b" size={13}>
          {value}
          {right}
        </Txt>
      </Row>
      <View className="mt-1 h-2 overflow-hidden rounded-full bg-soft">
        <View className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color ?? c.blue2 }} />
      </View>
    </View>
  );
}

export function ChartLegend({ items }: { items: [string, string][] }) {
  return (
    <Row className="flex-wrap" gap="gap-3.5">
      {items.map(([l, col]) => (
        <Row key={l} gap="gap-1.5">
          <View className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: col }} />
          <Txt size={12} className="text-muted">
            {l}
          </Txt>
        </Row>
      ))}
    </Row>
  );
}

/* ---------------- Misc ---------------- */

/** Collapsible section header ("collhd"). */
export function Collapsible({ icon, title, badge, open, onToggle, children }: { icon: string; title: string; badge?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  const t = useT(staffMsgs);
  return (
    <>
      <Pressable accessibilityRole="button" onPress={onToggle} className="mt-4 flex-row items-center justify-between rounded-2xl border border-line bg-card px-4 py-3.5">
        <Row>
          <Icon name={icon} size={18} color="blue" />
          <Txt w="b">{title}</Txt>
          {badge}
        </Row>
        <Row gap="gap-1">
          <Txt size={12.5} className="text-muted">
            {open ? t('hide') : t('showAll')}
          </Txt>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="muted" />
        </Row>
      </Pressable>
      {open && <View className="mt-2">{children}</View>}
    </>
  );
}

/** "Correct" check chip next to an AI- or secretary-filled field. */
export function CheckTag({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useT(staffMsgs);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onToggle} className={cx('flex-row items-center gap-1 rounded-full px-2 py-[3px]', on ? 'bg-green-bg' : 'bg-soft')}>
      <Icon name={on ? 'square-check' : 'square'} size={14} color={on ? 'green' : 'muted'} />
      <Txt w="b" size={11} className={on ? 'text-green' : 'text-muted'}>
        {t('correct')}
      </Txt>
    </Pressable>
  );
}

/** Progress bar for per-field checks, with Select all / Clear all. */
export function CheckBar({ title, sub, done, total, onAll, onClear }: { title: string; sub: string; done: number; total: number; onAll: () => void; onClear: () => void }) {
  const t = useT(staffMsgs);
  const all = done === total;
  return (
    <View className={cx('mt-3 flex-row items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3', all ? 'border-green bg-green-bg' : 'border-amber bg-amber-bg')}>
      <View className="flex-1">
        <Row gap="gap-1.5">
          <Icon name={all ? 'circle-check' : 'list-checks'} size={16} color={all ? 'green' : 'amber'} />
          <Txt w="b" size={12.5} className="flex-1">
            {title}
          </Txt>
        </Row>
        <Txt size={11} className="mt-1 text-muted">
          {done}/{total} {sub}
        </Txt>
      </View>
      <Button size="sm" variant={all ? 'o' : 'g'} icon={all ? 'square' : 'check-check'} onPress={all ? onClear : onAll}>
        {all ? t('clearAll') : t('selectAll')}
      </Button>
    </View>
  );
}

/** Language, dark mode and larger text rows (staff settings). */
export function DisplaySettings() {
  const t = useT(staffMsgs);
  const tc = useT(common);
  const prefs = usePrefs((p) => p);
  return (
    <Card className="px-4 py-1">
      <ListRow icon="languages">
        <Txt w="b" className="flex-1">
          {tc('language')}
        </Txt>
        <Segmented size="sm" className="w-[170px]" value={prefs.lang} onChange={prefs.setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
      </ListRow>
      <ListRow icon="moon">
        <Txt w="b" className="flex-1">
          {tc('darkMode')}
        </Txt>
        <Toggle label={tc('darkMode')} value={prefs.theme === 'dark'} onChange={(v) => prefs.setTheme(v ? 'dark' : 'light')} />
      </ListRow>
      <ListRow icon="a-large-small" last>
        <Txt w="b" className="flex-1">
          {t('bigText')}
        </Txt>
        <Toggle label={t('bigText')} value={prefs.bigText} onChange={prefs.setBigText} />
      </ListRow>
    </Card>
  );
}

/** Small "badge + count" used in drawer and headers. */
export const CountBadge = ({ n, tone = 'blue' }: { n: number; tone?: 'blue' | 'amber' | 'purple' | 'gray' | 'red' }) => <Badge tone={tone}>{n}</Badge>;

/** Rich text helper re-export for staff screens. */
export { Rich };
