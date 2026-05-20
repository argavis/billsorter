import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Card } from '@renderer/components/ui/Card';
import { useLicenseStore } from '@renderer/store/licenseStore';
import { useConfigStore } from '@renderer/store/configStore';
import { Logo } from '@renderer/components/Logo';

export const Paywall = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const license = useLicenseStore((s) => s.license);
  const config = useConfigStore((s) => s.config);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpired = license?.status === 'expired' || license?.status === 'revoked';

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    const res = await window.api.license.checkout({ locale: config?.locale ?? 'de' });
    setLoading(false);
    if (!res.ok) setError(res.error ?? 'unknown');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 via-white to-white">
      <div className="title-bar h-10" />

      <div className="px-6 py-12">
        <div className="mx-auto max-w-md no-drag">
          <div className="mb-8 flex items-center gap-3">
            <Logo className="h-7" />
            {!isExpired && (
              <button
                onClick={() => navigate(-1)}
                className="ml-auto text-sm text-ink-500 hover:text-ink-700 flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('common.back')}
              </button>
            )}
          </div>

          <Card className="overflow-hidden p-0">
            <div className="px-8 pt-10 pb-8 text-center">
              {isExpired && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-medium mb-4">
                  {t('paywall.expired_badge')}
                </div>
              )}
              <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
                {t('paywall.title')}
              </h1>
              <p className="mt-2 text-ink-500">{t('paywall.subtitle')}</p>

              <div className="mt-8 mb-2">
                <span className="text-5xl font-bold tracking-tight text-brand-700">4,99 €</span>
                <span className="text-ink-500 ml-1">{t('paywall.per_month')}</span>
              </div>
              <p className="text-xs text-ink-500">{t('paywall.vat_included')}</p>
            </div>

            <div className="border-t border-ink-100 px-8 py-6 space-y-3 bg-ink-50/40">
              <Feature text={t('paywall.feat1')} />
              <Feature text={t('paywall.feat2')} />
              <Feature text={t('paywall.feat3')} />
              <Feature text={t('paywall.feat4')} />
            </div>

            <div className="px-8 pb-8 pt-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {t('paywall.cta_stripe')}
              </Button>
              {error && (
                <p className="mt-3 text-xs text-red-700 text-center">{error}</p>
              )}
              <p className="mt-3 text-xs text-ink-500 text-center">
                {t('paywall.cancel_anytime')}
              </p>
            </div>
          </Card>

          <p className="mt-6 text-xs text-ink-400 text-center">
            ARGAVIS — Einzelunternehmen, Deutschland
          </p>
        </div>
      </div>
    </div>
  );
};

const Feature = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2.5 text-sm">
    <Check className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
    <span className="text-ink-700">{text}</span>
  </div>
);
