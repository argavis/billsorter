import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Settings as SettingsIcon, CircleDot } from 'lucide-react';
import { cn } from '@renderer/lib/cn';
import { useLicenseStore } from '@renderer/store/licenseStore';
import { useSidecarStore } from '@renderer/store/sidecarStore';
import { TrialBanner } from '@renderer/routes/Paywall/TrialBanner';
import { Logo } from '@renderer/components/Logo';

export const AppShell = (): JSX.Element => {
  const { t } = useTranslation();
  const license = useLicenseStore((s) => s.license);
  const sidecar = useSidecarStore((s) => s.status);
  const location = useLocation();

  const isWizard = location.pathname.startsWith('/wizard');
  const isPaywall = location.pathname.startsWith('/paywall');

  if (isWizard || isPaywall) {
    // Wizard + Paywall haben eigene Layouts — keine Sidebar/Topbar.
    return <Outlet />;
  }

  return (
    <div className="flex h-screen flex-col bg-ink-50">
      {/* Title-Bar — Mac hat hiddenInset, daher Drag-Region oben */}
      <div className="title-bar h-9 bg-white border-b border-ink-200 flex items-center justify-end px-3">
        <div className="no-drag flex items-center gap-2 text-xs text-ink-500">
          <SidecarIndicator state={sidecar.state} />
        </div>
      </div>

      {license?.status === 'trial' && <TrialBanner />}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-ink-200 bg-white flex flex-col">
          <div className="px-5 py-4 border-b border-ink-100">
            <Link to="/dashboard" className="block no-drag" aria-label="BillSorter">
              <Logo className="h-7" />
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            <SidebarLink to="/dashboard" icon={<LayoutGrid className="h-4 w-4" />}>
              {t('nav.dashboard')}
            </SidebarLink>
            <SidebarLink to="/settings" icon={<SettingsIcon className="h-4 w-4" />}>
              {t('nav.settings')}
            </SidebarLink>
          </nav>

          <div className="p-4 text-xs text-ink-400 border-t border-ink-100">
            <div>v0.1.0</div>
            <div className="mt-1 capitalize">{license?.status ?? '…'}</div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-5xl p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarLink = ({
  to,
  icon,
  children,
}: {
  to: string;
  icon: JSX.Element;
  children: React.ReactNode;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
      )
    }
  >
    {icon}
    {children}
  </NavLink>
);

const SidecarIndicator = ({ state }: { state: string }) => {
  const tone =
    state === 'ready'
      ? 'text-success-600'
      : state === 'starting'
      ? 'text-warning-600'
      : 'text-ink-400';
  return (
    <span className={cn('flex items-center gap-1.5', tone)}>
      <CircleDot className="h-3 w-3" />
      <span className="capitalize">{state}</span>
    </span>
  );
};
