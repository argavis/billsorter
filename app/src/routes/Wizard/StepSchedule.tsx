import { useTranslation } from 'react-i18next';
import { WizardCard } from './WizardCard';
import { Input } from '@renderer/components/ui/Input';
import { Label } from '@renderer/components/ui/Label';
import { Switch } from '@renderer/components/ui/Switch';
import { Slider } from '@renderer/components/ui/Slider';
import { useWizardStore } from './wizardStore';
import { Clock, Calendar } from 'lucide-react';

export const StepSchedule = (): JSX.Element => {
  const { t } = useTranslation();
  const hour = useWizardStore((s) => s.scheduleHour);
  const minute = useWizardStore((s) => s.scheduleMinute);
  const daysBack = useWizardStore((s) => s.daysBack);
  const enabled = useWizardStore((s) => s.scheduleEnabled);
  const set = useWizardStore((s) => s.setSchedule);

  const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <WizardCard
      title={t('wizard.step_schedule.title')}
      subtitle={t('wizard.step_schedule.subtitle')}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-ink-900">
              {t('wizard.step_schedule.auto_label')}
            </div>
            <div className="text-xs text-ink-500">
              {t('wizard.step_schedule.auto_hint')}
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-ink-400" />
              {t('wizard.step_schedule.time_label')}
            </Label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                set({ hour: h ?? 9, minute: m ?? 0 });
              }}
              disabled={!enabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-ink-400" />
              {t('wizard.step_schedule.days_label')}
            </Label>
            <div className="flex items-center gap-3 pt-2">
              <Slider
                value={[daysBack]}
                min={1}
                max={30}
                step={1}
                onValueChange={(v) => set({ daysBack: v[0] ?? 7 })}
                className="flex-1"
              />
              <span className="w-14 text-right text-sm font-medium text-brand-700 tabular-nums">
                {daysBack} {daysBack === 1 ? t('wizard.step_schedule.day') : t('wizard.step_schedule.days')}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-ink-500">{t('wizard.step_schedule.os_hint')}</p>
      </div>
    </WizardCard>
  );
};
