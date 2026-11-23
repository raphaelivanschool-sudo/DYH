import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { qk, useApiMutation, useSettings } from '@dyh/api';
import { DEFAULT_SETTINGS, type SystemSettings } from '@dyh/core';
import { common, defineMessages, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Loading, Panel, Rich } from '@/components/ui/display';
import { NumberInput, Segmented, Switch } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { usePerms } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { usePrefs } from '@/store/prefs';

const m = defineMessages('admin.settings', {
  display: ['Itsura at Wika', 'Display & Language'],
  general: ['Pangkalahatang Patakaran', 'General Rules'],
  bookingWindow: ['Saklaw ng Online na Pagpapareserba', 'Online Booking Window'],
  daysAhead: ['araw bago', 'days in advance'],
  cutoff: ['Hangganan ng Pagkansela', 'Cancellation Cut-off'],
  hoursBefore: ['oras bago ang iskedyul', 'hours before appointment'],
  reminder: ['Oras ng Paalala', 'Confirmation Reminder Timing'],
  dayBefore: ['araw bago ang iskedyul', 'day before appointment'],
  scan: ['Pagbubukas ng Pag-scan para sa Numero', 'Queue Number Scanning Opens'],
  scanSub: ['minuto bago ang oras ng clinic (Booking at Walk-in QR)', 'minutes before clinic hours (Booking & Walk-in QR)'],
  slip: ['Pagsara ng Queue Slip sa Kiosk', 'Kiosk Queue Slip Auto-close'],
  slipSub: ['segundo bago bumalik sa Simula', 'seconds before returning to Home'],
  autoLogout: ['Awtomatikong Paglabas (walang galaw)', 'Auto Log Out (inactivity)'],
  autoLogoutSub: ['Ilang minutong walang galaw bago kusang lumabas ang account sa bawat app.', 'Minutes of inactivity before an account is logged out automatically in each app.'],
  minutes: ['minuto', 'minutes'],
  fixed: ['Hindi Mababago Rito', 'Fixed Rules'],
  fixMax: ['Ang **maximum na pasyente bawat araw** (online + walk-in) ay itinatakda ng bawat doktor sa Doctor App. Hindi lalabas ang petsang puno o walang clinic.', 'The **maximum patients per day** (online + walk-in) is set by each doctor in the Doctor App. Full or no-clinic dates are hidden.'],
  fixQr: ['Ang **numero sa pila** ay ibinibigay lamang kapag na-scan ang Booking o Walk-in QR sa Kiosk.', 'The **queue number** is given only when the Booking or Walk-in QR is scanned at the Kiosk.'],
  fixRate: ['Ang **marka** ay hindi na mababago kapag naipost; ang average ay makikita lamang ng Admin.', '**Ratings** cannot be edited once posted; the average is visible to Admin only.'],
  noShow: ['**Patakaran sa Hindi Pagsipot:** Walk-in lamang ang susunod na iskedyul. Maibabalik ang online pagkatapos ng isang matagumpay na walk-in na konsulta.', '**No-show policy:** The next appointment is Walk-in only. Online booking is restored after one successful walk-in consultation.'],
  integrations: ['Mga Integrasyon', 'Integrations'],
  sms: ['SMS Provider', 'SMS Provider'],
  cloud: ['Cloud Database at Backup', 'Cloud Database & Backup'],
  chain: ['Blockchain Integrity', 'Blockchain Integrity'],
  notFinal: ['Hindi pa pinal', 'Not finalized'],
  concept: ['Konsepto lamang', 'Concept only'],
  saveTitle: ['I-save ang mga setting?', 'Save settings?'],
  saveBody: ['Maaapektuhan ang mga patakaran sa lahat ng platform.', 'Rules on all platforms will be affected.'],
  reset: ['I-reset', 'Reset'],
});

const APPS = [
  ['patient', 'smartphone', 'Patient App'],
  ['doctor', 'stethoscope', 'Doctor App'],
  ['secretary', 'clipboard-list', 'Secretary App'],
  ['admin', 'monitor', 'Admin Portal'],
] as const;

function SettingRow({ icon, title, sub, children }: { icon: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <Icon name={icon} size={19} className="text-muted" />
      <div className="flex-1">
        <b>{title}</b>
        <div className="text-[12.5px] text-muted">{sub}</div>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const t = useT(m);
  const tc = useT(common);
  const { canDo } = usePerms();
  const { data } = useSettings();
  const { lang, setLang, theme, setTheme } = usePrefs();
  const [s, setS] = useState<SystemSettings | null>(null);
  const [confirm, setConfirm] = useState(false);
  const save = useApiMutation((api, p: SystemSettings) => api.updateSettings(p), [qk.settings]);
  useEffect(() => {
    if (data && !s) setS(data);
  }, [data, s]);
  if (!s) return <Loading />;
  const ro = !canDo('settings', 'u');
  const num = (k: keyof Omit<SystemSettings, 'autoLogoutMinutes'>, min: number, max: number) => (
    <fieldset disabled={ro}>
      <NumberInput label={k} value={s[k]} min={min} max={max} onChange={(v) => setS({ ...s, [k]: v })} />
    </fieldset>
  );

  return (
    <div className="grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <Panel title={t('display')} icon="palette">
          <SettingRow icon="languages" title={tc('language')} sub={tc('languageHint')}>
            <Segmented size="sm" className="w-[180px]" value={lang} onChange={setLang} options={[{ value: 'tl', label: 'Tagalog' }, { value: 'en', label: 'English' }]} />
          </SettingRow>
          <SettingRow icon="moon" title={tc('darkMode')} sub={tc('darkHint')}>
            <Switch label={tc('darkMode')} checked={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} />
          </SettingRow>
        </Panel>
        <Panel title={t('general')} icon="sliders-horizontal">
          <SettingRow icon="calendar-range" title={t('bookingWindow')} sub={t('daysAhead')}>{num('bookingWindowDays', 1, 30)}</SettingRow>
          <SettingRow icon="calendar-x" title={t('cutoff')} sub={t('hoursBefore')}>{num('cancellationCutoffHours', 0, 48)}</SettingRow>
          <SettingRow icon="bell" title={t('reminder')} sub={t('dayBefore')}>{num('reminderDaysBefore', 0, 7)}</SettingRow>
          <SettingRow icon="scan-qr-code" title={t('scan')} sub={t('scanSub')}>{num('scanWindowMinutes', 0, 240)}</SettingRow>
          <SettingRow icon="tablet" title={t('slip')} sub={t('slipSub')}>{num('kioskSlipSeconds', 5, 120)}</SettingRow>
        </Panel>
        <Panel title={t('autoLogout')} icon="timer">
          <p className="-mt-1.5 text-[12.5px] text-muted">{t('autoLogoutSub')}</p>
          {APPS.map(([k, i, label]) => (
            <SettingRow key={k} icon={i} title={label} sub={t('minutes')}>
              <fieldset disabled={ro}>
                <NumberInput label={label} value={s.autoLogoutMinutes[k]} min={1} max={120} onChange={(v) => setS({ ...s, autoLogoutMinutes: { ...s.autoLogoutMinutes, [k]: v } })} />
              </fieldset>
            </SettingRow>
          ))}
        </Panel>
        {ro ? (
          <div className="flex justify-end">
            <Badge icon="eye">{tc('readOnly')}</Badge>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="o" icon="rotate-ccw" onClick={() => setS(DEFAULT_SETTINGS)}>
              {t('reset')}
            </Button>
            <Button icon="save" onClick={() => setConfirm(true)}>
              {tc('save')}
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Panel title={t('fixed')} icon="lock">
          <Alert icon="stethoscope"><Rich text={t('fixMax')} /></Alert>
          <Alert kind="ok" icon="qr-code" className="mt-2"><Rich text={t('fixQr')} /></Alert>
          <Alert icon="star" className="mt-2"><Rich text={t('fixRate')} /></Alert>
          <Alert kind="warn" icon="user-x" className="mt-2"><Rich text={t('noShow')} /></Alert>
        </Panel>
        <Panel title={t('integrations')} icon="plug">
          {(
            [
              ['message-square-text', t('sms'), t('notFinal')],
              ['cloud', t('cloud'), t('notFinal')],
              ['link-2', t('chain'), t('concept')],
            ] as const
          ).map(([i, l, b]) => (
            <div key={l} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
              <Icon name={i} size={18} className="text-muted" />
              <b className="flex-1">{l}</b>
              <Badge tone="amber">{b}</Badge>
            </div>
          ))}
        </Panel>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t('saveTitle')}
        icon="save"
        actions={
          <>
            <Button variant="o" onClick={() => setConfirm(false)}>{tc('cancel')}</Button>
            <Button
              icon="save"
              disabled={save.isPending}
              onClick={async () => {
                await save.mutateAsync(s);
                toast.success(tc('toast_settings'));
                setConfirm(false);
              }}
            >
              {tc('save')}
            </Button>
          </>
        }
      >
        <p className="text-muted">{t('saveBody')}</p>
      </Modal>
    </div>
  );
}
