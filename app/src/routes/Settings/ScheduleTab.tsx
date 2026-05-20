import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@renderer/components/ui/Card';
import { Input } from '@renderer/components/ui/Input';
import { Label } from '@renderer/components/ui/Label';
import { Switch } from '@renderer/components/ui/Switch';
import { Slider } from '@renderer/components/ui/Slider';
import { useConfigStore } from '@renderer/store/configStore';

export const ScheduleTab = (): JSX.Element => {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const patch = useConfigStore((s) => s.patch);

  if (!config) return <></>;

  const update = async (next: Partial<typeof config.schedule>) => {
    const newSchedule = { ...config.schedule, ...next };
    await patch({ schedule: newSchedule });
    if (newSchedule.enabled) {
      await window.api.scheduler.install({
        hour: newSchedule.hour,
        minute: newSchedule.minute,
      });
    } else {
      await window.api.scheduler.uninstall();
    }
  };

  const timeValue = `${String(config.schedule.hour).padStart(2, '0')}:${String(config.schedule.minute).padStart(2, '0')}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.schedule.title')}</CardTitle>
        <CardDescription>{t('settings.schedule.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
          <div>
            <div className="text-sm font-medium">{t('settings.schedule.auto_label')}</div>
            <div className="text-xs text-ink-500">{t('settings.schedule.auto_hint')}</div>
          </div>
          <Switch checked={config.schedule.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('settings.schedule.time_label')}</Label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                void update({ hour: h ?? 9, minute: m ?? 0 });
              }}
              disabled={!config.schedule.enabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.schedule.days_label')}</Label>
            <div className="flex items-center gap-3 pt-2">
              <Slider
                value={[config.schedule.daysBack]}
                min={1}
                max={30}
                step={1}
                onValueChange={(v) => void update({ daysBack: v[0] ?? 7 })}
                className="flex-1"
              />
              <span className="w-14 text-right text-sm font-medium tabular-nums">
                {config.schedule.daysBack}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
