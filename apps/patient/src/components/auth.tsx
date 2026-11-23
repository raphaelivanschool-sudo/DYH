import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useApi } from '@dyh/api';
import { common, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, Center, Dialog, Icon, Keypad, PinDots, Placeholder, Rich, Txt, OtpBoxes, authenticateBiometric, toast, useColors } from '@dyh/ui-native';
import { useSession, useUi } from '../store';
import { pm } from '../msgs';
import { useCatalog } from '../lib';

export const MASKED_MOBILE = '0917 ••• 0142';

/** Finish log in / registration: start the session, then resume a pending booking or go Home. */
export function useAfterAuth() {
  const api = useApi();
  const t = useT(pm);
  return async () => {
    const s = await api.login('patient', { id: '09175550142', secret: 'pin' });
    useSession.getState().signIn(s.token);
    const ui = useUi.getState();
    const pending = ui.pendingDoctor ? (await api.getDoctors()).find((d) => d.id === ui.pendingDoctor) : undefined;
    if (pending) {
      ui.set({ pendingDoctor: null, annPopup: false });
      ui.startBook({ step: 4, doctor: pending.id, spec: pending.specializationId });
      router.replace('/book');
      toast.info(t('contBook'));
    } else {
      ui.set({ annPopup: true });
      router.replace('/home');
    }
  };
}

/** Fingerprint confirmation dialog. Uses the device sensor when available, otherwise "Simulate". */
export function BioDialog({ open, onClose, onDone, enrolling }: { open: boolean; onClose: () => void; onDone: () => void; enrolling?: boolean }) {
  const t = useT(pm);
  const tc = useT(common);
  const c = useColors();
  const run = async () => {
    const ok = await authenticateBiometric(t('bioTitle'));
    onClose();
    if (ok) onDone();
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
          <Button className="flex-1" icon="scan-face" onPress={run}>
            {t('simulate')}
          </Button>
        </>
      }
    >
      <Center>
        <View className="h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: c.sky }}>
          <Icon name="fingerprint" size={52} color="blue" />
        </View>
        <Txt className="mt-3 text-center text-muted">{enrolling ? t('bioEnable') : t('bioPrompt')}</Txt>
      </Center>
    </Dialog>
  );
}

export function ForgotPinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(pm);
  const tc = useT(common);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('forgotPin')}
      icon="key-round"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            className="flex-1"
            icon="send"
            onPress={() => {
              onClose();
              toast.success(t('otpSent'));
            }}
          >
            {t('sendCode')}
          </Button>
        </>
      }
    >
      <Rich text={t('forgotBody')} className="text-muted" />
      <Card className="mt-3 flex-row items-center gap-2.5 p-3">
        <Icon name="smartphone" size={18} color="muted" />
        <Txt w="b" size={17} className="flex-1">
          {MASKED_MOBILE}
        </Txt>
        <Badge tone="green" icon="shield-check">
          {t('registered')}
        </Badge>
      </Card>
      <Alert kind="warn" icon="phone-off" className="mt-3" text={t('changedNum')} />
    </Dialog>
  );
}

/** Two-pass 6-digit PIN creation. Calls `onDone` when both entries match. */
export function PinCreate({ onDone }: { onDone: (pin: string) => void }) {
  const t = useT(pm);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const second = a.length === 6;
  const key = (n: string) => {
    if (!second) return setA((x) => x + n);
    const nb = b + n;
    if (nb.length < 6) return setB(nb);
    if (nb === a) return onDone(a);
    setB('');
    toast.error(t('pinMismatch'));
  };
  return (
    <Center className="mt-3">
      <Avatar icon={second ? 'shield-check' : 'key-round'} size="xl" light />
      <Txt w="b" size={18} className="mt-3">
        {second ? t('confirmPin') : t('createPin')}
      </Txt>
      <Txt size={12.5} className="mt-1 text-center text-muted">
        {t('pinUse')}
      </Txt>
      <PinDots value={second ? b : a} />
      <Keypad onKey={key} onDelete={() => (second ? (b ? setB(b.slice(0, -1)) : setA(a.slice(0, -1))) : setA(a.slice(0, -1)))} />
    </Center>
  );
}

export function BioStep({ onNext }: { onNext: () => void }) {
  const t = useT(pm);
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <Center className="mt-5">
      <View className="h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: c.sky }}>
        <Icon name="fingerprint" size={52} color="blue" />
      </View>
      <Txt w="b" size={18} className="mt-4 text-center">
        {t('bioStepTitle')}
      </Txt>
      <Txt size={12.5} className="mt-2 text-center text-muted">
        {t('bioStepSub')}
      </Txt>
      <Button size="lg" full icon="fingerprint" className="mt-6" onPress={() => setOpen(true)}>
        {t('enable')}
      </Button>
      <Button variant="o" full className="mt-2" onPress={onNext}>
        {t('skip')}
      </Button>
      <BioDialog
        open={open}
        enrolling
        onClose={() => setOpen(false)}
        onDone={() => {
          useSession.getState().set({ bioOn: true });
          onNext();
        }}
      />
    </Center>
  );
}

export function OtpStep({ code, value, onChange, pre }: { code: string; value: string; onChange: (v: string) => void; pre?: string }) {
  const t = useT(pm);
  const tc = useT(common);
  return (
    <>
      <Center className="mt-5">
        <Avatar icon="message-square-lock" size="xl" light />
        <Txt w="b" size={18} className="mt-4">
          {t('otpTitle')}
        </Txt>
        <Txt className="mt-1 text-center text-muted">
          {pre ? `${pre} ` : ''}
          {t('otpSent6')}
        </Txt>
        <Txt w="b">{MASKED_MOBILE}</Txt>
        <OtpBoxes value={value} onChange={onChange} />
        <Pressable onPress={() => onChange(code)} className="mt-4 flex-row items-center gap-1">
          <Txt size={12.5} className="text-muted">
            {tc('notReceived')}
          </Txt>
          <Icon name="rotate-cw" size={14} color="blue" />
          <Txt w="b" size={12.5} className="text-blue">
            {t('resendIn')}
          </Txt>
        </Pressable>
      </Center>
      <View className="mt-5">
        <Placeholder text={`${t('mockOtp')} (${code})`} />
      </View>
    </>
  );
}

export function ChoiceCard({ icon, tone, title, sub, onPress }: { icon: string; tone: 'blue' | 'green' | 'amber'; title: string; sub: string; onPress: () => void }) {
  const c = useColors();
  const [bg, fg] = { blue: [c.sky, c.blue], green: [c.greenBg, c.green], amber: [c.amberBg, c.amber] }[tone];
  return (
    <Card onPress={onPress} className="flex-row items-center gap-3 border-[1.5px] p-3.5">
      <View className="h-[46px] w-[46px] items-center justify-center rounded-[14px]" style={{ backgroundColor: bg }}>
        <Icon name={icon} size={22} color={fg} />
      </View>
      <View className="flex-1">
        <Txt w="b">{title}</Txt>
        <Txt size={12.5} className="text-muted">
          {sub}
        </Txt>
      </View>
      <Icon name="chevron-right" size={18} color="muted" />
    </Card>
  );
}

/** Guest tapped "Book": choose log in, link record, or register. Booking resumes afterwards. */
export function NeedAccountDialog({ doctorId, onClose }: { doctorId: string | null; onClose: () => void }) {
  const t = useT(pm);
  const tc = useT(common);
  const cat = useCatalog();
  const d = cat.doctor(doctorId);
  const go = (path: '/pin' | '/link' | '/register') => {
    useUi.getState().set({ pendingDoctor: doctorId });
    onClose();
    router.push(path);
  };
  return (
    <Dialog open={!!doctorId} onClose={onClose} title={t('needLogin')} icon="log-in" actions={<Button variant="o" className="flex-1" onPress={onClose}>{tc('cancel')}</Button>}>
      {d && (
        <Card className="flex-row items-center gap-3 p-3">
          <Avatar icon={cat.specIcon(d)} size="sm" light />
          <View className="flex-1">
            <Txt w="b">{d.name}</Txt>
            <Txt size={11.5} className="text-muted">
              {cat.specName(d)}
            </Txt>
          </View>
        </Card>
      )}
      <Txt size={12.5} className="mt-3 text-muted">
        {t('needLoginSub')}
      </Txt>
      <View className="mt-2 gap-2">
        <ChoiceCard icon="log-in" tone="blue" title={t('haveAcct')} sub={t('haveAcctSub')} onPress={() => go('/pin')} />
        <ChoiceCard icon="link" tone="green" title={t('haveRecord')} sub={t('haveRecordSub')} onPress={() => go('/link')} />
        <ChoiceCard icon="user-plus" tone="amber" title={t('newPt')} sub={t('newPtSub')} onPress={() => go('/register')} />
      </View>
    </Dialog>
  );
}

/** PIN (or fingerprint) gate in front of the QR record and medical history. */
export function PinGate({ title, sub, onUnlock, children }: { title: string; sub: string; onUnlock: () => void; children?: ReactNode }) {
  const [pin, setPin] = useState('');
  const [bio, setBio] = useState(false);
  const bioOn = useSession((s) => s.bioOn);
  const key = (n: string) => {
    const v = pin + n;
    if (v.length < 6) return setPin(v);
    setPin('');
    onUnlock();
  };
  return (
    <Center className="mt-3.5">
      <Avatar icon="lock" size="xl" light />
      <Txt w="b" size={18} className="mt-3 text-center">
        {title}
      </Txt>
      <Txt size={12.5} className="mt-1 text-center text-muted">
        {sub}
      </Txt>
      {children}
      <PinDots value={pin} />
      <Keypad onKey={key} onDelete={() => setPin(pin.slice(0, -1))} onBio={bioOn ? () => setBio(true) : undefined} />
      <BioDialog open={bio} onClose={() => setBio(false)} onDone={onUnlock} />
    </Center>
  );
}
