import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { qk, useApiMutation, useDoctors, useSpecializations } from '@dyh/api';
import { splitName, type PasswordResetRequest, type PermissionSet } from '@dyh/core';
import { common, defineMessages, useLang, useLoc, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Avatar, Badge, Card, Rich, Row, StatusBadge } from '@/components/ui/display';
import { Field, Input, MobileInput, Segmented, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { Picker } from '@/components/ui/picker';
import { MODULES, roleMsgs, useAdmins, usePerms, useRooms, useSecretaries } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { scheduleLabel, shortDate } from '@/lib/utils';
import { ConflictBox, isRoomBlocked, useRoomOptions } from '../roomsLib';
import { secretariesOf, useAm, useSpecName } from '../shared';
import { acm, allCreds, DoctorChecks, emptyName, fullName, NameFields, PermTable, plainName, type AccountKind, type AccountRow, type NameForm } from './parts';

const m = defineMessages('admin.accounts.dialogs', {
  newAdmin: ['Bagong Admin Account', 'New Admin Account'],
  newDoctor: ['Bagong Account ng Doktor', 'New Doctor Account'],
  newSec: ['Bagong Account ng Sekretarya', 'New Secretary Account'],
  who: ['Sino ang gagawing Admin?', 'Who will be the Admin?'],
  newPerson: ['Bagong tao', 'New person'],
  existingDoc: ['Existing na doktor', 'Existing doctor'],
  pickDoctor: ['Piliin ang doktor', 'Select the doctor'],
  hasAdmin: ['May Admin account na', 'Already has an Admin account'],
  pulled: ['Kinuha na mula sa doctor account — hindi na kailangang i-type ulit. **Hiwalay na Admin login at password** ang ipapadala; mananatili ang kanyang Doctor App login.', 'Pulled from the doctor account — no need to type it again. A **separate Admin login and password** will be sent; their Doctor App login stays the same.'],
  autofill: ['Awtomatikong mapupunan ang pangalan, titulo, email at mobile.', 'Name, credentials, email and mobile fill in automatically.'],
  digits: ['Numero lamang, 11 digit', 'Numbers only, 11 digits'],
  emailNote: ['Dito ipapadala ang **email na gagamitin sa pag-login** at ang **pansamantalang password**.', 'The **login email** and a **temporary password** will be sent here.'],
  isDoctorEmail: ['Email ito ng doctor account ni **{{name}}**.', "This is the email of **{{name}}**'s doctor account."],
  useExisting: ['Gamitin na lang ang existing na doktor', 'Use the existing doctor instead'],
  pickRole: ['Pumili ng tungkulin', 'Select a role'],
  fullAccess: ['Buong access sa lahat ng modyul.', 'Full access to every module.'],
  modulesActions: ['Mga Modyul at Aksyon', 'Modules & Actions'],
  createdByNote: ['Gagawin ni **{{name}}** · makikita ito sa listahan ng account', 'Created by **{{name}}** · shown in the account list'],
  pickSpec: ['Pumili o i-type ang espesyalisasyon', 'Select or type a specialization'],
  roomAssign: ['Kuwarto', 'Room Assignment'],
  pickRoom: ['Pumili ng kuwarto', 'Select a room'],
  roomUsed: ['Ginagamit na ang kuwartong ito ni {{who}}. Susuriin ang conflict kapag naitakda ng doktor ang iskedyul.', 'This room is already used by {{who}}. Conflicts are checked once the doctor sets a schedule.'],
  assignedMulti: ['Mga doktor na hawak (puwedeng marami)', 'Assigned doctors (multiple allowed)'],
  confirmTitle: ['Kumpirmahin ang bagong account', 'Confirm new account'],
  confirmNote: ['Pagkalikha, ipapadala sa email ang login at pansamantalang password. Kailangang palitan ito sa unang pag-login.', 'Once created, the login and temporary password are emailed. It must be changed on first login.'],
  doctorAccount: ['Doctor account', 'Doctor account'],
  separateLogin: ['hiwalay na login', 'separate login'],
  created: ['Nagawa ang account. Naipadala ang login sa email.', 'Account created. Login sent by email.'],
  missing: ['Kumpletuhin ang pangalan, email at 11-digit na mobile.', 'Complete the name, email and 11-digit mobile.'],
  details: ['Detalye ng Account', 'Account Details'],
  editTitle: ['Baguhin ang Account', 'Edit Account'],
  moduleAccess: ['Access sa Modyul', 'Module Access'],
  statusHistory: ['Kasaysayan ng Status', 'Status History'],
  lastLogin: ['Huling pag-login', 'Last login'],
  todayAt: ['Ngayon, {{t}}', 'Today, {{t}}'],
  deactTitle: ['I-deactivate ang account?', 'Deactivate account?'],
  actTitle: ['I-activate ang account?', 'Activate account?'],
  deactBody: ['Hindi na makakapasok ang user. Mananatili ang kasaysayan sa audit.', 'The user will no longer be able to log in. Audit history is kept.'],
  actBody: ['Makakapasok ulit ang user gamit ang kanyang dating account.', 'The user will be able to log in again with their existing account.'],
  reason: ['Dahilan', 'Reason'],
  reasonPhDeact: ['hal. Nag-resign, naka-leave nang matagal', 'e.g. Resigned, extended leave'],
  reasonPhAct: ['hal. Bumalik mula sa leave', 'e.g. Returned from leave'],
  reasonReq: ['Kailangan ang dahilan.', 'A reason is required.'],
  deactDone: ['Na-deactivate ang account', 'Account deactivated'],
  actDone: ['Na-activate ang account', 'Account activated'],
  resetTitle: ['I-reset ang password?', 'Reset password?'],
  resetBody: ['Magpapadala ng reset link at pansamantalang password sa email ni **{{name}}** ({{email}}).', 'A reset link and temporary password will be emailed to **{{name}}** ({{email}}).'],
  resetDone: ['Naipadala ang reset link', 'Reset link sent'],
  sendTitle: ['Ipadala ang reset link?', 'Send reset link?'],
  sendBody: ['Makakatanggap ang user ng email na may link para gumawa ng bagong password (valid sa loob ng 24 oras).', 'The user will receive an email with a link to set a new password (valid for 24 hours).'],
  send: ['Ipadala', 'Send'],
});

const rich = (s: string) => <Rich text={s} />;

/* ---------------------------------------------------------------- */
/* Create account                                                    */
/* ---------------------------------------------------------------- */

interface NewForm {
  src: 'new' | 'doc';
  linkDoctor: string | null;
  name: NameForm;
  email: string;
  mobile: string;
  role: 'admin' | 'super';
  perms: PermissionSet;
  spec: string | null;
  room: string | null;
  doctorIds: string[];
}
const blank = (kind: AccountKind): NewForm => ({ src: 'new', linkDoctor: null, name: emptyName(kind === 'doctor' ? ['MD'] : []), email: '', mobile: '', role: 'admin', perms: { dashboard: {} }, spec: null, room: null, doctorIds: [] });

export function NewAccountDialog({ kind, open, onOpenChange }: { kind: AccountKind; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const ta = useT(acm);
  const tc = useT(common);
  const tr = useT(roleMsgs);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const spec = useSpecName();
  const roomOpts = useRoomOptions();
  const { me } = usePerms();
  const { data: doctors = [] } = useDoctors();
  const { data: specs = [] } = useSpecializations();
  const { data: rooms = [] } = useRooms();
  const { data: admins = [] } = useAdmins();
  const [f, setF] = useState<NewForm>(blank(kind));
  const [step, setStep] = useState<0 | 1>(0);
  const set = (p: Partial<NewForm>) => setF((x) => ({ ...x, ...p }));
  const create = useApiMutation((api, v: Parameters<typeof api.createAccount>[0]) => api.createAccount(v), [qk.admins, qk.secretaries, qk.doctors, qk.audit]);

  useEffect(() => {
    if (open) {
      setF(blank(kind));
      setStep(0);
    }
  }, [open, kind]);

  const isAdm = kind === 'admin';
  const isDoc = kind === 'doctor';
  const taken = admins.filter((x) => x.doctorId).map((x) => x.doctorId);
  const linked = f.src === 'doc' && f.linkDoctor ? doctors.find((d) => d.id === f.linkDoctor) : undefined;
  const emailDoctor = f.src === 'new' ? doctors.find((d) => d.email.toLowerCase() === f.email.trim().toLowerCase()) : undefined;
  const linkTo = (id: string) => {
    const d = doctors.find((x) => x.id === id)!;
    const n = splitName(d.name);
    set({ src: 'doc', linkDoctor: id, name: { first: n.first, middle: '', last: n.last, suffix: n.suffix ?? '', creds: [...d.credentials], credOther: '' }, email: d.email, mobile: d.mobile.replace(/\s/g, '') });
  };
  const roomUsersOf = (r: string) => doctors.filter((d) => d.room === r);
  const valid = !!plainName(f.name, isDoc || isAdm) && /\S+@\S+/.test(f.email) && f.mobile.replace(/\D/g, '').length === 11;

  const submit = async () => {
    await create.mutateAsync({
      kind,
      name: plainName(f.name, isDoc || isAdm) || 'New account',
      email: f.email,
      mobile: f.mobile,
      credentials: allCreds(f.name),
      specializationId: f.spec ?? undefined,
      room: f.room ?? undefined,
      doctorIds: f.doctorIds,
      permissions: f.role === 'super' ? {} : f.perms,
      linkedDoctorId: linked?.id ?? emailDoctor?.id,
    });
    toast.success(t('created'));
    onOpenChange(false);
  };

  const title = isAdm ? t('newAdmin') : isDoc ? t('newDoctor') : t('newSec');

  if (step === 1) {
    const rows: [string, string, React.ReactNode][] = [
      ['shield', a('role'), isAdm ? tr(f.role) : isDoc ? tc('doctor') : a('secretary')],
      ['user', tc('name'), fullName(f.name, isDoc || isAdm) || '—'],
      ['mail', 'Email', f.email || '—'],
      ['smartphone', 'Mobile', f.mobile || '—'],
      ['user-pen', a('createdBy'), me?.name ?? ''],
    ];
    if (isAdm) {
      rows.push([
        'shield-check',
        ta('access'),
        f.role === 'super'
          ? tc('all')
          : Object.keys(f.perms)
              .map((k) => {
                const mod = MODULES.find((x) => x.id === k)!;
                const ops = Object.keys(f.perms[mod.id] ?? {});
                return loc(mod.label) + (ops.length ? ` (${ops.join('').toUpperCase()})` : '');
              })
              .join(', ') || '—',
      ]);
      const ld = linked ?? emailDoctor;
      if (ld) rows.push(['stethoscope', t('doctorAccount'), `${ld.name} · ${t('separateLogin')}`]);
    } else if (isDoc) {
      rows.push(['stethoscope', tc('specialization'), f.spec ? spec(f.spec, false) : '—'], ['door-open', tc('room'), f.room ?? '—']);
    } else {
      rows.push(['stethoscope', tc('doctors'), f.doctorIds.map((id) => doctors.find((d) => d.id === id)?.name).join(', ') || '—']);
    }
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={t('confirmTitle')}
        icon="user-check"
        actions={
          <>
            <Button variant="o" icon="chevron-left" onClick={() => setStep(0)}>{tc('back')}</Button>
            <Button icon="check" onClick={submit} disabled={create.isPending}>{ta('createAccount')}</Button>
          </>
        }
      >
        <Card className="px-3.5 py-1">
          {rows.map(([i, l, v]) => (
            <Row key={l} icon={i} label={l}>
              {v}
            </Row>
          ))}
        </Card>
        <Alert icon="send" className="mt-3">{t('confirmNote')}</Alert>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon="user-plus"
      wide={isAdm}
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button iconRight="chevron-right" onClick={() => (valid ? setStep(1) : toast.error(t('missing')))}>{tc('next')}</Button>
        </>
      }
    >
      {isAdm && (
        <Field label={t('who')} icon="user-search" className="mt-0">
          <Segmented
            value={f.src}
            onChange={(src) => setF({ ...blank(kind), src })}
            options={[
              { value: 'new', label: t('newPerson'), icon: 'user-plus' },
              { value: 'doc', label: t('existingDoc'), icon: 'stethoscope' },
            ]}
          />
        </Field>
      )}

      {isAdm && f.src === 'doc' ? (
        <Field label={t('pickDoctor')} icon="stethoscope" hint={!linked && t('autofill')}>
          <Picker
            value={f.linkDoctor}
            onChange={linkTo}
            icon="stethoscope"
            searchPlaceholder={a('searchDoctor')}
            options={doctors.map((d) => ({ value: d.id, label: `${d.name}, ${d.credentials.join(', ')}`, sub: taken.includes(d.id) ? t('hasAdmin') : `${spec(d.specializationId)} · ${d.email}`, icon: taken.includes(d.id) ? 'lock' : 'stethoscope', disabled: taken.includes(d.id) }))}
          />
          {linked && (
            <>
              <Card className="mt-3 px-3.5 py-1">
                <Row icon="user" label={tc('name')}>{fullName(f.name, true)}</Row>
                <Row icon="mail" label="Email">{f.email}</Row>
                <Row icon="smartphone" label="Mobile">{linked.mobile}</Row>
                <Row icon="stethoscope" label={tc('specialization')}>{spec(linked.specializationId)}</Row>
              </Card>
              <Alert kind="ok" icon="copy-check" className="mt-2">{rich(t('pulled'))}</Alert>
            </>
          )}
        </Field>
      ) : (
        <div className={isAdm ? 'mt-3.5' : ''}>
          <NameFields value={f.name} onChange={(name) => set({ name })} doctor={isDoc || isAdm} />
          <Field label={tc('mobile')} icon="smartphone" hint={t('digits')}>
            <MobileInput value={f.mobile} onChange={(mobile) => set({ mobile })} />
          </Field>
          <Field label="Email" icon="mail">
            <Input type="email" placeholder={isDoc ? 'j.delacruz@dyh.ph' : 'm.santos@dyh.ph'} value={f.email} onChange={(e) => set({ email: e.target.value })} />
            <Alert icon="mail" className="mt-2">{rich(t('emailNote'))}</Alert>
          </Field>
        </div>
      )}

      {isAdm && (
        <>
          {emailDoctor && (
            <Alert kind="warn" icon="stethoscope" className="mt-2">
              {rich(t('isDoctorEmail', { name: emailDoctor.name }))}{' '}
              <Button variant="link" size="sm" onClick={() => linkTo(emailDoctor.id)}>
                {t('useExisting')}
              </Button>
            </Alert>
          )}
          <Field label={a('role')} icon="shield">
            <Picker
              value={f.role}
              onChange={(v) => set({ role: v as NewForm['role'] })}
              icon="shield"
              options={[
                { value: 'super', label: tr('super'), sub: tr('superShort'), icon: 'crown' },
                { value: 'admin', label: tr('admin'), sub: tr('adminShort'), icon: 'shield' },
              ]}
              placeholder={t('pickRole')}
            />
          </Field>
          {f.role === 'super' ? (
            <Alert kind="warn" icon="crown" className="mt-2">{t('fullAccess')}</Alert>
          ) : (
            <Field label={t('modulesActions')} icon="shield-check">
              <PermTable value={f.perms} onChange={(perms) => set({ perms })} />
            </Field>
          )}
          <Card className="mt-3 flex items-center gap-2 p-2.5 text-[12.5px]">
            <Icon name="user-pen" size={16} />
            {rich(t('createdByNote', { name: me?.name ?? '' }))}
          </Card>
        </>
      )}

      {isDoc && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tc('specialization')} icon="stethoscope">
              <Picker value={f.spec} onChange={(spec) => set({ spec })} icon="stethoscope" placeholder={t('pickSpec')} options={specs.map((s) => ({ value: s.id, label: loc(s.name), icon: s.icon }))} />
            </Field>
            <Field label={t('roomAssign')} icon="door-open">
              <Picker value={f.room} onChange={(room) => set({ room })} icon="door-open" placeholder={t('pickRoom')} options={roomOpts(rooms, doctors)} />
            </Field>
          </div>
          {f.room && roomUsersOf(f.room).length > 0 && (
            <Alert kind="warn" icon="calendar-clock" className="mt-2">
              {t('roomUsed', { who: roomUsersOf(f.room).map((x) => `${x.name} (${scheduleLabel(x, lang)})`).join(', ') })}
            </Alert>
          )}
        </>
      )}

      {kind === 'secretary' && (
        <Field label={t('assignedMulti')} icon="stethoscope">
          <DoctorChecks doctors={doctors} value={f.doctorIds} onChange={(doctorIds) => set({ doctorIds })} />
        </Field>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* View / edit account                                               */
/* ---------------------------------------------------------------- */

export function AccountDialog({ row, open, onOpenChange }: { row: AccountRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const ta = useT(acm);
  const tc = useT(common);
  const tr = useT(roleMsgs);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const spec = useSpecName();
  const roomOpts = useRoomOptions();
  const { isSuper, canDo } = usePerms();
  const { data: doctors = [] } = useDoctors();
  const { data: specs = [] } = useSpecializations();
  const { data: rooms = [] } = useRooms();
  const { data: secs = [] } = useSecretaries();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState<NameForm>(emptyName());
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [perms, setPerms] = useState<PermissionSet>({});
  const [docIds, setDocIds] = useState<string[]>([]);
  const [sp, setSp] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const save = useApiMutation((api, v: { id: string; p: Parameters<typeof api.updateAccount>[1] }) => api.updateAccount(v.id, v.p), [qk.admins, qk.secretaries, qk.doctors, qk.audit]);

  useEffect(() => {
    if (open) setEdit(false);
  }, [open, row?.id]);

  if (!row) return null;
  const doc = row.doctor;
  const adm = row.admin;
  const sec = row.secretary;
  const canEdit = row.kind === 'admin' ? isSuper && adm?.role !== 'super' : canDo('accounts', 'u');
  const history = (doc ?? sec ?? adm)?.statusHistory ?? [];
  const startEdit = () => {
    const n = splitName(row.name);
    setName({ first: n.first, middle: '', last: n.last, suffix: n.suffix ?? '', creds: doc ? [...doc.credentials] : [], credOther: '' });
    setEmail(row.email);
    setMobile(row.mobile.replace(/\s/g, ''));
    setPerms(JSON.parse(JSON.stringify(adm?.permissions ?? {})));
    setDocIds([...(sec?.doctorIds ?? [])]);
    setSp(doc?.specializationId ?? null);
    setRoom(doc?.room ?? null);
    setEdit(true);
  };
  const roomObj = rooms.find((r) => r.number === room);
  const blocked = !!doc && room !== doc.room && isRoomBlocked(roomObj, doc, doctors);
  const doSave = async () => {
    if (blocked) return;
    await save.mutateAsync({
      id: row.id,
      p: { name: plainName(name, !!doc) || row.name, email, mobile, ...(doc ? { credentials: allCreds(name), specializationId: sp ?? undefined, room: room ?? undefined } : {}), ...(adm ? { permissions: perms } : {}), ...(sec ? { doctorIds: docIds } : {}) },
    });
    toast.success(a('saved'));
    setEdit(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide={edit || row.kind === 'admin'}
      title={edit ? t('editTitle') : t('details')}
      icon={edit ? 'pencil' : 'user'}
      actions={
        edit ? (
          <>
            <Button variant="o" onClick={() => setEdit(false)}>{tc('cancel')}</Button>
            <Button icon="save" onClick={doSave} disabled={save.isPending || blocked}>{tc('save')}</Button>
          </>
        ) : (
          <>
            <Button variant="o" onClick={() => onOpenChange(false)}>{tc('close')}</Button>
            {canEdit && <Button icon="pencil" onClick={startEdit}>{tc('edit')}</Button>}
          </>
        )
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={row.name} size="lg" />
        <div className="flex-1">
          <b className="text-[17px]">{row.name}</b>
          <div className="text-[12.5px] text-muted">
            {row.kind === 'doctor' ? tc('doctor') : row.kind === 'admin' ? <Badge tone={adm!.role === 'super' ? 'purple' : 'blue'} icon={adm!.role === 'super' ? 'crown' : 'shield'}>{tr(adm!.role)}</Badge> : a('secretary')}
          </div>
        </div>
        <StatusBadge status={row.status} />
      </div>

      {!edit ? (
        <>
          <Card className="mt-3 px-3.5 py-1">
            <Row icon="mail" label="Email">{row.email}</Row>
            <Row icon="smartphone" label="Mobile">{row.mobile}</Row>
            {doc && (
              <>
                <Row icon="stethoscope" label={tc('specialization')}>{spec(doc.specializationId, false)}</Row>
                <Row icon="door-open" label={tc('room')}>{`${doc.room} · ${a('floorN', { n: doc.floor })}`}</Row>
                <Row icon="calendar" label={a('schedule')}>{scheduleLabel(doc, lang)}</Row>
                <Row icon="clipboard-list" label={a('secretary')}>{secretariesOf(doc.id, secs).map((s) => s.name).join(', ') || '—'}</Row>
              </>
            )}
            {adm && (
              <>
                <Row icon="shield" label={a('role')}>{tr(adm.role)}</Row>
                {adm.doctorId && <Row icon="stethoscope" label={t('doctorAccount')}>{`${doctors.find((d) => d.id === adm.doctorId)?.name ?? ''} · ${t('separateLogin')}`}</Row>}
              </>
            )}
            {sec && <Row icon="stethoscope" label={tc('doctors')}>{sec.doctorIds.map((id) => doctors.find((d) => d.id === id)?.name).join(', ')}</Row>}
            <Row icon="calendar-plus" label={a('created')}>{shortDate(row.createdAt, lang)}</Row>
            <Row icon="user-pen" label={a('createdBy')}>{row.createdBy}</Row>
            <Row icon="log-in" label={t('lastLogin')}>{t('todayAt', { t: '8:42 AM' })}</Row>
          </Card>
          {adm && (
            <div className="mt-3">
              <b className="flex items-center gap-1.5 text-[13px]">
                <Icon name="shield-check" size={16} />
                {t('moduleAccess')}
              </b>
              {adm.role === 'super' ? <Alert icon="crown" className="mt-2">{t('fullAccess')}</Alert> : <PermTable value={adm.permissions} />}
            </div>
          )}
          {history.length > 0 && (
            <div className="mt-3">
              <b className="flex items-center gap-1.5 text-[13px]">
                <Icon name="history" size={16} />
                {t('statusHistory')}
              </b>
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-2.5 border-b border-line py-2 text-[12.5px] last:border-0">
                  <StatusBadge status={h.status} />
                  <span className="flex-1">{h.reason}</span>
                  <span className="text-[11px] text-muted">{h.at}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-3">
          <NameFields value={name} onChange={setName} doctor={!!doc} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" icon="mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Mobile" icon="smartphone">
              <MobileInput value={mobile} onChange={setMobile} />
            </Field>
          </div>
          {doc && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tc('specialization')} icon="stethoscope">
                  <Picker value={sp} onChange={setSp} icon="stethoscope" options={specs.map((s) => ({ value: s.id, label: loc(s.name), icon: s.icon }))} />
                </Field>
                <Field label={tc('room')} icon="door-open">
                  <Picker value={room} onChange={setRoom} icon="door-open" options={roomOpts(rooms, doctors, doc)} />
                </Field>
              </div>
              {room !== doc.room && <ConflictBox room={roomObj} doctor={doc} doctors={doctors} />}
            </>
          )}
          {adm && (
            <Field label={t('moduleAccess')} icon="shield-check">
              <PermTable value={perms} onChange={setPerms} />
            </Field>
          )}
          {sec && (
            <Field label={ta('assignedDoctors')} icon="stethoscope">
              <DoctorChecks doctors={doctors} value={docIds} onChange={setDocIds} />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Activate / deactivate, reset password, send reset link            */
/* ---------------------------------------------------------------- */

export function StatusDialog({ row, open, onOpenChange }: { row: AccountRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const tc = useT(common);
  const ta = useT(acm);
  const [reason, setReason] = useState('');
  const mut = useApiMutation((api, v: { id: string; s: 'active' | 'deactivated'; r: string }) => api.setAccountStatus(v.id, v.s, v.r), [qk.admins, qk.secretaries, qk.doctors, qk.audit]);
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  if (!row) return null;
  const on = row.status === 'active';
  const go = async () => {
    if (!reason.trim()) return toast.error(t('reasonReq'));
    await mut.mutateAsync({ id: row.id, s: on ? 'deactivated' : 'active', r: reason.trim() });
    toast.success(on ? t('deactDone') : t('actDone'));
    onOpenChange(false);
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={on ? t('deactTitle') : t('actTitle')}
      icon="power"
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button variant={on ? 'r' : 'ok'} icon="power" onClick={go} disabled={mut.isPending}>
            {on ? ta('deactivate') : ta('activate')}
          </Button>
        </>
      }
    >
      <Card className="flex items-center gap-3 p-3">
        <Avatar name={row.name} light />
        <div className="flex-1">
          <b>{row.name}</b>
          <div className="text-[12.5px] text-muted">{row.email}</div>
        </div>
        <StatusBadge status={row.status} />
      </Card>
      <p className="mt-3 text-muted">{on ? t('deactBody') : t('actBody')}</p>
      <Field label={t('reason')} icon="message-square" hint={t('reasonReq')}>
        <Textarea className="min-h-[80px]" placeholder={on ? t('reasonPhDeact') : t('reasonPhAct')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

export function ResetDialog({ row, open, onOpenChange }: { row: AccountRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const tc = useT(common);
  const mut = useApiMutation((api, id: string) => api.resetPassword(id), [qk.audit]);
  if (!row) return null;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('resetTitle')}
      icon="key-round"
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            icon="key-round"
            disabled={mut.isPending}
            onClick={async () => {
              await mut.mutateAsync(row.id);
              toast.success(t('resetDone'));
              onOpenChange(false);
            }}
          >
            Reset
          </Button>
        </>
      }
    >
      <p className="text-muted">{rich(t('resetBody', { name: row.name, email: row.email }))}</p>
    </Modal>
  );
}

export function SendLinkDialog({ req, open, onOpenChange }: { req: PasswordResetRequest | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT(m);
  const tc = useT(common);
  const ta = useT(acm);
  const mut = useApiMutation((api, id: string) => api.sendResetLink(id), [qk.pwRequests, qk.audit]);
  if (!req) return null;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('sendTitle')}
      icon="send"
      actions={
        <>
          <Button variant="o" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            icon="send"
            disabled={mut.isPending}
            onClick={async () => {
              await mut.mutateAsync(req.id);
              toast.success(t('resetDone'));
              onOpenChange(false);
            }}
          >
            {t('send')}
          </Button>
        </>
      }
    >
      <Card className="px-3.5 py-1">
        <Row icon="user" label={tc('name')}>{req.name}</Row>
        <Row icon="mail" label="Email">{req.email}</Row>
        <Row icon="shield-check" label="OTP">{ta('verified')}</Row>
      </Card>
      <p className="mt-3 text-[12.5px] text-muted">{t('sendBody')}</p>
    </Modal>
  );
}

