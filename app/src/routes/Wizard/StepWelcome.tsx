import { useTranslation } from 'react-i18next';
import { Inbox, Sparkles, Lock } from 'lucide-react';
import { WizardCard } from './WizardCard';
import { useLicenseStore } from '@renderer/store/licenseStore';
import { useWizardStore } from './wizardStore';

export const StepWelcome = (): JSX.Element => {
  const { t } = useTranslation();
  const locale = useWizardStore((s) => s.locale);
  const trialStart = useLicenseStore((s) => s.trialStart);
  const license = useLicenseStore((s) => s.license);

  const onNext = async () => {
    if (!license || license.status === 'unverified') {
      await trialStart(locale);
    }
  };

  return (
    <WizardCard
      title={t('wizard.step_welcome.title')}
      subtitle={t('wizard.step_welcome.subtitle')}
      showBack={false}
      nextLabel={t('wizard.step_welcome.cta')}
      onNext={onNext}
    >
      <ul className="space-y-3">
        <FeatureLine icon={<Inbox className="h-4 w-4" />} text={t('wizard.step_welcome.feat1')} />
        <FeatureLine icon={<Sparkles className="h-4 w-4" />} text={t('wizard.step_welcome.feat2')} />
        <FeatureLine icon={<Lock className="h-4 w-4" />} text={t('wizard.step_welcome.feat3')} />
      </ul>

      <div className="mt-8 rounded-lg border border-brand-100 bg-brand-50/50 p-4 text-sm text-brand-800">
        {t('wizard.step_welcome.trial_hint')}
      </div>
    </WizardCard>
  );
};

const FeatureLine = ({ icon, text }: { icon: JSX.Element; text: string }) => (
  <li className="flex items-start gap-3 text-sm">
    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700">
      {icon}
    </span>
    <span className="text-ink-700">{text}</span>
  </li>
);
