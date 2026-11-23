import { useState } from 'react';
import { CREDENTIAL_OPTIONS, SUFFIXES, displayName, padNum, seededInt, type AdminAccount, type Doctor, type ISODate, type PermissionSet, type Secretary } from '@dyh/core';
import { defineMessages, useLoc, useT } from '@dyh/i18n';
import { Card } from '@/components/ui/display';
import { CheckRow, Checkbox, Chip, Field, Input, SearchBox } from '@/components/ui/form';
import { ListEmpty } from '@/components/ui/table';
import { MODULES } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { matches } from '@/lib/utils';
import { useAm, useSpecName } from '../shared';

export const acm = defineMessages('admin.accounts', {
  doctors: ['Mga Doktor', 'Doctors'],
  createAccount: ['Gumawa ng Account', 'Create Account'],
  onlySuper: ['Super Admin lamang ang gumagawa ng Admin', 'Only the Super Admin creates Admins'],
  sameEmail: ['Puwedeng gamitin ng Admin ang **parehong email at mobile** ng kanyang doctor account. **Magkaiba ang login credentials** at magkaiba rin ang interface (Admin Portal vs Doctor App).', 'An Admin may use the **same email and mobile** as their doctor account. The **login credentials are separate**, and so are the interfaces (Admin Portal vs Doctor App).'],
  searchDoc: ['Hanapin ang pangalan, email o kuwarto...', 'Search name, email or room...'],
  searchOther: ['Hanapin ang pangalan, email o doktor...', 'Search name, email or doctor...'],
  nAccounts: ['{{n}} account', '{{n}} accounts'],
  assignedDoctor: ['Doktor na hawak', 'Assigned doctor'],
  assignedDoctors: ['Mga Naka-assign na Doktor', 'Assigned Doctors'],
  count: ['Bilang', 'Count'],
  access: ['Access', 'Access'],
  allModules: ['Lahat ng modyul · buong access', 'All modules · full access'],
  nModules: ['{{n}} modyul', '{{n}} modules'],
  pwRequests: ['Mga Request sa Pag-reset ng Password', 'Password Reset Requests'],
  nPending: ['{{n}} nakabinbin', '{{n}} pending'],
  nonePending: ['Wala nang nakabinbin', 'None pending'],
  requested: ['Petsa', 'Requested'],
  message: ['Mensahe', 'Message'],
  verified: ['Na-verify', 'Verified'],
  sendLink: ['Ipadala ang Reset Link', 'Send Reset Link'],
  linkSent: ['Naipadala', 'Link sent'],
  view: ['Tingnan', 'View'],
  resetPw: ['I-reset ang Password', 'Reset Password'],
  deactivate: ['I-deactivate', 'Deactivate'],
  activate: ['I-activate', 'Activate'],
  // name fields
  first: ['Pangalan', 'First Name'],
  middle: ['Gitnang Pangalan', 'Middle Name'],
  last: ['Apelyido', 'Last Name'],
  suffix: ['Suffix', 'Suffix'],
  creds: ['Titulo / Lisensya (puwedeng marami)', 'Credentials / Licenses (multiple allowed)'],
  credsOther: ['Iba pa (hal. MPH, FPSO)', 'Others (e.g. MPH, FPSO)'],
  displaysAs: ['Lalabas bilang', 'Displays as'],
  // permissions
  module: ['Modyul', 'Module'],
  permHint: ['Kapag naka-check ang Access, makikita (view) ang modyul. Ang Create / Update / Delete ang nagpapasya kung ano ang puwedeng gawin.', 'Access lets the admin view the module. Create / Update / Delete decide what they can do in it.'],
});

export interface NameForm {
  first: string;
  middle: string;
  last: string;
  suffix: string;
  creds: string[];
  credOther: string;
}
export const emptyName = (creds: string[] = []): NameForm => ({ first: '', middle: '', last: '', suffix: '', creds, credOther: '' });
export const allCreds = (n: NameForm) => [...n.creds, ...(n.credOther.trim() ? n.credOther.split(',').map((x) => x.trim()) : [])];
export const fullName = (n: NameForm, doctor: boolean) => displayName(n, allCreds(n), doctor);
/** Name without the credential suffix, used as the account's display name. */
export const plainName = (n: NameForm, doctor: boolean) => fullName(n, doctor).split(', ')[0];

export function NameFields({ value, onChange, doctor }: { value: NameForm; onChange: (n: NameForm) => void; doctor: boolean }) {
  const t = useT(acm);
  const set = (p: Partial<NameForm>) => onChange({ ...value, ...p });
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('first')} icon="user" className="mt-0">
          <Input placeholder="Juan" value={value.first} onChange={(e) => set({ first: e.target.value })} />
        </Field>
        <Field label={t('middle')} icon="user-round" optional className="mt-0">
          <Input placeholder="Perez" value={value.middle} onChange={(e) => set({ middle: e.target.value })} />
        </Field>
        <Field label={t('last')} icon="user" className="mt-0">
          <Input placeholder="Dela Cruz" value={value.last} onChange={(e) => set({ last: e.target.value })} />
        </Field>
        <Field label={t('suffix')} icon="tag" optional className="mt-0">
          <select className="w-full rounded-xl border-[1.5px] border-line bg-field px-3.5 py-[11px]" value={value.suffix} onChange={(e) => set({ suffix: e.target.value })}>
            {SUFFIXES.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {doctor && (
        <Field label={t('creds')} icon="award">
          <div className="flex flex-wrap gap-2">
            {CREDENTIAL_OPTIONS.map((c) => (
              <Chip key={c} on={value.creds.includes(c)} onClick={() => set({ creds: value.creds.includes(c) ? value.creds.filter((x) => x !== c) : [...value.creds, c] })}>
                {c}
              </Chip>
            ))}
          </div>
          <Input className="mt-2" placeholder={t('credsOther')} value={value.credOther} onChange={(e) => set({ credOther: e.target.value })} />
        </Field>
      )}
      <Card className="mt-3 flex items-center gap-2 px-3 py-2.5 text-[12.5px]">
        <Icon name="id-card" size={16} />
        <span className="text-muted">{t('displaysAs')}:</span>
        <b>{fullName(value, doctor) || '—'}</b>
      </Card>
    </>
  );
}

export function PermTable({ value, onChange }: { value: PermissionSet; onChange?: (p: PermissionSet) => void }) {
  const t = useT(acm);
  const loc = useLoc();
  const edit = !!onChange;
  const toggle = (mod: keyof PermissionSet, op: 'c' | 'u' | 'd' | null, on: boolean) => {
    const next: PermissionSet = JSON.parse(JSON.stringify(value));
    if (!op) {
      if (on) next[mod] = next[mod] ?? {};
      else delete next[mod];
    } else {
      next[mod] = next[mod] ?? {};
      if (on) next[mod]![op] = true;
      else delete next[mod]![op];
    }
    onChange?.(next);
  };
  return (
    <>
      <div className="mt-2 overflow-x-auto rounded-[14px] border border-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-sky-2 text-[11px] uppercase tracking-[.05em] text-muted">
              <th className="px-3 py-2 text-left">{t('module')}</th>
              <th className="px-3 py-2">{t('access')}</th>
              <th className="px-3 py-2">Create</th>
              <th className="px-3 py-2">Update</th>
              <th className="px-3 py-2">Delete</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => {
              const g = value[mod.id];
              return (
                <tr key={mod.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[12.5px]">
                      <Icon name={mod.icon} size={15} />
                      <b>{loc(mod.label)}</b>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex">
                      <Checkbox label={`${loc(mod.label)} access`} checked={!!g} disabled={!edit} onChange={(v) => toggle(mod.id, null, v)} />
                    </span>
                  </td>
                  {(['c', 'u', 'd'] as const).map((op) => (
                    <td key={op} className="px-3 py-2 text-center">
                      {mod.crud.includes(op) ? (
                        <span className="inline-flex">
                          <Checkbox label={`${loc(mod.label)} ${op}`} checked={!!g?.[op]} disabled={!edit || !g} onChange={(v) => toggle(mod.id, op, v)} />
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted">
        <Icon name="info" size={13} />
        {t('permHint')}
      </div>
    </>
  );
}

export function DoctorChecks({ doctors, value, onChange }: { doctors: Doctor[]; value: string[]; onChange: (ids: string[]) => void }) {
  const a = useAm();
  const spec = useSpecName();
  const [q, setQ] = useState('');
  const list = doctors.filter((d) => matches([d.name, spec(d.specializationId), d.room], q));
  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder={a('searchDoctor')} />
      <div className="mt-2 flex max-h-[230px] flex-col gap-1.5 overflow-y-auto">
        {list.map((d) => (
          <CheckRow key={d.id} checked={value.includes(d.id)} onChange={(on) => onChange(on ? [...value, d.id] : value.filter((x) => x !== d.id))}>
            <div className="min-w-0 flex-1">
              <b className="text-[13px]">{d.name}</b>
              <div className="text-[11.5px] text-muted">
                {spec(d.specializationId)} · {a('roomN', { n: d.room })} · {a('floorShort', { n: d.floor })}
              </div>
            </div>
          </CheckRow>
        ))}
        <ListEmpty show={!list.length} />
      </div>
    </>
  );
}

/* ---------- unified account rows for the three tabs ---------- */

export type AccountKind = 'doctor' | 'secretary' | 'admin';
export interface AccountRow {
  id: string;
  kind: AccountKind;
  name: string;
  email: string;
  mobile: string;
  status: 'active' | 'deactivated';
  createdAt: ISODate;
  createdBy: string;
  doctor?: Doctor;
  secretary?: Secretary;
  admin?: AdminAccount;
}

/** Doctors from the seed data have no audit trail yet; derive stable demo values. */
const doctorCreated = (d: Doctor): Pick<AccountRow, 'createdAt' | 'createdBy'> => ({
  createdAt: `2024-${padNum(seededInt(d.id + 'cm', 1, 12), 2)}-${padNum(seededInt(d.id + 'cd', 1, 28), 2)}`,
  createdBy: seededInt(d.id + 'cb', 0, 9) < 6 ? 'Admin Delos Reyes' : 'Patricia Gonzales',
});

export const fromDoctor = (d: Doctor): AccountRow => ({ id: d.id, kind: 'doctor', name: d.name, email: d.email, mobile: d.mobile, status: d.status, ...doctorCreated(d), doctor: d });
export const fromSecretary = (s: Secretary): AccountRow => ({ id: s.id, kind: 'secretary', name: s.name, email: s.email, mobile: s.mobile, status: s.status, createdAt: s.createdAt, createdBy: s.createdBy, secretary: s });
export const fromAdmin = (a: AdminAccount): AccountRow => ({ id: a.id, kind: 'admin', name: a.name, email: a.email, mobile: a.mobile, status: a.status, createdAt: a.createdAt, createdBy: a.createdBy, admin: a });
