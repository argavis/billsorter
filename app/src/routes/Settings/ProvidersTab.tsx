import { useTranslation } from 'react-i18next';
import { Mail, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@renderer/components/ui/Card';
import { Switch } from '@renderer/components/ui/Switch';
import { Button } from '@renderer/components/ui/Button';
import { Badge } from '@renderer/components/ui/Badge';
import { useConfigStore } from '@renderer/store/configStore';

export const ProvidersTab = (): JSX.Element => {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const patch = useConfigStore((s) => s.patch);

  const toggleEnabled = async (id: string) => {
    if (!config) return;
    await patch({
      providers: config.providers.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p,
      ),
    });
  };

  const remove = async (id: string) => {
    if (!config) return;
    const provider = config.providers.find((p) => p.id === id);
    if (provider) {
      await window.api.credentials.delete(`imap:${provider.email}`);
    }
    await patch({
      providers: config.providers.filter((p) => p.id !== id),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.providers.title')}</CardTitle>
        <CardDescription>{t('settings.providers.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {config?.providers.length === 0 && (
          <p className="text-sm text-ink-500">{t('settings.providers.empty')}</p>
        )}
        {config?.providers.map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-lg border border-ink-200 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Mail className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium truncate">{p.label}</div>
                <Badge tone={p.enabled ? 'success' : 'neutral'}>
                  {p.enabled ? t('settings.providers.active') : t('settings.providers.disabled')}
                </Badge>
              </div>
              <div className="text-xs text-ink-500 truncate">{p.email}</div>
            </div>
            <Switch checked={p.enabled} onCheckedChange={() => toggleEnabled(p.id)} />
            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
              <Trash2 className="h-4 w-4 text-ink-400 hover:text-red-600" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
