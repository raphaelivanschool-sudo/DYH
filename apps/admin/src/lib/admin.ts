import { qk, useApiQuery } from '@dyh/api';
import { ADMIN_MODULES, canAccess, canDo, type AdminAccount, type AdminModule, type Crud } from '@dyh/core';
import { defineMessages } from '@dyh/i18n';
import { usePrefs } from '@/store/prefs';

export const useAdmins = () => useApiQuery(qk.admins, (a) => a.getAdmins());
export const useSecretaries = () => useApiQuery(qk.secretaries, (a) => a.getSecretaries());
export const useRooms = () => useApiQuery(qk.rooms, (a) => a.getRooms());
export const useClinics = () => useApiQuery(qk.clinics, (a) => a.getClinics());

/** The admin the portal is rendering as (signed-in user, or the demo "View as" choice). */
export function useCurrentAdmin(): AdminAccount | undefined {
  const viewAs = usePrefs((s) => s.viewAs);
  const { data } = useAdmins();
  return data?.find((a) => a.id === viewAs) ?? data?.[0];
}

/** RBAC helpers bound to the current admin. Backend must enforce the same rules. */
export function usePerms() {
  const me = useCurrentAdmin();
  return {
    me,
    isSuper: me?.role === 'super',
    can: (m: AdminModule) => !!me && canAccess(me, m),
    canDo: (m: AdminModule, op: Crud) => !!me && canDo(me, m, op),
  };
}

export const MODULES = ADMIN_MODULES;
export const moduleById = (id: string) => ADMIN_MODULES.find((m) => m.id === id);

export const roleMsgs = defineMessages('admin.roles', {
  super: ['Super Admin', 'Super Admin'],
  admin: ['Admin', 'Admin'],
  superDesc: ['Buong access sa lahat ng modyul. Siya lang ang makagagawa at makapagtatakda ng access ng mga Admin.', 'Full access to every module. Only they can create Admins and set their access.'],
  adminDesc: ['Naka-RBAC: piling modyul lamang, at sa bawat modyul ay may Create / Update / Delete na itinakda ng Super Admin.', 'RBAC: selected modules only, each with Create / Update / Delete set by the Super Admin.'],
  superShort: ['Buong access sa lahat', 'Full access to everything'],
  adminShort: ['Piling modyul at aksyon (RBAC)', 'Selected modules & actions (RBAC)'],
});
