import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Card } from '@renderer/components/ui/Card';
import { useWizardStore } from './wizardStore';
import { useConfigStore } from '@renderer/store/configStore';
import type { AppConfig } from '@shared/types';

export const StepDone = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const w = useWizardStore.getState();
  const patchConfig = useConfigStore((s) => s.patch);
  const [saving, setSaving] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const persist = async () => {
      try {
        // 1. IMAP-Passwörter pro Provider im Keychain ablegen.
        //    Anthropic-Key lebt zentral im Backend — User braucht keinen eigenen Key.
        for (const p of w.providers) {
          await window.api.credentials.set(`imap:${p.email}`, p.password);
        }
        // Cleanup: alte Installs hatten 'anthropic' im Keychain. Entfernen.
        await window.api.credentials.delete('anthropic').catch(() => undefined);

        // 2. Config persistieren
        const partial: Partial<AppConfig> = {
          setupCompleted: true,
          locale: w.locale,
          rechnungsOrdner: w.rechnungsOrdner,
          schedule: {
            hour: w.scheduleHour,
            minute: w.scheduleMinute,
            daysBack: w.daysBack,
            enabled: w.scheduleEnabled,
          },
          providers: w.providers.map((p) => ({
            id: p.id,
            type: p.type,
            label: p.label,
            email: p.email,
            imapHost: p.imapHost,
            imapPort: p.imapPort,
            enabled: true,
          })),
        };
        await patchConfig(partial);

        // 3. Scheduler installieren falls aktiviert
        if (w.scheduleEnabled) {
          await window.api.scheduler.install({
            hour: w.scheduleHour,
            minute: w.scheduleMinute,
          });
        }

        setSaving(false);
      } catch (e) {
        setError((e as Error).message);
        setSaving(false);
      }
    };
    void persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (saving) {
    return (
      <Card className="p-10 text-center">
        <Loader2 className="mx-auto h-10 w-10 text-brand-600 animate-spin" />
        <p className="mt-4 text-sm text-ink-600">{t('wizard.step_done.saving')}</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-10">
        <p className="text-red-700 text-sm">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">{t('wizard.step_done.title')}</h2>
      <p className="mt-2 text-ink-500">{t('wizard.step_done.subtitle')}</p>

      <Button className="mt-8" size="lg" onClick={() => navigate('/dashboard')}>
        {t('wizard.step_done.cta')}
      </Button>
    </Card>
  );
};
