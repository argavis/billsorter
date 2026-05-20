// Provider-Presets gespiegelt aus app/python/core/providers.py.
// Wir laden sie zur Laufzeit per /v1/providers, aber für Wizard-Start brauchen wir Static-Fallback.

import type { ProviderType } from '@shared/types';

export type ProviderPreset = {
  id: ProviderType;
  label: string;
  imapHost: string | null;
  imapPort: number;
  helpUrl: string;
  requiresAppPassword: boolean;
};

export const STATIC_PROVIDERS: ProviderPreset[] = [
  { id: 'outlook-365', label: 'Outlook (Microsoft 365)', imapHost: 'outlook.office365.com', imapPort: 993, helpUrl: 'https://support.microsoft.com/account-billing/manage-app-passwords-for-two-step-verification-d6dc8c6d-4bf7-4851-ad95-6d07799387e9', requiresAppPassword: true },
  { id: 'outlook-imap', label: 'Outlook (eigener Mailserver)', imapHost: null, imapPort: 993, helpUrl: '', requiresAppPassword: false },
  { id: 'gmail-imap', label: 'Gmail', imapHost: 'imap.gmail.com', imapPort: 993, helpUrl: 'https://support.google.com/accounts/answer/185833', requiresAppPassword: true },
  { id: 'gmx', label: 'GMX', imapHost: 'imap.gmx.net', imapPort: 993, helpUrl: 'https://hilfe.gmx.net/pop-imap/imap.html', requiresAppPassword: false },
  { id: 'web-de', label: 'Web.de', imapHost: 'imap.web.de', imapPort: 993, helpUrl: 'https://hilfe.web.de/pop-imap/imap.html', requiresAppPassword: false },
  { id: 'icloud', label: 'iCloud', imapHost: 'imap.mail.me.com', imapPort: 993, helpUrl: 'https://support.apple.com/de-de/102654', requiresAppPassword: true },
  { id: 'yahoo', label: 'Yahoo', imapHost: 'imap.mail.yahoo.com', imapPort: 993, helpUrl: 'https://help.yahoo.com/kb/SLN15241.html', requiresAppPassword: true },
  { id: 'ionos', label: 'IONOS', imapHost: 'imap.ionos.de', imapPort: 993, helpUrl: 'https://www.ionos.de/hilfe/e-mail/e-mail-mit-dem-pc-am-mac-oder-mobilgeraet-einrichten/imap-einstellungen-fuer-ionos-mail/', requiresAppPassword: false },
  { id: 'custom-imap', label: 'Custom IMAP', imapHost: null, imapPort: 993, helpUrl: '', requiresAppPassword: false },
];

export const getPreset = (id: ProviderType): ProviderPreset | undefined =>
  STATIC_PROVIDERS.find((p) => p.id === id);
