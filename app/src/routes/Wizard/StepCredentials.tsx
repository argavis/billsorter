import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { WizardCard } from './WizardCard';
import { Card } from '@renderer/components/ui/Card';
import { Input } from '@renderer/components/ui/Input';
import { Label } from '@renderer/components/ui/Label';
import { useWizardStore, type WizardProviderDraft } from './wizardStore';
import { STATIC_PROVIDERS, getPreset } from '@renderer/lib/providers';

export const StepCredentials = (): JSX.Element => {
  const { t } = useTranslation();
  const selected = useWizardStore((s) => s.selectedProviderTypes);
  const providers = useWizardStore((s) => s.providers);
  const upsert = useWizardStore((s) => s.upsertProvider);

  // Initialize provider drafts for selected types if missing.
  useEffect(() => {
    selected.forEach((type) => {
      if (!providers.find((p) => p.type === type)) {
        const preset = getPreset(type);
        upsert({
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          label: preset?.label ?? type,
          email: '',
          password: '',
          imapHost: preset?.imapHost ?? null,
          imapPort: preset?.imapPort ?? 993,
        });
      }
    });
    // Drop providers that are no longer selected.
    providers
      .filter((p) => !selected.includes(p.type))
      .forEach((p) => useWizardStore.getState().removeProvider(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const allValid = providers.length === selected.length && providers.every(
    (p) =>
      p.email.includes('@') &&
      p.password.length > 0 &&
      (getPreset(p.type)?.imapHost ?? p.imapHost) &&
      (p.imapPort ?? getPreset(p.type)?.imapPort),
  );

  return (
    <WizardCard
      title={t('wizard.step_credentials.title')}
      subtitle={t('wizard.step_credentials.subtitle')}
      canNext={allValid}
    >
      <div className="space-y-4">
        {providers.map((draft) => (
          <ProviderForm key={draft.id} draft={draft} onChange={upsert} />
        ))}
        {providers.length === 0 && (
          <p className="text-sm text-ink-500">{t('wizard.step_credentials.empty')}</p>
        )}
      </div>
    </WizardCard>
  );
};

const ProviderForm = ({
  draft,
  onChange,
}: {
  draft: WizardProviderDraft;
  onChange: (p: WizardProviderDraft) => void;
}) => {
  const { t } = useTranslation();
  const preset = STATIC_PROVIDERS.find((p) => p.id === draft.type);
  const customHost = preset?.imapHost === null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-medium text-sm">{preset?.label ?? draft.type}</div>
        {preset?.requiresAppPassword && preset.helpUrl && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              void window.api.system.openExternal(preset.helpUrl);
            }}
            className="text-xs text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
          >
            {t('wizard.step_credentials.create_app_pw')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>{t('wizard.step_credentials.email')}</Label>
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
            placeholder="name@example.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>{t('wizard.step_credentials.password')}</Label>
          <Input
            type="password"
            value={draft.password}
            onChange={(e) => onChange({ ...draft, password: e.target.value })}
            autoComplete="off"
          />
        </div>

        {customHost && (
          <>
            <div className="space-y-1.5">
              <Label>{t('wizard.step_credentials.host')}</Label>
              <Input
                value={draft.imapHost ?? ''}
                onChange={(e) => onChange({ ...draft, imapHost: e.target.value })}
                placeholder="imap.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('wizard.step_credentials.port')}</Label>
              <Input
                type="number"
                value={draft.imapPort ?? 993}
                onChange={(e) =>
                  onChange({ ...draft, imapPort: Number(e.target.value) || 993 })
                }
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
