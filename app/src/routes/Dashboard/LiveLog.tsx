import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScanStore } from '@renderer/store/scanStore';
import type { LogLine, Job } from '@shared/types';
import { cn } from '@renderer/lib/cn';

// Phase 4.1: echte WS-Verbindung. Phase 4: wir bauen einen einfachen Job-Trace
// aus dem Job-State, da WS-Forward über Main noch nicht implementiert ist.

export const LiveLog = (): JSX.Element => {
  const { t } = useTranslation();
  const job = useScanStore((s) => s.job);
  const isRunning = useScanStore((s) => s.isRunning);
  const [lines, setLines] = useState<LogLine[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Synthesize log lines from job state changes.
  useEffect(() => {
    if (!job) return;
    setLines((prev) => derive(job, prev));
  }, [job]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="rounded-lg bg-ink-50 border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
        {isRunning ? t('dashboard.log_running') : t('dashboard.log_idle')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-72 overflow-y-auto scroll-thin rounded-lg bg-ink-900 text-ink-100 font-mono text-xs leading-relaxed p-4 space-y-0.5"
    >
      {lines.map((line) => (
        <LogRow key={`${line.ts}-${line.message}`} line={line} />
      ))}
    </div>
  );
};

const LogRow = ({ line }: { line: LogLine }) => {
  const time = new Date(line.ts * 1000).toLocaleTimeString();
  const tone =
    line.level === 'error'
      ? 'text-red-300'
      : line.level === 'success'
      ? 'text-emerald-300'
      : line.level === 'warn'
      ? 'text-amber-300'
      : 'text-ink-200';
  return (
    <div className={cn('flex gap-3', tone)}>
      <span className="text-ink-500 shrink-0">{time}</span>
      <span className="break-all">{line.message}</span>
    </div>
  );
};

// Aus dem Job-State pseudo-Loglines bauen, damit der User Feedback bekommt.
const derive = (job: Job, prev: LogLine[]): LogLine[] => {
  const now = Date.now() / 1000;
  if (job.state === 'pending' && prev.length === 0) {
    return [
      { jobId: job.id, ts: now, level: 'info', message: `Job ${job.id.slice(0, 8)} wartet…` },
    ];
  }
  const s = job.stats;
  const skipped = (s.skippedNotInvoice ?? 0) + (s.skippedDuplicate ?? 0);
  const found = s.found ?? 0;
  const saved = s.saved ?? 0;
  if (job.state === 'running') {
    const last = prev.at(-1);
    const msg = `Scan läuft — ${found} gefunden, ${saved} gespeichert, ${skipped} übersprungen`;
    if (last?.message === msg) return prev;
    return [...prev, { jobId: job.id, ts: now, level: 'info', message: msg }];
  }
  if (job.state === 'done') {
    const last = prev.at(-1);
    const dupNote = (s.skippedDuplicate ?? 0) > 0
      ? ` (davon ${s.skippedDuplicate} bereits vorhanden)`
      : '';
    const msg = `Fertig — ${saved} neu gespeichert, ${skipped} übersprungen${dupNote}`;
    if (last?.message === msg) return prev;
    return [...prev, { jobId: job.id, ts: now, level: 'success', message: msg }];
  }
  if (job.state === 'failed') {
    return [...prev, { jobId: job.id, ts: now, level: 'error', message: `Fehler: ${job.error}` }];
  }
  return prev;
};
