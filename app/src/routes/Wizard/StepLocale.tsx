import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WizardCard } from './WizardCard';
import { useWizardStore } from './wizardStore';
import { useConfigStore } from '@renderer/store/configStore';
import { cn } from '@renderer/lib/cn';

export const StepLocale = (): JSX.Element => {
  const { t, i18n } = useTranslation();
  const locale = useWizardStore((s) => s.locale);
  const setLocale = useWizardStore((s) => s.setLocale);
  const configSetLocale = useConfigStore((s) => s.setLocale);

  useEffect(() => {
    void window.api.system.getLocale().then((osLocale) => {
      setLocale(osLocale);
      void i18n.changeLanguage(osLocale);
    });
  }, [setLocale, i18n]);

  const choose = (l: 'de' | 'en') => {
    setLocale(l);
    void i18n.changeLanguage(l);
    void configSetLocale(l);
  };

  return (
    <WizardCard
      title={t('wizard.step_locale.title')}
      subtitle={t('wizard.step_locale.subtitle')}
      showBack={false}
    >
      <div className="grid grid-cols-2 gap-3">
        <LangCard
          active={locale === 'de'}
          flag="🇩🇪"
          label="Deutsch"
          onClick={() => choose('de')}
        />
        <LangCard
          active={locale === 'en'}
          flag="🇬🇧"
          label="English"
          onClick={() => choose('en')}
        />
      </div>
    </WizardCard>
  );
};

const LangCard = ({
  active,
  flag,
  label,
  onClick,
}: {
  active: boolean;
  flag: string;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-3 rounded-xl border-2 px-6 py-8 transition-all',
      active
        ? 'border-brand-500 bg-brand-50 shadow-soft'
        : 'border-ink-200 bg-white hover:border-brand-300',
    )}
  >
    <span className="text-4xl">{flag}</span>
    <span className="text-sm font-medium text-ink-900">{label}</span>
  </button>
);
