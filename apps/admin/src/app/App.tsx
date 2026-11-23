import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import type { AdminModule } from '@dyh/core';
import { AppShell, Locked } from '@/components/layout/AppShell';
import { Loading } from '@/components/ui/display';
import { Login, Splash } from '@/features/auth/Login';
import { usePerms } from '@/lib/admin';
import { usePrefs } from '@/store/prefs';

/* Each module is its own chunk so the portal loads fast. */
const PAGES: Record<AdminModule, ComponentType> = {
  dashboard: lazy(() => import('@/features/dashboard')),
  analytics: lazy(() => import('@/features/analytics')),
  accounts: lazy(() => import('@/features/accounts/AccountsPage')),
  clinics: lazy(() => import('@/features/clinics')),
  rooms: lazy(() => import('@/features/rooms')),
  announce: lazy(() => import('@/features/announce')),
  master: lazy(() => import('@/features/master')),
  reports: lazy(() => import('@/features/reports')),
  ratings: lazy(() => import('@/features/ratings')),
  audit: lazy(() => import('@/features/audit')),
  settings: lazy(() => import('@/features/settings')),
};

function ModulePage() {
  const { module } = useParams();
  const { can, me } = usePerms();
  const Page = PAGES[module as AdminModule];
  if (!Page) return <Navigate to="/dashboard" replace />;
  if (!me) return <Loading />;
  if (!can(module as AdminModule)) return <Locked />;
  return (
    <Suspense fallback={<Loading />}>
      <Page />
    </Suspense>
  );
}

function RequireSession({ children }: { children: React.ReactNode }) {
  const session = usePrefs((s) => s.session);
  return session ? children : <Navigate to="/login" replace />;
}

/** Keeps <html class="dark"> and lang in sync with the saved preferences. */
function ThemeSync() {
  const { theme, lang } = usePrefs();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = lang === 'tl' ? 'fil' : 'en';
  }, [theme, lang]);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireSession>
              <AppShell />
            </RequireSession>
          }
        >
          <Route path="/:module" element={<ModulePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
