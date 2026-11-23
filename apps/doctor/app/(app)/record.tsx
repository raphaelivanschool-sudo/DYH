import { useState } from 'react';
import { View } from 'react-native';
import { useApiMutation, useDoctors, useSpecializations, useTodayVitals } from '@dyh/api';
import { canAddAddendum, initials, type ConsultationRecord } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Avatar, Badge, Button, Card, Dialog, Empty, Field, Icon, Input, LinkText, PriorityBadge, Row, Screen, SearchBox, SectionTitle, StatusBadge, Txt, TypeBadge, VitalsCard, VitalsGrid, matches, toast } from '@dyh/ui-native';
import { AddendumDialog, DelegateDialog } from '../../src/components/dialogs';
import { DocHeader, go, openRecord } from '../../src/components/shell';
import { VITALS_QNO, useDates, useDoctorId, useDraftFor, useHistory, usePatient, usePatients } from '../../src/lib';
import { dm } from '../../src/msgs';
import { useUi } from '../../src/store';

export default function Record() {
  const open = useUi((s) => s.recordOpen);
  const pid = useUi((s) => s.patientId);
  return open && pid ? <OpenRecord pid={pid} /> : <PatientSearch />;
}

function PatientSearch() {
  const t = useT(dm);
  const tc = useT(common);
  const dt = useDates();
  const { data: pts } = usePatients();
  const [q, setQ] = useState('');
  const list = (pts ?? []).filter((p) => matches([p.displayName, p.id], q));
  return (
    <Screen header={<DocHeader title={t('record')} icon="folder-heart" />}>
      <Alert kind="info" icon="shield-check" text={t('searchNote')} />
      <SearchBox value={q} onChange={setQ} placeholder={t('searchPh')} className="mt-3" />
      <Row className="mt-3 justify-between">
        <Txt w="b" size={12.5} className="text-muted">
          {t('yourPts')} ({pts?.length ?? 0})
        </Txt>
        <Button size="sm" variant="o" icon="scan-qr-code" onPress={() => useUi.getState().set({ scan: true })}>
          QR
        </Button>
      </Row>
      <View className="mt-2 gap-2">
        {list.map((p) => (
          <Card key={p.id} className="flex-row items-center gap-3 p-3.5" onPress={() => openRecord(p.id)}>
            <Avatar text={initials(p.displayName)} light />
            <View className="flex-1">
              <Txt w="b">{p.displayName}</Txt>
              <Txt size={12} className="text-muted">
                {p.id} · {p.age} {tc('years')}
              </Txt>
              {p.lastVisit && (
                <Txt size={11} className="mt-1 text-muted">
                  {t('lastVisit')}: {dt.short(p.lastVisit)}
                </Txt>
              )}
            </View>
            <PriorityBadge p={p.priority} />
            <Icon name="lock" size={16} color="muted" />
          </Card>
        ))}
        {!list.length && <Empty text={tc('noResults')} />}
      </View>
    </Screen>
  );
}

function OpenRecord({ pid }: { pid: string }) {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const dt = useDates();
  const me = useDoctorId();
  const p = usePatient(pid);
  const { data: vitals } = useTodayVitals();
  const { data: hist } = useHistory(pid);
  const { draft, fuPending } = useDraftFor(pid);
  const delegated = useUi((s) => s.delegated.includes(pid));
  const [q, setQ] = useState('');
  const [view, setView] = useState<ConsultationRecord | null>(null);
  const [addendum, setAddendum] = useState(false);
  const [deleg, setDeleg] = useState(false);
  if (!p) return null;
  const allergy = p.allergies.length ? p.allergies.join(', ') : t('noneAllergy');
  const list = (hist ?? []).filter((r) => matches([...r.diagnoses.map(loc), r.doctorName, ...r.prescriptions.map((x) => x.medicine)], q));
  const startConsult = (fromDraft: boolean) => {
    useUi.getState().set({ consultFromDraft: fromDraft });
    go('/consult');
  };

  return (
    <Screen
      header={
        <DocHeader
          title={t('record')}
          icon="folder-heart"
          right={
            <Button size="sm" variant="o" icon="lock" onPress={() => useUi.getState().set({ recordOpen: false })}>
              {t('closeRec')}
            </Button>
          }
        />
      }
    >
      <Card>
        <Row gap="gap-3">
          <Avatar text={initials(p.displayName)} size="lg" />
          <View className="flex-1">
            <Txt w="b" size={17}>
              {p.displayName}
            </Txt>
            <Row gap="gap-1">
              <Icon name="id-card" size={13} color="muted" />
              <Txt size={12} className="text-muted">
                {p.id}
              </Txt>
            </Row>
            <Row className="mt-1" gap="gap-1.5">
              <PriorityBadge p={p.priority} />
              <Badge>
                {p.age} · {p.sex === 'F' ? tc('female') : tc('male')}
              </Badge>
            </Row>
          </View>
        </Row>
        <Row className="mt-3" gap="gap-2">
          {(
            [
              ['droplet', t('blood'), p.bloodType, false],
              ['triangle-alert', 'Allergy', allergy, !!p.allergies.length],
              ['history', t('visits'), String(p.visits ?? 0), false],
            ] as const
          ).map(([i, l, v, red]) => (
            <View key={l} className="flex-1 rounded-[14px] border border-line bg-card p-2.5">
              <Row gap="gap-1">
                <Icon name={i} size={12} color="muted" />
                <Txt w="s" size={11} className="text-muted">
                  {l}
                </Txt>
              </Row>
              <Txt w="x" size={15} className={red ? 'text-red' : 'text-ink'} numberOfLines={1}>
                {v}
              </Txt>
            </View>
          ))}
        </Row>
      </Card>

      <VitalsCard v={vitals?.[VITALS_QNO[pid] ?? '']} />
      <Alert kind="ok" icon="shield-check" className="mt-3" text={t('openedSafe')} />

      {draft ? (
        <>
          <Button full icon="file-check" className="mt-3" onPress={() => startConsult(true)}>
            {t('reviewSign')}
          </Button>
          <Button full variant="g" icon="calendar-plus" className="mt-2" onPress={() => go('/followup')}>
            {t('followUp')}
          </Button>
        </>
      ) : (
        <Row className="mt-3" gap="gap-2">
          <Button className="flex-1" icon="pen-line" onPress={() => startConsult(false)}>
            {t('newConsult')}
          </Button>
          <Button className="flex-1" variant="g" icon="calendar-plus" onPress={() => go('/followup')}>
            {t('followUp')}
          </Button>
        </Row>
      )}
      {!draft && !delegated && (
        <Button full variant="o" icon="send" className="mt-2" onPress={() => setDeleg(true)}>
          {t('delegate')}
        </Button>
      )}

      {fuPending && (
        <Card className="mt-3 border-purple bg-purple-bg p-3.5">
          <Row gap="gap-2" className="items-start">
            <Icon name="calendar-clock" size={18} color="purple" />
            <View className="flex-1">
              <Txt size={13}>
                <Txt w="b" size={13}>
                  {t('fuAwait')}
                </Txt>{' '}
                — {t('fuAwaitSub')}
              </Txt>
              <View className="mt-1.5">
                <LinkText icon="eye" onPress={() => go('/followup')}>
                  {t('reviewFu')}
                </LinkText>
              </View>
            </View>
          </Row>
        </Card>
      )}
      {draft && (
        <Alert
          kind="warn"
          icon="file-clock"
          className="mt-3"
          text={`**${t('draftFrom', { n: `Sek. ${draft.preparedBy}` })}** (${draft.preparedAt} · ${draft.mode === 'photo' ? t('photo') : t('text')})${draft.followUp ? ` · ${t('withFu')}` : ''}.`}
        />
      )}
      {!draft && delegated && <Alert kind="info" icon="send" className="mt-3" text={t('sentSec')} />}

      <SectionTitle icon="history">{t('history')}</SectionTitle>
      <SearchBox value={q} onChange={setQ} placeholder={t('histSearch')} />
      <View className="mt-3 border-l-2 border-line pl-3.5">
        {list.map((r) => (
          <View key={r.id} className="mb-3">
            <View className="absolute -left-[21px] top-4 h-3 w-3 rounded-full border-2 border-card bg-blue" />
            <Card className="p-3.5" onPress={() => setView(r)}>
              <Row className="justify-between">
                <Row gap="gap-1">
                  <Icon name="calendar" size={13} color="blue" />
                  <Txt w="b" size={12.5} className="text-blue">
                    {dt.short(r.date)}
                  </Txt>
                </Row>
                <StatusBadge status="signed" />
              </Row>
              <Txt w="b" className="mt-1">
                {loc(r.title)}
              </Txt>
              <Txt size={12.5} className="mt-1 text-muted">
                {r.diagnoses.map(loc).join(', ')}
              </Txt>
              <Row className="mt-2 justify-between">
                <Row gap="gap-1.5">
                  <Icon name="pen-tool" size={13} color="muted" />
                  <Txt w="b" size={12.5}>
                    {r.doctorName}
                  </Txt>
                  {r.doctorId === me && <Badge tone="blue">{t('you')}</Badge>}
                </Row>
                <Row gap="gap-0.5">
                  <Txt w="b" size={12} className="text-blue">
                    {t('fullDetails')}
                  </Txt>
                  <Icon name="chevron-right" size={14} color="blue" />
                </Row>
              </Row>
              {r.addendum && (
                <View className="mt-2 flex-row items-center gap-2 rounded-xl bg-sky px-2.5 py-2">
                  <Icon name="file-plus" size={14} color="blue" />
                  <Txt size={12} className="text-blue">
                    <Txt w="b" size={12} className="text-blue">
                      Addendum
                    </Txt>{' '}
                    · {dt.short(r.addendum.date)}
                  </Txt>
                </View>
              )}
            </Card>
          </View>
        ))}
        {!list.length && <Empty text={tc('noResults')} />}
      </View>

      <PastConsultDialog
        r={view}
        onClose={() => setView(null)}
        onAddendum={() => {
          setView(null);
          setAddendum(true);
        }}
      />
      <AddendumDialog open={addendum} onClose={() => setAddendum(false)} recordId={view?.id ?? 'h1'} />
      <DelegateDialog open={deleg} onClose={() => setDeleg(false)} pid={pid} />
    </Screen>
  );
}

function Block({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View className="mt-3">
      <Row gap="gap-1.5">
        <Icon name={icon} size={14} color="muted" />
        <Txt w="b" size={12.5} className="text-muted">
          {title}
        </Txt>
      </Row>
      <View className="mt-1">{children}</View>
    </View>
  );
}

function PastConsultDialog({ r, onClose, onAddendum }: { r: ConsultationRecord | null; onClose: () => void; onAddendum: () => void }) {
  const t = useT(dm);
  const tc = useT(common);
  const loc = useLoc();
  const dt = useDates();
  const me = useDoctorId();
  const { data: doctors } = useDoctors();
  const { data: specs } = useSpecializations();
  const mine = !!r && canAddAddendum(r.doctorId, me);
  const doc = doctors?.find((d) => d.id === r?.doctorId);
  const spec = loc(specs?.find((s) => s.id === doc?.specializationId)?.name);
  return (
    <Dialog
      open={!!r}
      onClose={onClose}
      title={t('consultDetails')}
      icon="file-text"
      actions={
        <>
          {mine && (
            <Button variant="o" className="flex-1" icon="file-plus" onPress={onAddendum}>
              {t('addAddendum')}
            </Button>
          )}
          <Button className="flex-1" icon="check" onPress={onClose}>
            {tc('close')}
          </Button>
        </>
      }
    >
      {r && (
        <>
          <View className="rounded-2xl bg-sky p-3">
            <Txt w="b" size={16}>
              {loc(r.title)}
            </Txt>
            <Row className="mt-2 flex-wrap" gap="gap-1.5">
              <Badge tone="blue" icon="calendar">
                {dt.short(r.date)}
              </Badge>
              <TypeBadge type={r.type} />
              <StatusBadge status="signed" />
            </Row>
            <Row className="mt-2" gap="gap-1">
              <Icon name="stethoscope" size={13} color="muted" />
              <Txt size={12.5} className="text-muted">
                {r.doctorName} · {spec}
              </Txt>
            </Row>
          </View>
          <Block icon="clipboard-list" title={tc('findings')}>
            <Txt>{loc(r.findings)}</Txt>
          </Block>
          <Block icon="stethoscope" title={tc('diagnosis')}>
            <Txt>{r.diagnoses.map(loc).join(', ')}</Txt>
          </Block>
          <Block icon="pill" title={tc('prescription')}>
            {r.prescriptions.map((x) => (
              <View key={x.medicine} className="mt-1.5 rounded-xl border border-line bg-soft p-2.5">
                <Txt w="b">{x.medicine}</Txt>
                <Row gap="gap-1">
                  <Icon name="clock" size={12} color="muted" />
                  <Txt size={12} className="text-muted">
                    {loc(x.intake)}
                  </Txt>
                </Row>
              </View>
            ))}
          </Block>
          <Block icon="flask-conical" title={tc('labs')}>
            <Txt>{r.labs.map((x) => `• ${x}`).join('\n')}</Txt>
          </Block>
          <Block icon="notebook-pen" title={tc('notes')}>
            <Txt>{loc(r.notes)}</Txt>
          </Block>
          {r.addendum && <Alert kind="info" icon="file-plus" className="mt-3" text={`**Addendum · ${dt.short(r.addendum.date)}**\n${loc(r.addendum.text)}`} />}
          {r.vitals && (
            <Block icon="heart-pulse" title="Vital Signs">
              <VitalsGrid v={r.vitals} />
            </Block>
          )}
          <Row className="mt-3 rounded-xl bg-soft px-3 py-2.5" gap="gap-1.5">
            <Icon name="badge-check" size={15} color="green" />
            <Txt size={12.5} className="flex-1 text-muted">
              {tc('signedBy')}{' '}
              <Txt w="b" size={12.5}>
                {r.doctorName}
              </Txt>{' '}
              · {t('locked')}
            </Txt>
          </Row>
          {mine ? <Alert kind="ok" icon="file-plus" className="mt-3" text={t('youAuthored')} /> : <Alert kind="warn" icon="lock" className="mt-3" text={t('onlyAuthor', { n: r.doctorName })} />}
        </>
      )}
    </Dialog>
  );
}
