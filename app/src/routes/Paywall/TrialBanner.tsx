import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useLicenseStore } from '@renderer/store/licenseStore';
import { Button } from '@renderer/components/ui/Button';

export const TrialBanner = (): JSX.Element | null => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const license = useLicenseStore((s) => s.license);
  const days = useLicenseStore((s) => s.daysRemaining);

  if (license?.status !== 'trial' || days === null) return null;

  return (
    <div className="no-drag bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4" />
        <span className="font-medium">
          {t('trial.banner', { days })}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-white hover:bg-white/10 hover:text-white"
        onClick={() => navigate('/paywall')}
      >
        {t('trial.upgrade_cta')}
      </Button>
    </div>
  );
};
