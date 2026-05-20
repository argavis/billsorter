import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppRouter } from './router';
import { useConfigStore } from './store/configStore';
import { useLicenseStore } from './store/licenseStore';
import { useSidecarStore } from './store/sidecarStore';
import type { RendererApi } from '../electron/preload';

declare global {
  interface Window {
    api: RendererApi;
  }
}

const App = (): JSX.Element => {
  const { i18n } = useTranslation();
  const loadConfig = useConfigStore((s) => s.load);
  const config = useConfigStore((s) => s.config);
  const hydrateLicense = useLicenseStore((s) => s.hydrate);
  const hydrateSidecar = useSidecarStore((s) => s.hydrate);

  useEffect(() => {
    void loadConfig();
    const unsubLic = hydrateLicense();
    const unsubSc = hydrateSidecar();

    const unsubDeep = window.api.events.onDeepLink((payload) => {
      // Bei license-Deep-Link triggert main bereits einen licenseChanged-Event.
      // Hier könnten Toast/Routing reagieren.
      console.info('deep-link', payload);
    });

    return () => {
      unsubLic();
      unsubSc();
      unsubDeep();
    };
  }, [loadConfig, hydrateLicense, hydrateSidecar]);

  useEffect(() => {
    if (config?.locale && config.locale !== i18n.language) {
      void i18n.changeLanguage(config.locale);
    }
  }, [config?.locale, i18n]);

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <div className="text-sm text-ink-500">Lade…</div>
      </div>
    );
  }

  return <AppRouter />;
};

export default App;
