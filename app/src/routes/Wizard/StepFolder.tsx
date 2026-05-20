import { useTranslation } from 'react-i18next';
import { FolderOpen, Check, XCircle } from 'lucide-react';
import { useState } from 'react';
import { WizardCard } from './WizardCard';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { Label } from '@renderer/components/ui/Label';
import { useWizardStore } from './wizardStore';

export const StepFolder = (): JSX.Element => {
  const { t } = useTranslation();
  const ordner = useWizardStore((s) => s.rechnungsOrdner);
  const setOrdner = useWizardStore((s) => s.setOrdner);
  const [validation, setValidation] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const res = await window.api.filesystem.pickFolder();
    if (!res.canceled && res.path) {
      setOrdner(res.path);
      const v = await window.api.filesystem.validateWrite(res.path);
      setValidation(v.ok ? 'ok' : 'error');
      setError(v.ok ? null : v.error ?? null);
    }
  };

  return (
    <WizardCard
      title={t('wizard.step_folder.title')}
      subtitle={t('wizard.step_folder.subtitle')}
      canNext={!!ordner && validation !== 'error'}
    >
      <div className="space-y-3">
        <Label>{t('wizard.step_folder.label')}</Label>
        <div className="flex gap-2">
          <Input
            value={ordner ?? ''}
            placeholder={t('wizard.step_folder.placeholder')}
            readOnly
            onClick={pick}
            className="cursor-pointer"
          />
          <Button variant="secondary" onClick={pick}>
            <FolderOpen className="h-4 w-4" />
            {t('wizard.step_folder.pick')}
          </Button>
        </div>

        {validation === 'ok' && (
          <p className="flex items-center gap-2 text-xs text-emerald-700">
            <Check className="h-3 w-3" />
            {t('wizard.step_folder.write_ok')}
          </p>
        )}
        {validation === 'error' && (
          <p className="flex items-center gap-2 text-xs text-red-700">
            <XCircle className="h-3 w-3" />
            {t('wizard.step_folder.write_error')}: {error}
          </p>
        )}

        <p className="mt-6 text-xs text-ink-500">{t('wizard.step_folder.hint')}</p>
      </div>
    </WizardCard>
  );
};
