import { createMemoryRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Wizard } from './routes/Wizard';
import { Dashboard } from './routes/Dashboard';
import { Settings } from './routes/Settings';
import { Paywall } from './routes/Paywall';
import { useConfigStore } from './store/configStore';
import { useLicenseStore } from './store/licenseStore';

const Bootstrap = (): JSX.Element => {
  const config = useConfigStore((s) => s.config);
  const license = useLicenseStore((s) => s.license);

  if (!config) {
    // Loading state — config wird in App.tsx geladen
    return <Navigate to="/dashboard" replace />;
  }

  if (!config.setupCompleted) {
    return <Navigate to="/wizard" replace />;
  }

  if (license?.status === 'expired' || license?.status === 'revoked') {
    return <Navigate to="/paywall" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export const buildRouter = () =>
  createMemoryRouter([
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <Bootstrap /> },
        { path: '/wizard', element: <Wizard /> },
        { path: '/dashboard', element: <Dashboard /> },
        { path: '/settings', element: <Settings /> },
        { path: '/paywall', element: <Paywall /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ]);

export const AppRouter = (): JSX.Element => {
  const router = buildRouter();
  return <RouterProvider router={router} />;
};
