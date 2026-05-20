import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/Button';
import { Card } from '@renderer/components/ui/Card';
import { useWizardStore } from './wizardStore';

type Props = {
  title: string;
  subtitle?: string;
  canNext?: boolean;
  showBack?: boolean;
  nextLabel?: string;
  onNext?: () => void | Promise<void>;
  children: React.ReactNode;
};

export const WizardCard = ({
  title,
  subtitle,
  canNext = true,
  showBack = true,
  nextLabel,
  onNext,
  children,
}: Props): JSX.Element => {
  const { t } = useTranslation();
  const back = useWizardStore((s) => s.back);
  const next = useWizardStore((s) => s.next);

  const handleNext = async () => {
    if (onNext) await onNext();
    next();
  };

  return (
    <Card className="p-10 shadow-soft">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="text-ink-500">{subtitle}</p>}
      </div>

      <div className="mt-8">{children}</div>

      <div className="mt-10 flex items-center justify-between">
        {showBack ? (
          <Button variant="ghost" size="md" onClick={back}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleNext} disabled={!canNext}>
          {nextLabel ?? t('common.next')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
