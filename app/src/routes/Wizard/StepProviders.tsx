import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Mail, Check } from 'lucide-react';
import { WizardCard } from './WizardCard';
import { useWizardStore } from './wizardStore';
import { STATIC_PROVIDERS, type ProviderPreset } from '@renderer/lib/providers';
import type { ProviderType } from '@shared/types';
import { cn } from '@renderer/lib/cn';

export const StepProviders = (): JSX.Element => {
  const { t } = useTranslation();
  const selected = useWizardStore((s) => s.selectedProviderTypes);
  const setSelected = useWizardStore((s) => s.setSelectedProviderTypes);
  const [presets, setPresets] = useState<ProviderPreset[]>(STATIC_PROVIDERS);

  useEffect(() => {
    void window.api.sidecar.request({ path: '/v1/providers' }).then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        // Map server preset → client shape
        const list = (res.data as Array<{
          id: ProviderType;
          label: string;
          imap_host: string | null;
          imap_port: number;
          help_url: string;
          requires_app_password: boolean;
        }>).map((p) => ({
          id: p.id,
          label: p.label,
          imapHost: p.imap_host,
          imapPort: p.imap_port,
          helpUrl: p.help_url,
          requiresAppPassword: p.requires_app_password,
        }));
        if (list.length > 0) setPresets(list);
      }
    });
  }, []);

  const toggle = (id: ProviderType) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <WizardCard
      title={t('wizard.step_providers.title')}
      subtitle={t('wizard.step_providers.subtitle')}
      canNext={selected.length > 0}
    >
      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => {
          const isSel = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={cn(
                'group flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all',
                isSel
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-ink-200 bg-white hover:border-brand-300',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  isSel ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500',
                )}
              >
                {isSel ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900 truncate">{p.label}</div>
                {p.requiresAppPassword && (
                  <div className="text-xs text-ink-500">{t('wizard.step_providers.app_pw_required')}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-ink-500">{t('wizard.step_providers.hint')}</p>
    </WizardCard>
  );
};
