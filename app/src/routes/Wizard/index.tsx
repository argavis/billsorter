import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Logo } from '@renderer/components/Logo';
import { useWizardStore } from './wizardStore';
import { StepLocale } from './StepLocale';
import { StepWelcome } from './StepWelcome';
import { StepFolder } from './StepFolder';
import { StepProviders } from './StepProviders';
import { StepCredentials } from './StepCredentials';
import { StepSchedule } from './StepSchedule';
import { StepTest } from './StepTest';
import { StepDone } from './StepDone';
import { Progress } from '@renderer/components/ui/Progress';

const STEPS = [
  StepLocale,
  StepWelcome,
  StepFolder,
  StepProviders,
  StepCredentials,
  StepSchedule,
  StepTest,
  StepDone,
];

export const Wizard = (): JSX.Element => {
  const step = useWizardStore((s) => s.step);
  const Component = STEPS[step] ?? StepDone;
  const progress = ((step + 1) / STEPS.length) * 100;
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-50/40 via-white to-white">
      <header className="title-bar h-10" />

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl no-drag">
          <div className="mb-8 flex items-center gap-4">
            <Logo className="h-7" />
            <div className="text-xs text-ink-500 border-l border-ink-200 pl-4">
              {t('wizard.setup_label')} · {step + 1} / {STEPS.length}
            </div>
            <div className="ml-auto w-40">
              <Progress value={progress} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Component />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
