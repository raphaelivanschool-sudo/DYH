import { useMemo } from 'react';
import { View } from 'react-native';
import { BLOOD_TYPES, PSGC, RELATIONS, SUFFIXES, type Address } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { Field, Input, Picker, Segmented } from './form';

export const profileMsgs = defineMessages('profile', {
  bloodType: ['Uri ng Dugo', 'Blood Type'],
  selectBlood: ['Pumili ng uri ng dugo', 'Select blood type'],
  rel: ['Relasyon', 'Relationship'],
  lastName: ['Apelyido', 'Last Name'],
  firstName: ['Pangalan', 'First Name'],
  middleName: ['Gitnang Pangalan', 'Middle Name'],
  suffix: ['Suffix', 'Suffix'],
  noSuffix: ['Wala', 'None'],
});
const pm = profileMsgs;

export interface NameValue {
  last: string;
  first: string;
  middle: string;
  suffix: string;
}

/** Last / First / Middle / Suffix — the same fields in the Patient App and the Kiosk, so there is one record. */
export function NameFields({ value, onChange }: { value: NameValue; onChange: (v: NameValue) => void }) {
  const t = useT(pm);
  const set = (k: keyof NameValue) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <>
      <Field label={t('lastName')} icon="user">
        <Input value={value.last} onChangeText={set('last')} autoCapitalize="words" />
      </Field>
      <Field label={t('firstName')}>
        <Input value={value.first} onChangeText={set('first')} autoCapitalize="words" />
      </Field>
      <View className="flex-row gap-2">
        <Field label={t('middleName')} optional className="flex-1">
          <Input value={value.middle} onChangeText={set('middle')} autoCapitalize="words" />
        </Field>
        <Field label={t('suffix')} className="w-[120px]">
          <Picker title={t('suffix')} value={value.suffix} onChange={set('suffix')} options={SUFFIXES.map((s) => ({ value: s, label: s || t('noSuffix') }))} />
        </Field>
      </View>
    </>
  );
}

export function SexField({ value, onChange }: { value: 'M' | 'F'; onChange: (v: 'M' | 'F') => void }) {
  const tc = useT(common);
  return (
    <Field label={tc('sex')} icon="users-round" className="flex-1">
      <Segmented value={value} onChange={onChange} options={[{ value: 'M', label: tc('male') }, { value: 'F', label: tc('female') }]} />
    </Field>
  );
}

export function BloodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT(pm);
  return (
    <Field label={t('bloodType')} icon="droplet">
      <Picker title={t('bloodType')} icon="droplet" placeholder={t('selectBlood')} value={value} onChange={onChange} options={BLOOD_TYPES.map((b) => ({ value: b.id, label: b.label, icon: 'droplet' }))} />
    </Field>
  );
}

export function RelationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT(pm);
  const loc = useLoc();
  return <Picker title={t('rel')} icon="users" value={value} onChange={onChange} options={RELATIONS.map((r) => ({ value: r.id, label: loc(r.label), icon: 'users' }))} />;
}

/** Region → Province → City → Barangay (PSGC), then house no. and street. */
export function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const tc = useT(common);
  const region = PSGC.find((r) => r.code === value.regionCode);
  const province = region?.provinces.find((p) => p.code === value.provinceCode);
  const city = province?.cities.find((c) => c.code === value.cityCode);
  const opts = useMemo(
    () => ({
      regions: PSGC.map((r) => ({ value: r.code, label: r.name, icon: 'map' })),
      provinces: (region?.provinces ?? []).map((p) => ({ value: p.code, label: p.name, icon: 'map-pinned' })),
      cities: (province?.cities ?? []).map((c) => ({ value: c.code, label: c.name, icon: 'building-2' })),
      brgys: (city?.barangays ?? []).map((b) => ({ value: b, label: b, icon: 'house' })),
    }),
    [region, province, city],
  );
  return (
    <>
      <Field label="Region">
        <Picker title="Region" icon="map" value={value.regionCode} options={opts.regions} onChange={(v) => onChange({ ...value, regionCode: v, provinceCode: '', cityCode: '', barangay: '' })} />
      </Field>
      <Field label="Province">
        <Picker title="Province" icon="map-pinned" value={value.provinceCode} options={opts.provinces} onChange={(v) => onChange({ ...value, provinceCode: v, cityCode: '', barangay: '' })} />
      </Field>
      <Field label={tc('city')}>
        <Picker title={tc('city')} icon="building-2" value={value.cityCode} options={opts.cities} onChange={(v) => onChange({ ...value, cityCode: v, barangay: '' })} />
      </Field>
      <Field label="Barangay">
        <Picker title="Barangay" icon="house" value={value.barangay} options={opts.brgys} onChange={(v) => onChange({ ...value, barangay: v })} />
      </Field>
      <View className="flex-row gap-2">
        <Field label="House No." optional className="w-[120px]">
          <Input value={value.houseNo ?? ''} onChangeText={(v) => onChange({ ...value, houseNo: v })} />
        </Field>
        <Field label="Street" optional className="flex-1">
          <Input value={value.street ?? ''} onChangeText={(v) => onChange({ ...value, street: v })} />
        </Field>
      </View>
    </>
  );
}
