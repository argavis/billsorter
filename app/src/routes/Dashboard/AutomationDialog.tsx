import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CalendarRange, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { Label } from '@renderer/components/ui/Label';
import { Slider } from '@renderer/components/ui/Slider';
import { Switch } from '@renderer/components/ui/Switch';
import { useConfigStore } from '@renderer/store/configStore';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const AutomationDialog = ({ open, onOpenChange }: Props): JSX.Element => {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const patch = useConfigStore((s) => s.patch);

  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [daysBack, setDaysBack] = useState(7);
  const [saving, setSaving] = useState(false);

  // Mit Config synchronisieren beim Öffnen.
  useEffect(() => {
    if (!open || !config) return;
    setEnabled(config.schedule.enabled);
    setHour(config.schedule.hour);
    setMinute(config.schedule.minute);
    setDaysBack(config.schedule.daysBack);
  }, [open, config]);

  const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const save = async () => {
    setSaving(true);
    try {
      await patch({
        schedule: { hour, minute, daysBack, enabled },
      });
      if (enabled) {
        await window.api.scheduler.install({ hour, minute });
      } else {
        await window.api.scheduler.uninstall();
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div>
          <DialogTitle>{t('automation.title')}</DialogTitle>
          <DialogDescription>{t('automation.description')}</DialogDescription>
        </div>

        <div className="space-y-5 mt-4">
          <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink-900">
                {t('automation.toggle_label')}
              </div>
              <div className="text-xs text-ink-500">
                {enabled ? t('automation.toggle_on_hint') : t('automation.toggle_off_hint')}
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-ink-400" />
                {t('automation.time')}
              </Label>
              <Input
                type="time"
                value={timeValue}
                disabled={!enabled}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  if (Number.isFinite(h)) setHour(h);
                  if (Number.isFinite(m)) setMinute(m);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarRange className="h-3.5 w-3.5 text-ink-400" />
                {t('automation.days_back')}
              </Label>
              <div className="flex items-center gap-3 pt-2">
                <Slider
                  value={[daysBack]}
                  min={1}
                  max={365}
                  step={1}
                  disabled={!enabled}
                  onValueChange={(v) => setDaysBack(v[0] ?? 7)}
                  className="flex-1"
                />
                <span className="w-14 text-right text-sm font-medium text-brand-700 tabular-nums">
                  {daysBack}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-500">
            {t('automation.os_hint')}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
