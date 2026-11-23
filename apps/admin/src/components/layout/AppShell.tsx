import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { AdminModule } from '@dyh/core';
import { common, defineMessages, useLoc, useT } from '@dyh/i18n';
import { Avatar, Badge, Logo } from '@/components/ui/display';
import { IconButton } from '@/components/ui/button';
import { MODULES, moduleById, roleMsgs, useAdmins, usePerms } from '@/lib/admin';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/store/prefs';

const m = defineMessages('admin.shell', {
  overview: ['Pangkalahatan', 'Overview'],
  management: ['Pamamahala', 'Management'],
  reports: ['Mga Ulat', 'Reports'],
  system: ['Sistema', 'System'],
  account: ['Account', 'Account'],
  viewAs: ['Tingnan bilang', 'View as'],
  viewAsHint: ['Demo: tingnan bilang ibang admin', 'Demo: view as another admin'],
  restricted: ['Limitado ang access', 'Restricted access'],
  restrictedBody: ['Hindi kasama ang modyul na ito sa access ni **{{name}}**. Makipag-ugnayan sa Super Admin.', "This module is not part of **{{name}}**'s access. Contact the Super Admin."],
  portal: ['ADMIN PORTAL', 'ADMIN PORTAL'],
  menu: ['Buksan ang menu', 'Open menu'],
});

export const shellMsgs = m;

const GROUPS: [keyof typeof m.messages, AdminModule[]][] = [
  ['overview', ['dashboard', 'analytics']],
  ['management', ['accounts', 'clinics', 'rooms', 'announce', 'master']],
  ['reports', ['reports', 'ratings', 'audit']],
  ['system', ['settings']],
];

const shortName = (n: string) => (n.startsWith('Dr. ') ? `Dr. ${n.split(' ')[1]}` : n.split(' ')[0]);

export function AppShell() {
  const t = useT(m);
  const tc = useT(common);
  const loc = useLoc();
  const tr = useT(roleMsgs);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { me, can } = usePerms();
  const { data: admins } = useAdmins();
  const { viewAs, setViewAs, theme, setSession } = usePrefs();
  const cur = moduleById(pathname.split('/')[1] ?? '') ?? MODULES[0];
  const dark = theme === 'dark';

  return (
    <div className="grid h-full grid-cols-[240px_minmax(0,1fr)] max-lg:grid-cols-1">
      <aside className="overflow-y-auto bg-navy-2 px-3 py-[18px] text-[#c8d4ea] max-lg:hidden" aria-label="Main">
        <div className={cn('rounded-xl p-2.5 text-center', !dark && 'bg-white')}>
          <Logo height={50} light={dark} />
        </div>
        <div className="mt-2 text-center text-[11px] font-bold tracking-[.08em] text-[#7f93b8]">{t('portal')}</div>
        <nav>
          {GROUPS.map(([g, ids]) => (
            <div key={g}>
              <div className="mx-2.5 mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-[.08em] text-[#7f93b8]">{t(g)}</div>
              {ids.map((id) => {
                const mod = moduleById(id)!;
                const ok = can(id);
                return (
                  <NavLink
                    key={id}
                    to={`/${id}`}
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-[13px] font-medium transition hover:bg-white/[.07]',
                        isActive && 'bg-card font-bold text-ink hover:bg-card [&_svg:first-child]:text-blue',
                        !ok && 'opacity-55',
                      )
                    }
                  >
                    <Icon name={mod.icon} size={18} />
                    <span className="flex-1">{loc(mod.label)}</span>
                    {!ok && <Icon name="lock" size={14} />}
                  </NavLink>
                );
              })}
            </div>
          ))}
          <div className="mx-2.5 mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-[.08em] text-[#7f93b8]">{t('account')}</div>
          <button
            type="button"
            onClick={() => {
              setSession(null);
              nav('/login');
            }}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-[13px] font-medium hover:bg-white/[.07]"
          >
            <Icon name="log-out" size={18} />
            {tc('logout')}
          </button>
        </nav>
      </aside>

      <div className="min-w-0 overflow-y-auto bg-pattern" id="scr">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-card px-6 py-3 max-sm:px-4">
          <h2 className="flex flex-1 items-center gap-2.5 text-[20px]">
            <Icon name={cur.icon} size={22} className="text-blue" />
            {loc(cur.label)}
          </h2>
          <IconButton icon="bell" label={tc('notifications')} dot />
          <div className="flex items-center gap-1 rounded-xl bg-soft p-1" title={t('viewAsHint')}>
            <span className="px-1.5 text-[11px] text-muted">{t('viewAs')}</span>
            {admins?.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setViewAs(a.id)}
                className={cn('rounded-lg px-2.5 py-1.5 text-[12px] font-semibold', viewAs === a.id ? 'bg-card text-ink shadow-seg' : 'text-muted hover:text-ink')}
              >
                {shortName(a.name)}
              </button>
            ))}
          </div>
          {me && (
            <div className="flex items-center gap-2">
              <Avatar name={me.name} />
              <div>
                <b className="text-[12px]">{me.name}</b>
                <div>
                  <Badge tone={me.role === 'super' ? 'purple' : 'blue'} icon={me.role === 'super' ? 'crown' : 'shield'}>
                    {tr(me.role)}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </header>
        <main className="p-6 max-sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Shown in place of a module the current admin has no access to. */
export function Locked() {
  const t = useT(m);
  const { me } = usePerms();
  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-16 text-center">
      <div className="mx-auto grid size-[72px] place-items-center rounded-[22px] bg-sky text-blue">
        <Icon name="lock" size={30} />
      </div>
      <h3 className="mt-4 text-[18px]">{t('restricted')}</h3>
      <p className="mt-2 text-muted">
        {t('restrictedBody', { name: me?.name ?? '' })
          .split(/\*\*(.+?)\*\*/)
          .map((s, i) => (i % 2 ? <b key={i}>{s}</b> : s))}
      </p>
    </div>
  );
}
