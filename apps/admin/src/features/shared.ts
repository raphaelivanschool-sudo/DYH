import { useSpecializations } from '@dyh/api';
import type { Doctor, Secretary } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { shortSpec } from '@/lib/utils';

/** Labels reused by several admin modules. */
export const am = defineMessages('admin.shared', {
  searchDoctor: ['Hanapin ang doktor...', 'Search doctor...'],
  secretary: ['Sekretarya', 'Secretary'],
  secretaries: ['Mga Sekretarya', 'Secretaries'],
  admins: ['Mga Admin', 'Admins'],
  role: ['Tungkulin', 'Role'],
  createdBy: ['Ginawa ni', 'Created by'],
  created: ['Nagawa noong', 'Created'],
  credential: ['Titulo', 'Credential'],
  schedule: ['Iskedyul', 'Schedule'],
  served: ['Napagsilbihan', 'Served'],
  avgWait: ['Hintay', 'Avg Wait'],
  open: ['Bukas', 'Open'],
  closed: ['Sarado', 'Closed'],
  noClinic: ['Walang clinic', 'No clinic'],
  yes: ['Oo', 'Yes'],
  no: ['Hindi', 'No'],
  alsoDoctor: ['Doktor din', 'Also a doctor'],
  roomN: ['Kuwarto {{n}}', 'Room {{n}}'],
  floorN: ['Palapag {{n}}', 'Floor {{n}}'],
  floorShort: ['P{{n}}', 'F{{n}}'],
  contact: ['Numero', 'Contact'],
  blood: ['Dugo', 'Blood'],
  exportBtn: ['I-export', 'Export'],
  updated: ['Na-update', 'Updated'],
  generate: ['Gumawa', 'Generate'],
  from: ['Mula', 'From'],
  to: ['Hanggang', 'To'],
  dateRange: ['Saklaw ng Petsa', 'Date Range'],
  thisWeek: ['Ngayong Linggo', 'This Week'],
  thisMonth: ['Ngayong Buwan', 'This Month'],
  last3: ['Huling 3 Buwan', 'Last 3 Months'],
  thisYear: ['Ngayong Taon', 'This Year'],
  custom: ['Custom', 'Custom'],
  high: ['Mataas', 'High'],
  medium: ['Katamtaman', 'Medium'],
  low: ['Mababa', 'Low'],
  actual: ['Aktwal', 'Actual'],
  aiForecast: ['Hula ng AI', 'AI forecast'],
  yesterday: ['Kahapon', 'Yesterday'],
  total: ['kabuuan', 'total'],
  vsYesterday: ['vs kahapon', 'vs yesterday'],
  vsPrevious: ['vs nakaraan', 'vs previous'],
  doctorsN: ['{{n}} doktor', '{{n}} doctor(s)'],
  saved: ['Na-save', 'Saved'],
  deidentified: ['De-identified na data lamang ang ginagamit. Hindi awtomatikong tumatakbo ang pagsusuri.', 'Only de-identified data is used. Analysis never runs automatically.'],
});

export const useAm = () => useT(am);

/** Specialization name by id, already localized. `short` strips "(...)". */
export function useSpecName() {
  const { data } = useSpecializations();
  const loc = useLoc();
  return (id: string, short = true) => {
    const s = data?.find((x) => x.id === id);
    if (!s) return id;
    return short ? shortSpec(loc(s.name)) : loc(s.name);
  };
}

export function useStatusOptions() {
  const t = useT(common);
  return [
    { value: 'active', label: t('st_active') },
    { value: 'deactivated', label: t('st_deactivated') },
  ];
}

export const secretariesOf = (doctorId: string, secs: Secretary[] = []) => secs.filter((s) => s.doctorIds.includes(doctorId));

export const doctorSearchText = (d: Doctor) => `${d.name} ${d.email} ${d.room} ${d.queuePrefix}`;

/** Download a CSV file built from rows (used by the Export buttons). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
