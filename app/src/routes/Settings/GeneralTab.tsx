import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Folder, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@renderer/components/ui/Card';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/Select';
import { useConfigStore } from '@renderer/store/configStore';
import type { Locale } from '@shared/types';

export const GeneralTab = (): JSX.Element => {
  const { t, i18n } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const patch = useConfigStore((s) => s.patch);
  const setLocale = useConfigStore((s) => s.setLocale);
  const [saving, setSaving] = useState(false);

  const changeLocale = async (value: Locale) => {
    setSaving(true);
    await setLocale(value);
    await i18n.changeLanguage(value);
    setSaving(false);
  };

  const pickFolder = async () => {
    const res = await window.api.filesystem.pickFolder({
      defaultPath: config?.rechnungsOrdner ?? undefined,
    });
    if (!res.canceled && res.path) {
      await patch({ rechnungsOrdner: res.path });
    }
  };

  const openPortal = async () => {
    const res = await window.api.license.portal();
    if (!res.ok) alert(res.error);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general.locale_title')}</CardTitle>
          <CardDescription>{t('settings.general.locale_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={config?.locale ?? 'de'} onValueChange={(v) => changeLocale(v as Locale)} disabled={saving}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general.folder_title')}</CardTitle>
          <CardDescription>{t('settings.general.folder_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={config?.rechnungsOrdner ?? ''} readOnly className="flex-1" />
            <Button variant="secondary" onClick={pickFolder}>
              <Folder className="h-4 w-4" />
              {t('settings.general.folder_change')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general.subscription_title')}</CardTitle>
          <CardDescription>{t('settings.general.subscription_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={openPortal}>
            {t('settings.general.open_portal')}
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
