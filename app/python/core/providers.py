"""Provider-Definitionen — IMAP-Server, Port, Doku-Links.

Diese Liste ist die zentrale Quelle. Frontend zeigt sie im Wizard.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderPreset:
    id: str
    label: str
    imap_host: str | None  # None → user-defined (custom-imap)
    imap_port: int
    help_url: str
    requires_app_password: bool
    notes_de: str
    notes_en: str


PROVIDERS: dict[str, ProviderPreset] = {
    "outlook-365": ProviderPreset(
        id="outlook-365",
        label="Outlook (Microsoft 365)",
        imap_host="outlook.office365.com",
        imap_port=993,
        help_url="https://support.microsoft.com/account-billing/manage-app-passwords-for-two-step-verification-d6dc8c6d-4bf7-4851-ad95-6d07799387e9",
        requires_app_password=True,
        notes_de="Microsoft 365 mit aktiviertem App-Passwort. 2FA muss eingeschaltet sein.",
        notes_en="Microsoft 365 with app password enabled. Requires 2FA.",
    ),
    "outlook-imap": ProviderPreset(
        id="outlook-imap",
        label="Outlook (eigener Mailserver, z.B. Netcup)",
        imap_host=None,
        imap_port=993,
        help_url="",
        requires_app_password=False,
        notes_de="Eigener IMAP-Server (z.B. Netcup). Host + Port selbst eintragen.",
        notes_en="Custom IMAP server (e.g. Netcup). Specify host + port manually.",
    ),
    "gmail-imap": ProviderPreset(
        id="gmail-imap",
        label="Gmail",
        imap_host="imap.gmail.com",
        imap_port=993,
        help_url="https://support.google.com/accounts/answer/185833",
        requires_app_password=True,
        notes_de="App-Passwort erforderlich. 2FA in Google-Konto aktivieren, dann App-Passwort erzeugen.",
        notes_en="App password required. Enable 2FA on Google account, then generate app password.",
    ),
    "gmx": ProviderPreset(
        id="gmx",
        label="GMX",
        imap_host="imap.gmx.net",
        imap_port=993,
        help_url="https://hilfe.gmx.net/pop-imap/imap.html",
        requires_app_password=False,
        notes_de="POP3/IMAP-Zugriff in GMX-Einstellungen aktivieren ('Externes Programm').",
        notes_en="Enable POP3/IMAP access in GMX settings ('External program').",
    ),
    "web-de": ProviderPreset(
        id="web-de",
        label="Web.de",
        imap_host="imap.web.de",
        imap_port=993,
        help_url="https://hilfe.web.de/pop-imap/imap.html",
        requires_app_password=False,
        notes_de="POP3/IMAP-Zugriff in Web.de-Einstellungen aktivieren.",
        notes_en="Enable POP3/IMAP access in Web.de settings.",
    ),
    "icloud": ProviderPreset(
        id="icloud",
        label="iCloud",
        imap_host="imap.mail.me.com",
        imap_port=993,
        help_url="https://support.apple.com/de-de/102654",
        requires_app_password=True,
        notes_de="App-spezifisches Passwort in den Apple-ID-Einstellungen erzeugen.",
        notes_en="Generate an app-specific password in Apple ID settings.",
    ),
    "yahoo": ProviderPreset(
        id="yahoo",
        label="Yahoo",
        imap_host="imap.mail.yahoo.com",
        imap_port=993,
        help_url="https://help.yahoo.com/kb/SLN15241.html",
        requires_app_password=True,
        notes_de="App-Passwort in den Yahoo-Konto-Einstellungen anlegen.",
        notes_en="Create an app password in Yahoo account settings.",
    ),
    "ionos": ProviderPreset(
        id="ionos",
        label="IONOS",
        imap_host="imap.ionos.de",
        imap_port=993,
        help_url="https://www.ionos.de/hilfe/e-mail/e-mail-mit-dem-pc-am-mac-oder-mobilgeraet-einrichten/imap-einstellungen-fuer-ionos-mail/",
        requires_app_password=False,
        notes_de="Normales E-Mail-Passwort funktioniert.",
        notes_en="Regular email password works.",
    ),
    "custom-imap": ProviderPreset(
        id="custom-imap",
        label="Custom IMAP",
        imap_host=None,
        imap_port=993,
        help_url="",
        requires_app_password=False,
        notes_de="Beliebiger IMAP-Server. Host, Port, Email, Passwort selbst eintragen.",
        notes_en="Any IMAP server. Specify host, port, email, password manually.",
    ),
}


def resolve_imap(provider_id: str, custom_host: str | None, custom_port: int | None) -> tuple[str, int]:
    """Liefere den endgültigen IMAP-Host + Port für einen Provider.

    Für user-defined Provider (outlook-imap, custom-imap) müssen custom_host + custom_port gesetzt sein.
    """
    preset = PROVIDERS.get(provider_id)
    if preset is None:
        raise ValueError(f"Unknown provider: {provider_id}")

    host = preset.imap_host or custom_host
    if not host:
        raise ValueError(f"Provider '{provider_id}' requires an IMAP host but none was provided")

    port = custom_port or preset.imap_port
    return host, port
