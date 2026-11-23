import { useState } from 'react';
import { qk, useApiQuery } from '@dyh/api';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Loading } from '@/components/ui/display';
import { FilterBar, FilterSelect, Input, SearchBox, type Filters } from '@/components/ui/form';
import { EmptyRow, Table, Td, Th } from '@/components/ui/table';
import { Icon } from '@/lib/icon';
import { matches } from '@/lib/utils';
import { downloadCsv, useAm } from './shared';

const m = defineMessages('admin.audit', {
  search: ['Hanapin ang user, aksyon o detalye...', 'Search user, action or detail...'],
  action: ['Aksyon', 'Action'],
  details: ['Detalye', 'Details'],
  locked: ['Hindi mabubura o mababago ang audit logs.', 'Audit logs cannot be deleted or edited.'],
  chain: ['Blockchain hash verification — konsepto lamang. Hindi pa pinal ang provider.', 'Blockchain hash verification — concept/placeholder only. Provider not finalized.'],
  Admin: ['Admin', 'Admin'],
  Doctor: ['Doktor', 'Doctor'],
  Secretary: ['Sekretarya', 'Secretary'],
});

export default function Audit() {
  const t = useT(m);
  const tc = useT(common);
  const a = useAm();
  const loc = useLoc();
  const { data: logs } = useApiQuery(qk.audit, (x) => x.getAuditLogs());
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({});
  const [date, setDate] = useState('2026-10-30');
  if (!logs) return <Loading />;
  const rows = logs.filter((l) => (!f.rl || l.role === f.rl) && (!f.ac || loc(l.action) === f.ac) && (!f.us || l.user === f.us) && matches([l.user, loc(l.action), loc(l.details)], q));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox className="w-[340px] max-w-full" value={q} onChange={setQ} placeholder={t('search')} />
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px] py-2" aria-label={tc('date')} />
          <Button variant="o" size="sm" icon="download" onClick={() => downloadCsv(`dyh-audit-${date}.csv`, [['Time', 'User', 'Role', 'Action', 'Details', 'Hash'], ...rows.map((l) => [l.time, l.user, l.role, loc(l.action), loc(l.details), l.hash])])}>
            {a('exportBtn')}
          </Button>
        </div>
      </div>
      <FilterBar active={Object.values(f).some(Boolean)} onClear={() => setF({})}>
        <FilterSelect label={a('role')} value={f.rl ?? ''} onChange={(v) => setF({ ...f, rl: v })} options={(['Admin', 'Doctor', 'Secretary'] as const).map((r) => ({ value: r, label: t(r) }))} />
        <FilterSelect label={t('action')} value={f.ac ?? ''} onChange={(v) => setF({ ...f, ac: v })} options={[...new Set(logs.map((l) => loc(l.action)))].map((x) => ({ value: x, label: x }))} />
        <FilterSelect label="User" value={f.us ?? ''} onChange={(v) => setF({ ...f, us: v })} options={[...new Set(logs.map((l) => l.user))].map((x) => ({ value: x, label: x }))} />
      </FilterBar>
      <Alert icon="lock" className="mt-3">
        {t('locked')}
      </Alert>
      <Table className="mt-3">
        <thead>
          <tr>
            <Th>{tc('time')}</Th>
            <Th>User</Th>
            <Th>{a('role')}</Th>
            <Th>{t('action')}</Th>
            <Th>{t('details')}</Th>
            <Th>Integrity</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <Td nowrap className="text-muted">{l.time}</Td>
              <Td nowrap>
                <b>{l.user}</b>
              </Td>
              <Td>
                <Badge>{t(l.role)}</Badge>
              </Td>
              <Td nowrap>{loc(l.action)}</Td>
              <Td>{loc(l.details)}</Td>
              <Td>
                <span className="font-mono text-[11px] text-muted">{l.hash}</span>
              </Td>
            </tr>
          ))}
          <EmptyRow cols={6} show={!rows.length} />
        </tbody>
      </Table>
      <div className="mt-3 flex items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line bg-sky-2 p-3 text-[12.5px] text-muted">
        <Icon name="link-2" size={16} />
        {t('chain')}
      </div>
    </>
  );
}
