import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2, Clock, Settings2, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/Card';
import { Button } from '@renderer/components/ui/Button';
import { useConfigStore } from '@renderer/store/configStore';
import { useScanStore } from '@renderer/store/scanStore';
import { LiveLog } from './LiveLog';
import { StatsCards } from './StatsCards';
import { ScanRange, type ScanRangeValue } from './ScanRange';
import { AutomationDialog } from './AutomationDialog';
import { cn } from '@renderer/lib/cn';

export const Dashboard = (): JSX.Element => {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const patchConfig = useConfigStore((s) => s.patch);
  const start = useScanStore((s) => s.startScan);
  const isRunning = useScanStore((s) => s.isRunning);
  const [starting, setStarting] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  const defaultRange = useMemo<ScanRangeValue>(() => {
    if (config?.lastRun) return { mode: 'since', sinceIso: config.lastRun };
    return { mode: 'days', daysBack: config?.schedule.daysBack ?? 7 };
  }, [config?.lastRun, config?.schedule.daysBack]);

  const [range, setRange] = useState<ScanRangeValue>(defaultRange);

  useEffect(() => {
    setRange(defaultRange);
  }, [defaultRange]);

  const handleRun = async () => {
    if (!config || !config.rechnungsOrdner) return;
    setStarting(true);
    try {
      const [backendUrl, deviceId] = await Promise.all([
        window.api.system.getBackendUrl(),
        window.api.system.getDeviceId(),
      ]);
      const providers = await Promise.all(
        config.providers.filter((p) => p.enabled).map(async (p) => {
          const pw = (await window.api.credentials.get(`imap:${p.email}`)) ?? '';
          return {
            id: p.id,
            provider_id: p.type,
            label: p.label,
            email: p.email,
            password: pw,
            imap_host: p.imapHost,
            imap_port: p.imapPort,
          };
        }),
      );
      const common = {
        providers,
        backend_url: backendUrl,
        device_id: deviceId,
        target_folder: config.rechnungsOrdner,
        locale: config.locale,
      } as const;
      if (range.mode === 'since') {
        await start({ ...common, mode: 'since', since: range.sinceIso });
      } else {
        await start({ ...common, mode: 'days', days_back: range.daysBack });
      }
    } finally {
      setStarting(false);
    }
  };

  // Quick-toggle Auto-Scan ohne Dialog zu öffnen.
  const toggleAuto = async () => {
    if (!config || autoBusy) return;
    setAutoBusy(true);
    try {
      const next = !config.schedule.enabled;
      await patchConfig({
        schedule: { ...config.schedule, enabled: next },
      });
      if (next) {
        await window.api.scheduler.install({
          hour: config.schedule.hour,
          minute: config.schedule.minute,
        });
      } else {
        await window.api.scheduler.uninstall();
      }
    } finally {
      setAutoBusy(false);
    }
  };

  const nextRun = useNextRunLabel();
  const lastRunLabel = config?.lastRun ? formatDate(config.lastRun) : t('dashboard.never');
  const autoOn = config?.schedule.enabled ?? false;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">
            {t('dashboard.subtitle', { count: config?.providers.length ?? 0 })}
          </p>
        </div>
        <Button onClick={handleRun} disabled={starting || isRunning} size="lg">
          {starting || isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isRunning ? t('dashboard.scanning') : t('dashboard.run_now')}
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-ink-400" />
            <div>
              <div className="text-xs text-ink-500">{t('dashboard.next_run')}</div>
              <div className="text-sm font-medium text-ink-900">{nextRun}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-500">{t('dashboard.last_run')}</div>
            <div className="text-sm font-medium text-ink-900">{lastRunLabel}</div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleAuto}
              disabled={autoBusy}
              title={autoOn ? t('automation.click_to_disable') : t('automation.click_to_enable')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/15',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                autoOn
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-ink-200 bg-ink-50 text-ink-600 hover:bg-ink-100',
              )}
            >
              <Power className="h-3 w-3" />
              {autoOn ? t('dashboard.auto_on') : t('dashboard.auto_off')}
            </button>
            <button
              type="button"
              onClick={() => setAutomationOpen(true)}
              title={t('automation.edit')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/15"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      <ScanRange value={range} onChange={setRange} />

      <StatsCards />

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.log_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LiveLog />
        </CardContent>
      </Card>

      <AutomationDialog open={automationOpen} onOpenChange={setAutomationOpen} />
    </div>
  );
};

const useNextRunLabel = (): string => {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const [label, setLabel] = useState('—');
  useEffect(() => {
    if (!config || !config.schedule.enabled) {
      setLabel(t('dashboard.auto_off'));
      return;
    }
    const now = new Date();
    const next = new Date();
    next.setHours(config.schedule.hour, config.schedule.minute, 0, 0);
    if (next.getTime() < now.getTime()) next.setDate(next.getDate() + 1);
    const isToday = next.getDate() === now.getDate();
    const hh = String(next.getHours()).padStart(2, '0');
    const mm = String(next.getMinutes()).padStart(2, '0');
    setLabel(`${isToday ? t('dashboard.today') : t('dashboard.tomorrow')} ${hh}:${mm}`);
  }, [config, t]);
  return label;
};

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};
