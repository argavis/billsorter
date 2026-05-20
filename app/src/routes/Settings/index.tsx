import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/Tabs';
import { ProvidersTab } from './ProvidersTab';
import { ScheduleTab } from './ScheduleTab';
import { GeneralTab } from './GeneralTab';

export const Settings = (): JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('settings.tab_general')}</TabsTrigger>
          <TabsTrigger value="providers">{t('settings.tab_providers')}</TabsTrigger>
          <TabsTrigger value="schedule">{t('settings.tab_schedule')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="schedule"><ScheduleTab /></TabsContent>
      </Tabs>
    </div>
  );
};
