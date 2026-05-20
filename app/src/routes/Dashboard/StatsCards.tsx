import { useTranslation } from 'react-i18next';
import { Search, Save, SkipForward, Copy } from 'lucide-react';
import { useScanStore } from '@renderer/store/scanStore';
import { Card } from '@renderer/components/ui/Card';

export const StatsCards = (): JSX.Element => {
  const { t } = useTranslation();
  const job = useScanStore((s) => s.job);

  // Karten zeigen Zahlen des AKTUELLEN (oder zuletzt beendeten) Jobs.
  // Lifetime-Totals werden in config.stats kumuliert für spätere Statistik-Ansicht.
  const s = job?.stats;
  const found = s?.found ?? 0;
  const saved = s?.saved ?? 0;
  const skippedNotInvoice = s?.skippedNotInvoice ?? 0;
  const skippedDuplicate = s?.skippedDuplicate ?? 0;

  return (
    <div className="grid grid-cols-4 gap-4">
      <Stat icon={<Search className="h-4 w-4" />} label={t('dashboard.stats.found')} value={found} tone="brand" />
      <Stat icon={<Save className="h-4 w-4" />} label={t('dashboard.stats.saved')} value={saved} tone="success" />
      <Stat icon={<SkipForward className="h-4 w-4" />} label={t('dashboard.stats.skipped')} value={skippedNotInvoice} tone="neutral" />
      <Stat icon={<Copy className="h-4 w-4" />} label={t('dashboard.stats.duplicate')} value={skippedDuplicate} tone="neutral" />
    </div>
  );
};

const Stat = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  value: number;
  tone: 'brand' | 'success' | 'neutral';
}) => {
  const bg = tone === 'brand'
    ? 'bg-brand-50 text-brand-700'
    : tone === 'success'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-ink-100 text-ink-600';
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
          {icon}
        </span>
        <div>
          <div className="text-xs text-ink-500">{label}</div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
};
