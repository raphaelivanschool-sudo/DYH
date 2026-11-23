import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApiMutation, type KioskRegistration } from '@dyh/api';
import { type Address, type BloodType, type Patient, type Priority, type RelationKey } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import {
  AddressFields, Alert, BloodPicker, Button, Card, DateField, Dialog, Field, Icon, Input, NameFields, RelationPicker, Rich, SectionTitle, SexField, Txt, cx, type NameValue,
} from '@dyh/ui-native';
import { KOpt, KTitle, endSession, go } from '../../src/components/kit';
import { KPage } from '../../src/components/page';
import { km } from '../../src/msgs';
import { useKiosk } from '../../src/store';

const digits = (s: string) => s.replace(/\D/g, '');

/** New patient registration — the same fields as the Patient App, so there is one record. */
export default function Register() {
  const t = useT(km);
  const tc = useT(common);
  const [name, setName] = useState<NameValue>({ last: '', first: '', middle: '', suffix: '' });
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | null>(null);
  const [mobile, setMobile] = useState('');
  const [addr, setAddr] = useState<Address>({ regionCode: '', provinceCode: '', cityCode: '', barangay: '' });
  const [emName, setEmName] = useState('');
  const [emMobile, setEmMobile] = useState('');
  const [emRel, setEmRel] = useState('');
  const [blood, setBlood] = useState('');
  const [alg, setAlg] = useState<string | null>(null);
  const [prio, setPrio] = useState<Priority | null>(null);
  const [agree, setAgree] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const reg = useApiMutation((a, r: KioskRegistration) => a.kioskRegister(r));

  const ok = !!name.last.trim() && !!name.first.trim() && /^\d{4}-\d{2}-\d{2}$/.test(birthday) && !!sex && digits(mobile).length === 11 && !!addr.barangay && agree;

  const submit = async () => {
    if (!ok || !sex) return;
    const p: Patient = await reg.mutateAsync({
      last: name.last.trim(),
      first: name.first.trim(),
      middle: name.middle.trim() || undefined,
      suffix: name.suffix || undefined,
      birthday: birthday as KioskRegistration['birthday'],
      sex,
      mobile,
      priority: prio,
      address: addr,
      bloodType: (blood || 'unknown') as BloodType,
      allergies: alg?.trim() ? alg.split(',').map((x) => x.trim()) : [],
      emergencyContact: emName.trim() && emRel ? { name: emName.trim(), mobile: emMobile, relation: emRel as RelationKey } : undefined,
    });
    useKiosk.getState().set({ patient: { id: p.id, name: p.displayName, priority: p.priority } });
    go('/doctors');
  };

  return (
    <KPage>
      <KTitle icon="user-plus" title={t('regTitle')} sub={t('regSub')} />
      <View className="mt-4 flex-row gap-6">
        <View className="flex-1">
          <SectionTitle icon="id-card">{t('personal')}</SectionTitle>
          <Card>
            <NameFields value={name} onChange={setName} />
            <Field label={tc('birthday')} icon="cake">
              <DateField label={tc('birthday')} value={birthday} onChange={setBirthday} />
            </Field>
            <SexField value={sex ?? ('' as 'M')} onChange={setSex} />
            <Field label={tc('mobile')} icon="smartphone">
              <Input value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="09__ ___ ____" maxLength={13} accessibilityLabel={tc('mobile')} />
            </Field>
            <Alert kind="warn" icon="triangle-alert" className="mt-2" text={t('mobileWarn')} />
          </Card>
          <SectionTitle icon="phone-call">{tc('emergencyContact')}</SectionTitle>
          <Card>
            <Field label={t('emergName')} className="mt-0">
              <Input value={emName} onChangeText={setEmName} autoCapitalize="words" accessibilityLabel={t('emergName')} />
            </Field>
            <View className="flex-row gap-3">
              <Field label={t('emergMobile')} className="flex-1">
                <Input value={emMobile} onChangeText={setEmMobile} keyboardType="phone-pad" accessibilityLabel={t('emergMobile')} />
              </Field>
              <Field label={tc('relationship')} className="flex-1">
                <RelationPicker value={emRel} onChange={setEmRel} />
              </Field>
            </View>
          </Card>
        </View>
        <View className="flex-1">
          <SectionTitle icon="map-pin">{t('address')}</SectionTitle>
          <Card>
            <AddressFields value={addr} onChange={setAddr} />
          </Card>
          <SectionTitle icon="heart-pulse">{t('health')}</SectionTitle>
          <Card>
            <BloodPicker value={blood} onChange={setBlood} />
            <Field label={t('allergyQ')} icon="triangle-alert">
              <View className="flex-row gap-2">
                <KOpt on={alg === null} onPress={() => setAlg(null)}>
                  {tc('none')}
                </KOpt>
                <KOpt on={alg !== null} onPress={() => setAlg(alg ?? '')}>
                  {t('yes')}
                </KOpt>
              </View>
              {alg !== null && <Input className="mt-2" value={alg} onChangeText={setAlg} placeholder={t('allergyPh')} accessibilityLabel={t('allergyQ')} />}
            </Field>
            <Field label={tc('priority')} icon="accessibility">
              <View className="flex-row gap-2">
                <KOpt icon="minus" on={!prio} onPress={() => setPrio(null)}>
                  {tc('none')}
                </KOpt>
                <KOpt icon="user-round" on={prio === 'senior'} onPress={() => setPrio('senior')}>
                  {t('seniorLong')}
                </KOpt>
                <KOpt icon="accessibility" on={prio === 'pwd'} onPress={() => setPrio('pwd')}>
                  PWD
                </KOpt>
              </View>
            </Field>
          </Card>
        </View>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agree }}
        onPress={() => setAgree(!agree)}
        className={cx('mt-6 flex-row items-center gap-3 rounded-2xl border-2 bg-card p-4', agree ? 'border-blue' : 'border-line')}
      >
        <Icon name={agree ? 'square-check' : 'square'} size={28} color={agree ? 'blue' : 'muted'} />
        <Icon name="shield-check" size={20} />
        <Txt w="s" size={16} className="flex-1">
          {t('agree')}
        </Txt>
        <Button variant="link" icon="file-text" onPress={() => setPrivacy(true)}>
          {t('read')}
        </Button>
      </Pressable>

      <View className="mt-5 flex-row items-center justify-end gap-3">
        {!ok && (
          <Txt size={14} className="flex-1 text-muted">
            {t('fillRequired')}
          </Txt>
        )}
        <Button variant="o" size="lg" icon="x" onPress={() => endSession('/home')}>
          {tc('cancel')}
        </Button>
        <Button size="lg" iconRight="chevron-right" className="min-w-[260px]" disabled={!ok} loading={reg.isPending} onPress={submit}>
          {tc('submit')}
        </Button>
      </View>

      <Dialog open={privacy} onClose={() => setPrivacy(false)} title={t('privacyTitle')} icon="shield-check" actions={<Button className="flex-1" onPress={() => setPrivacy(false)}>{tc('ok')}</Button>}>
        <Rich size={14} className="text-muted" text={t('privacyBody')} />
      </Dialog>
    </KPage>
  );
}
