import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useApi, useSettings } from '@dyh/api';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Logo, Rich } from '@/components/ui/display';
import { Field, Input, Segmented } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/store/prefs';

const m = defineMessages('admin.login', {
  feat1: ['Live na pagbabantay ng OPD', 'Live OPD monitoring'],
  feat2: ['AI analytics at hula', 'AI analytics & forecasts'],
  feat3: ['Pamamahala ng account at klinika', 'Account & clinic management'],
  feat4: ['Ligtas at may audit log', 'Secure with audit logs'],
  forAdmins: ['Para sa administrador ng ospital lamang.', 'For hospital administrators only.'],
  alsoDoctor: ['Doktor ka rin? Gamitin ang **hiwalay na Admin login** mo. Hindi gagana rito ang password ng Doctor App.', 'Also a doctor? Use your **separate Admin login**. Your Doctor App password does not work here.'],
  password: ['Password', 'Password'],
  autoLogout: ['Awtomatikong lalabas pagkatapos ng {{n}} minutong walang galaw. Nakatala ang bawat pag-login sa Audit Logs.', 'You are logged out after {{n}} minutes of inactivity. Every login is recorded in the Audit Logs.'],
  failed: ['Mali ang email o password.', 'Incorrect email or password.'],
  fpTitle: ['Nakalimutan ang password?', 'Forgot password?'],
  fpIntro: ['Magpapadala kami ng OTP sa rehistradong mobile number ng admin account.', 'We will send an OTP to the mobile number registered to the admin account.'],
  sendOtp: ['Ipadala ang OTP', 'Send OTP'],
  verify: ['I-verify', 'Verify'],
  newPw: ['Gumawa ng bagong password', 'Create a new password'],
  newPwL: ['Bagong password', 'New password'],
  confirmPw: ['Ulitin ang password', 'Confirm password'],
  pwRule: ['Hindi bababa sa 8 karakter, may numero at titik.', 'At least 8 characters with letters and numbers.'],
  pwDone: ['Napalitan ang password', 'Password changed'],
  pwDoneBody: ['Puwede ka nang mag-login gamit ang bagong password.', 'You can now log in with your new password.'],
  pwMismatch: ['Hindi magkatugma o kulang sa 8 karakter.', 'Passwords do not match or are under 8 characters.'],
  splashTag: ['Quality Healthcare Close to Home', 'Quality Healthcare Close to Home'],
});

export function Splash() {
  const nav = useNavigate();
  useEffect(() => {
    const id = setTimeout(() => nav('/login', { replace: true }), 2400);
    return () => clearTimeout(id);
  }, [nav]);
  return (
    <button type="button" onClick={() => nav('/login', { replace: true })} className="bg-splash relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-white">
      <div className="wdeco" />
      <span className="anim-grow absolute size-[340px] rounded-full border-2 border-white/25" />
      <span className="anim-grow-2 absolute size-[340px] rounded-full border-2 border-white/25" />
      <div className="anim-pop relative">
        <Logo height={110} light />
      </div>
      <div className="anim-fadeup relative mt-5 text-[18px] font-semibold">Quality Healthcare Close to Home</div>
      <div className="relative mt-8 h-1 w-40 overflow-hidden rounded-full bg-white/20">
        <i className="anim-load block h-full rounded-full bg-white" />
      </div>
      <div className="absolute bottom-8 text-[11px] font-bold tracking-[.18em] text-white/70">ADMIN PORTAL · v1.0</div>
    </button>
  );
}

export function Login() {
  const t = useT(m);
  const tc = useT(common);
  const api = useApi();
  const nav = useNavigate();
  const { lang, setLang, setSession } = usePrefs();
  const { data: settings } = useSettings();
  const [email, setEmail] = useState('admin@dyh.ph');
  const [pw, setPw] = useState('password123');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fp, setFp] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setSession(await api.login('admin', { id: email, secret: pw }));
      nav('/dashboard', { replace: true });
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full grid-cols-[1.05fr_1fr] max-lg:grid-cols-1">
      <div className="bg-hero relative overflow-hidden px-14 py-12 text-white max-lg:hidden">
        <div className="wdeco" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold">
            <Icon name="monitor" size={15} />
            Admin Portal
          </span>
          <div className="mt-6">
            <Logo height={92} light />
          </div>
          <div className="mt-3 text-[20px] font-semibold">{t('splashTag')}</div>
          <div className="mt-6 flex flex-col gap-3">
            {(
              [
                ['layout-dashboard', 'feat1'],
                ['sparkles', 'feat2'],
                ['user-cog', 'feat3'],
                ['shield-check', 'feat4'],
              ] as const
            ).map(([i, k]) => (
              <div key={k} className="flex items-center gap-3 font-semibold">
                <span className="grid size-10 place-items-center rounded-xl bg-white/15">
                  <Icon name={i} size={19} />
                </span>
                {t(k)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid place-items-center bg-pattern p-6">
        <form onSubmit={submit} className="w-[400px] max-w-full rounded-[18px] border border-line bg-card p-6 shadow-lift">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-[22px]">
              <Icon name="log-in" size={22} className="text-blue" />
              {tc('login')}
            </h1>
            <Segmented
              size="sm"
              className="w-[160px]"
              value={lang}
              onChange={setLang}
              options={[
                { value: 'tl', label: 'Tagalog' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <p className="mt-1 text-[12.5px] text-muted">{t('forAdmins')}</p>
          <Alert icon="key-round" className="mt-3">
            <Rich text={t('alsoDoctor')} />
          </Alert>
          <Field label="Email" icon="mail" id="em" className="mt-4">
            <Input id="em" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t('password')} icon="lock" id="pw">
            <div className="relative">
              <Input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required className="pr-11" />
              <button type="button" onClick={() => setShow(!show)} aria-label="Show password" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon name={show ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          </Field>
          <Button type="submit" variant="n" size="lg" icon="log-in" className="mt-5 w-full" disabled={busy}>
            {tc('login')}
          </Button>
          <div className="mt-3 text-center">
            <Button variant="link" size="sm" icon="circle-help" onClick={() => setFp(true)}>
              {tc('forgotPassword')}
            </Button>
          </div>
          <Alert icon="shield-check" className="mt-4">
            {t('autoLogout', { n: settings?.autoLogoutMinutes.admin ?? 10 })}
          </Alert>
        </form>
      </div>
      <ForgotPassword open={fp} onOpenChange={setFp} />
    </div>
  );
}

function ForgotPassword({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const tc = useT(common);
  const [step, setStep] = useState(0);
  const [otp, setOtp] = useState('604218');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setStep(0);
  };
  const steps = (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-line')} />
      ))}
    </div>
  );
  const titles = [t('fpTitle'), tc('enterOtp'), t('newPw'), t('pwDone')];
  const icons = ['key-round', 'message-square-lock', 'lock', 'circle-check'];
  const ok = p1.length >= 8 && p1 === p2 && /\d/.test(p1) && /[a-z]/i.test(p1);
  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={titles[step]}
      icon={icons[step]}
      actions={
        step === 0 ? (
          <>
            <Button variant="o" onClick={() => close(false)}>{tc('cancel')}</Button>
            <Button icon="send" onClick={() => setStep(1)}>{t('sendOtp')}</Button>
          </>
        ) : step === 1 ? (
          <>
            <Button variant="o" icon="chevron-left" onClick={() => setStep(0)}>{tc('back')}</Button>
            <Button icon="shield-check" disabled={otp.length !== 6} onClick={() => setStep(2)}>{t('verify')}</Button>
          </>
        ) : step === 2 ? (
          <>
            <Button variant="o" icon="chevron-left" onClick={() => setStep(1)}>{tc('back')}</Button>
            <Button icon="save" onClick={() => (ok ? setStep(3) : toast.error(t('pwMismatch')))}>{tc('save')}</Button>
          </>
        ) : (
          <Button icon="check" onClick={() => close(false)}>{tc('ok')}</Button>
        )
      }
    >
      {step < 3 && steps}
      {step === 0 && (
        <>
          <p className="mt-3 text-muted">{t('fpIntro')}</p>
          <Field label="Email" icon="mail" className="mt-3">
            <Input defaultValue="admin@dyh.ph" type="email" />
          </Field>
        </>
      )}
      {step === 1 && (
        <>
          <p className="mt-3 text-center text-muted">
            {tc('otpSentTo')} <b className="text-ink">0917 ••• 1020</b>
          </p>
          <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="mx-auto mt-3 w-[220px] text-center text-[24px] font-extrabold tracking-[.5em]" aria-label={tc('enterOtp')} />
          <p className="mt-2 text-center text-[11.5px] text-muted">{tc('mockOtp')}</p>
        </>
      )}
      {step === 2 && (
        <>
          <Field label={t('newPwL')} icon="lock" className="mt-3">
            <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} />
          </Field>
          <Field label={t('confirmPw')} icon="lock" hint={t('pwRule')}>
            <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} />
          </Field>
        </>
      )}
      {step === 3 && (
        <div className="text-center">
          <div className="mx-auto grid size-[72px] place-items-center rounded-[22px] bg-[#12805a] text-white">
            <Icon name="check" size={30} />
          </div>
          <p className="mt-4 text-muted">{t('pwDoneBody')}</p>
        </div>
      )}
    </Modal>
  );
}
