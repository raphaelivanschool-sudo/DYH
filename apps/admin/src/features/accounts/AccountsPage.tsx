import { useMemo, useState } from 'react';
import { qk, useApiQuery, useDoctors, useSpecializations } from '@dyh/api';
import { CREDENTIAL_OPTIONS, type PasswordResetRequest } from '@dyh/core';
import { common, useLang, useLoc, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Avatar, Badge, CredBadges, Loading, Panel, Rich, StatusBadge } from '@/components/ui/display';
import { FilterBar, FilterSelect, SearchBox, Segmented, filterOk, type Filters } from '@/components/ui/form';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { roleMsgs, useAdmins, usePerms, useRooms, useSecretaries } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { matches, shortDate, shortSpec } from '@/lib/utils';
import { roomConflicts } from '@dyh/core';
import { useAm, useSpecName, useStatusOptions } from '../shared';
import { AccountDialog, NewAccountDialog, ResetDialog, SendLinkDialog, StatusDialog } from './dialogs';
import { acm, fromAdmin, fromDoctor, fromSecretary, type AccountKind, type AccountRow } from './parts';

type Dlg = { kind: 'view' | 'status' | 'reset'; row: AccountRow } | { kind: 'new' } | { kind: 'link'; req: PasswordResetRequest } | null;

export default function AccountsPage() {
  const t = useT(acm);
  const tc = useT(common);
  const tr = useT(roleMsgs);
  const a = useAm();
  const loc = useLoc();
  const [lang] = useLang();
  const spec = useSpecName();
  const statusOpts = useStatusOptions();
  const { isSuper, canDo } = usePerms();
  const { data: doctors } = useDoctors();
  const { data: specs = [] } = useSpecializations();
  const { data: secs } = useSecretaries();
  const { data: admins } = useAdmins();
  const { data: rooms = [] } = useRooms();
  const { data: pw = [] } = useApiQuery(qk.pwRequests, (x) => x.getPasswordRequests());
  const [tab, setTab] = useState<AccountKind>('doctor');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({});
  const [pf, setPf] = useState<Filters>({});
  const [dlg, setDlg] = useState<Dlg>(null);
  const setFilter = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const conflictIds = useMemo(() => new Set(doctors ? rooms.flatMap((r) => roomConflicts(r, doctors).map((d) => d.id)) : []), [rooms, doctors]);

  if (!doctors || !secs || !admins) return <Loading />;
  const docName = (id: string) => doctors.find((d) => d.id === id)?.name ?? id;

  const rows: AccountRow[] =
    tab === 'doctor'
      ? doctors
          .filter((d) => filterOk(f, 'sp', d.specializationId) && filterOk(f, 'fl', d.floor) && filterOk(f, 'st', d.status) && (!f.cr || d.credentials.includes(f.cr)))
          .map(fromDoctor)
          .filter((r) => matches([r.name, r.email, spec(r.doctor!.specializationId), r.doctor!.room], q))
      : tab === 'secretary'
        ? secs
            .filter((s) => filterOk(f, 'st', s.status) && (!f.dc || s.doctorIds.includes(f.dc)))
            .map(fromSecretary)
            .filter((r) => matches([r.name, r.email, ...r.secretary!.doctorIds.map(docName)], q))
        : admins
            .filter((x) => filterOk(f, 'rl', x.role) && filterOk(f, 'st', x.status) && filterOk(f, 'ad', x.doctorId ? 'y' : 'n'))
            .map(fromAdmin)
            .filter((r) => matches([r.name, r.email, tr(r.admin!.role)], q));

  const canCreate = tab === 'admin' ? isSuper : canDo('accounts', 'c');
  const pending = pw.filter((w) => w.status === 'pending').length;
  const pwRows = pw.filter((w) => filterOk(pf, 'r', w.role) && filterOk(pf, 's', w.status));

  const actions = (r: AccountRow) => {
    const isSup = r.admin?.role === 'super';
    const mU = r.kind === 'admin' ? isSuper && !isSup : canDo('accounts', 'u');
    const mD = r.kind === 'admin' ? isSuper && !isSup : canDo('accounts', 'd');
    return (
      <div className="flex justify-end gap-1.5">
        <Button variant="o" size="sm" icon="eye" title={t('view')} aria-label={t('view')} onClick={() => setDlg({ kind: 'view', row: r })} />
        {mU && <Button variant="o" size="sm" icon="key-round" title={t('resetPw')} aria-label={t('resetPw')} onClick={() => setDlg({ kind: 'reset', row: r })} />}
        {mD && (
          <Button
            variant={r.status === 'active' ? 'r' : 'ok'}
            size="sm"
            icon="power"
            title={r.status === 'active' ? t('deactivate') : t('activate')}
            aria-label={r.status === 'active' ? t('deactivate') : t('activate')}
            onClick={() => setDlg({ kind: 'status', row: r })}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          className="w-[480px] max-w-full"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setF({});
            setQ('');
          }}
          options={[
            { value: 'doctor', label: t('doctors'), icon: 'stethoscope' },
            { value: 'secretary', label: a('secretaries'), icon: 'clipboard-list' },
            { value: 'admin', label: a('admins'), icon: 'shield' },
          ]}
        />
        {canCreate ? (
          <Button icon="user-plus" onClick={() => setDlg({ kind: 'new' })}>
            {t('createAccount')}
          </Button>
        ) : tab === 'admin' ? (
          <Badge icon="crown">{t('onlySuper')}</Badge>
        ) : (
          <Badge icon="eye">{tc('readOnly')}</Badge>
        )}
      </div>

      {tab === 'admin' && (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(['super', 'admin'] as const).map((r) => (
              <Panel key={r} className="p-3.5">
                <div className="flex items-center justify-between">
                  <Badge tone={r === 'super' ? 'purple' : 'blue'} icon={r === 'super' ? 'crown' : 'shield'}>
                    {tr(r)}
                  </Badge>
                  <span className="text-[11px] text-muted">{admins.filter((x) => x.role === r).length} account</span>
                </div>
                <div className="mt-2 text-[12.5px] text-muted">{tr(r === 'super' ? 'superDesc' : 'adminDesc')}</div>
              </Panel>
            ))}
          </div>
          <Alert icon="stethoscope" className="mt-3">
            <Rich text={t('sameEmail')} />
          </Alert>
        </>
      )}

      {tab === 'doctor' && (
        <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
          <FilterSelect label={tc('specialization')} value={f.sp ?? ''} onChange={setFilter('sp')} options={specs.map((s) => ({ value: s.id, label: shortSpec(loc(s.name)) }))} />
          <FilterSelect label={tc('floor')} value={f.fl ?? ''} onChange={setFilter('fl')} options={['1', '2', '3'].map((x) => ({ value: x, label: x }))} />
          <FilterSelect label={a('credential')} value={f.cr ?? ''} onChange={setFilter('cr')} options={CREDENTIAL_OPTIONS.map((c) => ({ value: c, label: c }))} />
          <FilterSelect label={tc('status')} value={f.st ?? ''} onChange={setFilter('st')} options={statusOpts} />
        </FilterBar>
      )}
      {tab === 'secretary' && (
        <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
          <FilterSelect label={t('assignedDoctor')} value={f.dc ?? ''} onChange={setFilter('dc')} options={doctors.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label={tc('status')} value={f.st ?? ''} onChange={setFilter('st')} options={statusOpts} />
        </FilterBar>
      )}
      {tab === 'admin' && (
        <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
          <FilterSelect label={a('role')} value={f.rl ?? ''} onChange={setFilter('rl')} options={[{ value: 'super', label: tr('super') }, { value: 'admin', label: tr('admin') }]} />
          <FilterSelect label={a('alsoDoctor')} value={f.ad ?? ''} onChange={setFilter('ad')} options={[{ value: 'y', label: a('yes') }, { value: 'n', label: a('no') }]} />
          <FilterSelect label={tc('status')} value={f.st ?? ''} onChange={setFilter('st')} options={statusOpts} />
        </FilterBar>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SearchBox className="w-[340px] max-w-full" value={q} onChange={setQ} placeholder={tab === 'doctor' ? t('searchDoc') : t('searchOther')} />
        <span className="text-[12.5px] text-muted">{t('nAccounts', { n: rows.length })}</span>
      </div>

      <Table className="mt-3">
        <thead>
          <tr>
            {tab === 'admin' ? (
              <>
                <Th>Admin</Th>
                <Th>{a('role')}</Th>
                <Th>{t('access')}</Th>
                <Th>{a('created')}</Th>
              </>
            ) : tab === 'doctor' ? (
              <>
                <Th>{tc('doctor')}</Th>
                <Th>{tc('specialization')}</Th>
                <Th>{tc('room')}</Th>
              </>
            ) : (
              <>
                <Th>{a('secretary')}</Th>
                <Th>{t('assignedDoctors')}</Th>
                <Th num>{t('count')}</Th>
              </>
            )}
            <Th>{a('createdBy')}</Th>
            <Th>{tc('status')}</Th>
            <Th className="text-right">{tc('actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <div className="flex items-center gap-2.5 whitespace-nowrap">
                  <Avatar name={r.name} light />
                  <div>
                    <b>{r.name}</b>
                    <div className="text-[11.5px] text-muted">{r.email}</div>
                    {r.doctor && <CredBadges creds={r.doctor.credentials} />}
                    {r.admin?.credentials?.length ? <CredBadges creds={r.admin.credentials} /> : null}
                  </div>
                </div>
              </Td>
              {r.admin && (
                <>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={r.admin.role === 'super' ? 'purple' : 'blue'} icon={r.admin.role === 'super' ? 'crown' : 'shield'}>
                        {tr(r.admin.role)}
                      </Badge>
                      {r.admin.doctorId && <Badge tone="teal" icon="stethoscope">{a('alsoDoctor')}</Badge>}
                    </span>
                  </Td>
                  <Td nowrap className="text-[12.5px]">
                    {r.admin.role === 'super' ? t('allModules') : t('nModules', { n: Object.keys(r.admin.permissions).length })}
                  </Td>
                  <Td nowrap className="text-[12.5px]">{shortDate(r.createdAt, lang)}</Td>
                </>
              )}
              {r.doctor && (
                <>
                  <Td>{spec(r.doctor.specializationId)}</Td>
                  <Td nowrap>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="door-open" size={15} /> {r.doctor.room}
                      <span className="text-[11px] text-muted">· {a('floorShort', { n: r.doctor.floor })}</span>
                      {conflictIds.has(r.doctor.id) && <Badge tone="red" icon="triangle-alert" />}
                    </span>
                  </Td>
                </>
              )}
              {r.secretary && (
                <>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {r.secretary.doctorIds.map((id) => (
                        <Badge key={id} tone="blue">{docName(id)}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td num>{r.secretary.doctorIds.length}</Td>
                </>
              )}
              <Td nowrap className="text-[12.5px]">{r.createdBy}</Td>
              <Td>
                <StatusBadge status={r.status} />
              </Td>
              <Td>{actions(r)}</Td>
            </tr>
          ))}
          <EmptyRow cols={tab === 'admin' ? 7 : 6} show={!rows.length} />
        </tbody>
      </Table>

      <Panel flush className="mt-5" title={t('pwRequests')} icon="key-round" right={pending ? <Badge tone="amber">{t('nPending', { n: pending })}</Badge> : <Badge tone="green">{t('nonePending')}</Badge>}>
        <div className="px-[18px] pb-2.5">
          <FilterBar active={Object.values(pf).some(Boolean)} onClear={() => setPf({})}>
            <FilterSelect label={a('role')} value={pf.r ?? ''} onChange={(v) => setPf((x) => ({ ...x, r: v }))} options={[{ value: 'doctor', label: tc('doctor') }, { value: 'secretary', label: a('secretary') }]} />
            <FilterSelect label={tc('status')} value={pf.s ?? ''} onChange={(v) => setPf((x) => ({ ...x, s: v }))} options={[{ value: 'pending', label: tc('st_pending') }, { value: 'sent', label: tc('st_sent') }]} />
          </FilterBar>
        </div>
        <Table flat>
          <thead>
            <tr>
              <Th>{tc('name')}</Th>
              <Th>{a('role')}</Th>
              <Th>{t('requested')}</Th>
              <Th>OTP</Th>
              <Th>{t('message')}</Th>
              <Th>{tc('status')}</Th>
              <Th className="text-right">{tc('actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {pwRows.map((w) => (
              <tr key={w.id}>
                <Td>
                  <b>{w.name}</b>
                  <div className="text-[11.5px] text-muted">{w.email}</div>
                </Td>
                <Td>
                  <Badge>{w.role === 'doctor' ? tc('doctor') : a('secretary')}</Badge>
                </Td>
                <Td nowrap>
                  {shortDate(w.requestedOn, lang)} · {w.time}
                </Td>
                <Td>
                  <Badge tone="green" icon="shield-check">{t('verified')}</Badge>
                </Td>
                <Td className="text-[12.5px] text-muted">{w.message || '—'}</Td>
                <Td>
                  <StatusBadge status={w.status} />
                </Td>
                <Td className="text-right">
                  {w.status === 'sent' ? (
                    <span className="text-[11.5px] text-muted">{t('linkSent')}</span>
                  ) : (
                    <Button size="sm" icon="send" onClick={() => setDlg({ kind: 'link', req: w })} disabled={!canDo('accounts', 'u')}>
                      {t('sendLink')}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
            <EmptyRow cols={7} show={!pwRows.length} />
          </tbody>
        </Table>
      </Panel>

      <NewAccountDialog kind={tab} open={dlg?.kind === 'new'} onOpenChange={(v) => !v && setDlg(null)} />
      <AccountDialog row={dlg?.kind === 'view' ? liveRow(dlg.row, doctors, secs, admins) : null} open={dlg?.kind === 'view'} onOpenChange={(v) => !v && setDlg(null)} />
      <StatusDialog row={dlg?.kind === 'status' ? dlg.row : null} open={dlg?.kind === 'status'} onOpenChange={(v) => !v && setDlg(null)} />
      <ResetDialog row={dlg?.kind === 'reset' ? dlg.row : null} open={dlg?.kind === 'reset'} onOpenChange={(v) => !v && setDlg(null)} />
      <SendLinkDialog req={dlg?.kind === 'link' ? dlg.req : null} open={dlg?.kind === 'link'} onOpenChange={(v) => !v && setDlg(null)} />
    </>
  );
}

/** Re-read the row from fresh query data so the dialog reflects saved edits. */
function liveRow(row: AccountRow, doctors: NonNullable<ReturnType<typeof useDoctors>['data']>, secs: NonNullable<ReturnType<typeof useSecretaries>['data']>, admins: NonNullable<ReturnType<typeof useAdmins>['data']>): AccountRow {
  if (row.kind === 'doctor') {
    const d = doctors.find((x) => x.id === row.id);
    return d ? fromDoctor(d) : row;
  }
  if (row.kind === 'secretary') {
    const s = secs.find((x) => x.id === row.id);
    return s ? fromSecretary(s) : row;
  }
  const ad = admins.find((x) => x.id === row.id);
  return ad ? fromAdmin(ad) : row;
}
