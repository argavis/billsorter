import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Check, XCircle, Loader2 } from 'lucide-react';
import { WizardCard } from './WizardCard';
import { Button } from '@renderer/components/ui/Button';
import { useWizardStore } from './wizardStore';
import type { TestImapResult } from '@shared/types';

export const StepTest = (): JSX.Element => {
  const { t } = useTranslation();
  const providers = useWizardStore((s) => s.providers);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestImapResult[] | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResults(null);
    const res = await window.api.sidecar.request({
      method: 'POST',
      path: '/v1/test-imap',
      body: {
        providers: providers.map((p) => ({
          id: p.id,
          provider_id: p.type,
          label: p.label,
          email: p.email,
          password: p.password,
          imap_host: p.imapHost,
          imap_port: p.imapPort,
        })),
      },
    });
    setTesting(false);
    if (res.ok) {
      const data = res.data as { results: TestImapResult[] };
      setResults(data.results);
    } else {
      setResults(providers.map((p) => ({
        providerId: p.type,
        label: p.label,
        ok: false,
        error: res.error,
        mailboxCount: null,
      })));
    }
  };

  const anyOk = results?.some((r) => r.ok) ?? false;

  return (
    <WizardCard
      title={t('wizard.step_test.title')}
      subtitle={t('wizard.step_test.subtitle')}
      canNext={anyOk}
    >
      <div className="space-y-3">
        <Button onClick={runTest} disabled={testing}>
          {testing && <Loader2 className="h-4 w-4 animate-spin" />}
          {testing ? t('wizard.step_test.testing') : t('wizard.step_test.run')}
        </Button>

        {results && (
          <div className="space-y-2 pt-3">
            {results.map((r) => (
              <ResultRow key={r.providerId + r.label} result={r} />
            ))}
          </div>
        )}
      </div>
    </WizardCard>
  );
};

const ResultRow = ({ result }: { result: TestImapResult }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3">
      {result.ok ? (
        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{result.label}</div>
        {result.ok && (
          <div className="text-xs text-ink-500">
            {result.mailboxCount !== null
              ? t('wizard.step_test.mailbox_count', { count: result.mailboxCount })
              : t('wizard.step_test.ok')}
          </div>
        )}
        {!result.ok && (
          <div className="text-xs text-red-700 truncate">{result.error}</div>
        )}
      </div>
    </div>
  );
};
