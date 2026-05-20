import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, CalendarRange } from 'lucide-react';
import { Card } from '@renderer/components/ui/Card';
import { Slider } from '@renderer/components/ui/Slider';
import { useConfigStore } from '@renderer/store/configStore';
import { cn } from '@renderer/lib/cn';

export type ScanRangeValue =
  | { mode: 'since'; sinceIso: string }
  | { mode: 'days'; daysBack: number };

type Props = {
  value: ScanRangeValue;
  onChange: (v: ScanRangeValue) => void;
};

export const ScanRange = ({ value, onChange }: Props): JSX.Element => {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const hasLastRun = !!config?.lastRun;

  // Local mode mirror for snappy UI.
  const [mode, setMode] = useState<'since' | 'days'>(value.mode);
  const [days, setDays] = useState<number>(
    value.mode === 'days' ? value.daysBack : config?.schedule.daysBack ?? 7,
  );

  // Wenn lastRun erst geladen wurde, automatisch auf since-Mode springen.
  useEffect(() => {
    if (hasLastRun && mode === 'days' && value.mode === 'days' && !valueWasUserChosen.current) {
      setMode('since');
      onChange({ mode: 'since', sinceIso: config!.lastRun! });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLastRun]);

  const valueWasUserChosen = useUserChosenRef();

  const pickSince = () => {
    valueWasUserChosen.current = true;
    if (!config?.lastRun) return;
    setMode('since');
    onChange({ mode: 'since', sinceIso: config.lastRun });
  };
  const pickDays = (n: number) => {
    valueWasUserChosen.current = true;
    setMode('days');
    setDays(n);
    onChange({ mode: 'days', daysBack: n });
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="text-sm font-medium text-ink-700 sm:w-40">
          {t('dashboard.range.title')}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <ToggleChip
            active={mode === 'since'}
            disabled={!hasLastRun}
            onClick={pickSince}
            icon={<History className="h-3.5 w-3.5" />}
          >
            {hasLastRun
              ? t('dashboard.range.since_last', { date: formatShort(config!.lastRun!) })
              : t('dashboard.range.since_disabled')}
          </ToggleChip>

          <ToggleChip
            active={mode === 'days'}
            onClick={() => pickDays(days)}
            icon={<CalendarRange className="h-3.5 w-3.5" />}
          >
            {t('dashboard.range.days_back')}
          </ToggleChip>

          {mode === 'days' && (
            <div className="flex flex-1 min-w-[200px] items-center gap-3 ml-2">
              <Slider
                value={[days]}
                min={1}
                max={365}
                step={1}
                onValueChange={(v) => pickDays(v[0] ?? 7)}
                className="flex-1"
              />
              <span className="w-20 text-right text-sm font-medium text-brand-700 tabular-nums">
                {days} {days === 1 ? t('dashboard.range.day') : t('dashboard.range.days')}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const ToggleChip = ({
  active,
  disabled,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  icon: JSX.Element;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
      'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/15',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      active
        ? 'border-brand-500 bg-brand-50 text-brand-700'
        : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300',
    )}
  >
    {icon}
    {children}
  </button>
);

const formatShort = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

// Tiny ref helper so we don't import useRef twice.
import { useRef } from 'react';
const useUserChosenRef = () => useRef(false);
