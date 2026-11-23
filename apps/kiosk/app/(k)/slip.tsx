import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useDoctors, useSettings, useSpecializations } from '@dyh/api';
import { formatHoursRange, scanOpensAtLabel } from '@dyh/core';
import { common, useLoc, useT } from '@dyh/i18n';
import { Alert, Badge, Button, Card, Divider, Icon, Logo, PriorityBadge, QR, Rich, Txt, TypeBadge, toast } from '@dyh/ui-native';
import { clockLabel, endSession, useCountdown, useToday } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';
import { useKiosk } from '../../src/store';

const INK = '#111111';

/** Queue number (or Walk-in QR) with the printed slip; closes itself after a few seconds. */
export default function Slip() {
  const t = useT(km);
  const tc = useT(common);
  const loc = useLoc();
  const r = useKiosk((s) => s.result);
  const { data: doctors } = useDoctors();
  const { data: specs } = useSpecializations();
  const { data: settings } = useSettings();
  const { today, hour } = useToday();
  const total = settings?.kioskSlipSeconds ?? 20;
  const left = useCountdown(total, () => endSession('/'));
  if (!r) return <Redirect href="/home" />;
  const d = doctors?.find((x) => x.id === r.doctorId);
  const spec = d && loc(specs?.find((s) => s.id === d.specializationId)?.name);
  const win = settings?.scanWindowMinutes ?? 60;
  const opensAt = r.opensAt ?? (d ? scanOpensAtLabel(d, win) : '');

  const timer = (
    <View className="mb-5 rounded-2xl border border-line bg-card px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Icon name="timer" size={18} />
        <Rich size={15} text={t('closesIn', { n: left })} />
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-soft">
        <View className="h-full rounded-full bg-blue" style={{ width: `${(left / total) * 100}%` }} />
      </View>
    </View>
  );
  const actions = (next: '/home' | '/survey') => (
    <View className="mt-4 flex-row gap-3">
      <View className="flex-1">
        <Button variant="n" size="lg" full icon="printer" onPress={() => toast.info(t('printed'))}>
          {t('printAgain')}
        </Button>
      </View>
      <View className="flex-1">
        <Button size="lg" full icon="check" onPress={() => endSession(next)}>
          {tc('done')}
        </Button>
      </View>
    </View>
  );

  if (r.walkInQr)
    return (
      <KPage>
        {timer}
        <View className="flex-row items-center gap-8">
          <View className="flex-1">
            <Hero icon="qr-code" color="#b26a00" />
            <Txt w="x" size={30} className="mt-4">
              {t('walkQrTitle')}
            </Txt>
            <Rich size={18} className="mt-1 text-muted" text={t('walkQrSub', { t: opensAt })} />
            <Alert kind="warn" icon="map-pin" className="mt-4" text={t('onSite')} />
            {actions('/home')}
          </View>
          <Paper>
            <P center size={12}>
              WALK-IN QR
            </P>
            <View className="my-2 items-center">
              <QR value={r.walkInQr} size={150} />
            </View>
            <P center bold>
              {r.walkInQr}
            </P>
            <Rule />
            {d && <SlipRows rows={[[t('slipDoctor'), d.name], [t('slipRoom'), d.room], ['CLINIC', formatHoursRange(d.hours)]]} />}
            <P bold>{`${t('slipScanFrom')}: ${opensAt}`}</P>
            <Rule />
            <P center size={11}>
              {t('slipNoNumber')}
            </P>
          </Paper>
        </View>
      </KPage>
    );

  const e = r.entry;
  if (!e) return <Redirect href="/home" />;
  const online = e.type === 'online';
  const ahead = Math.max(0, (r.position ?? 1) - 1);
  const [y, m, day] = today.split('-');
  return (
    <KPage>
      {timer}
      <View className="flex-row items-center gap-8">
        <View className="flex-1">
          <Hero icon="check" color="#12805a" />
          <Txt w="x" size={30} className="mt-4">
            {t('inQueue')}
          </Txt>
          <Txt size={18} className="mt-1 text-muted">
            {t('takeSlip')}
          </Txt>
          <Card className="mt-4 p-5">
            <View className="flex-row items-center gap-1">
              <Icon name="ticket" size={14} color="muted" />
              <Txt w="b" size={12} className="text-muted">
                {t('yourNo')}
              </Txt>
            </View>
            <Txt w="x" size={64} className="text-blue" style={{ letterSpacing: -2, lineHeight: 72 }}>
              {e.number}
            </Txt>
            <View className="flex-row flex-wrap gap-1.5">
              {e.priority ? <PriorityBadge p={e.priority} /> : <TypeBadge type={e.type} />}
              {online && (
                <Badge tone="green" icon="map-pin-check">
                  {t('arrivedSeen')}
                </Badge>
              )}
            </View>
            <Divider className="my-3" />
            {d && <Line icon="stethoscope" text={d.name} bold />}
            {d && <Line icon="door-open" text={`${tc('room')} ${d.room} · ${spec ?? ''}`} />}
            <Line icon="users" text={t('aheadOfYou', { n: ahead })} />
          </Card>
          {actions('/survey')}
        </View>
        <Paper>
          <P center size={12}>
            {t('slipHead')}
          </P>
          <Txt w="x" size={52} className="my-1 text-center" style={{ color: INK }}>
            {e.number}
          </Txt>
          <View className="mx-10 border-2 px-1 py-0.5" style={{ borderColor: e.priority ? INK : 'transparent' }}>
            <P center bold>
              {e.priority ? `PRIORITY · ${e.priority === 'pwd' ? 'PWD' : 'SENIOR'}` : online ? `ONLINE · ${t('arrivedSlip')}` : 'WALK-IN'}
            </P>
          </View>
          <Rule />
          {d && (
            <SlipRows
              rows={[
                [t('slipDoctor'), d.name],
                [t('slipClinic'), (spec ?? '').toUpperCase()],
                [t('slipRoom'), d.room],
                [t('slipDate'), `${m}/${day}/${y}  ${clockLabel(hour)}`],
              ]}
            />
          )}
          <Rule />
          <P center size={12}>
            {t('slipReceipt')}
          </P>
          <P center bold size={15}>
            {`QS-${today.slice(2).replace(/-/g, '')}-${e.number.split('-')[1]}`}
          </P>
          <Rule />
          <P center size={11}>
            {t('slipWait')}
          </P>
        </Paper>
      </View>
    </KPage>
  );
}

function Hero({ icon, color }: { icon: string; color: string }) {
  return (
    <View className="h-20 w-20 items-center justify-center rounded-[26px]" style={{ backgroundColor: color }}>
      <Icon name={icon} size={40} color="#ffffff" />
    </View>
  );
}

function Line({ icon, text, bold }: { icon: string; text: string; bold?: boolean }) {
  return (
    <View className="mt-1.5 flex-row items-center gap-2">
      <Icon name={icon} size={17} />
      <Txt w={bold ? 'b' : 'm'} size={16}>
        {text}
      </Txt>
    </View>
  );
}

/** The printed thermal slip: always black on white, whatever the theme. */
function Paper({ children }: { children: React.ReactNode }) {
  return (
    <View className="w-[330px] rounded-md bg-white px-6 py-5" style={{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
      <View className="items-center">
        <Logo height={52} />
      </View>
      <Rule />
      {children}
    </View>
  );
}

function P({ children, center, bold, size = 13 }: { children: React.ReactNode; center?: boolean; bold?: boolean; size?: number }) {
  return (
    <Txt w={bold ? 'b' : 'm'} size={size} className={center ? 'text-center' : undefined} style={{ color: INK, fontFamily: 'monospace' }}>
      {children}
    </Txt>
  );
}

function Rule() {
  return <View className="my-2.5 border-b border-dashed" style={{ borderColor: '#999' }} />;
}

function SlipRows({ rows }: { rows: [string, string][] }) {
  return (
    <View className="gap-0.5">
      {rows.map(([k, v]) => (
        <P key={k}>{`${k}: ${v}`}</P>
      ))}
    </View>
  );
}

