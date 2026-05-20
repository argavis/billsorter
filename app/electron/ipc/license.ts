// License-Layer: Backend-Calls + lokales Caching + JWT-Verify.

import { ipcMain, shell, BrowserWindow } from 'electron';
import { IPC, type LicenseCheckResult } from '@shared/types';
import { apiFetch } from '../lib/api';
import { getSecret, setSecret, deleteSecret } from './credentials';
import { verifyLicenseToken, type VerifiedToken } from '../lib/jwtVerify';
import { getRawDeviceId } from '../lib/deviceId';
import { logger } from '../lib/logger';

const TOKEN_KEY = 'license:token';

type TrialStartReq = { appVersion: string; os: 'mac' | 'windows' | 'linux'; locale: 'de' | 'en' };
type CheckReq = { appVersion: string };
type CheckoutReq = { locale: 'de' | 'en' };
type PortalReq = Record<string, never>;

const broadcastLicenseChanged = (result: LicenseCheckResult): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.eventLicenseChanged, result);
  }
};

export const trialStart = async (req: TrialStartReq): Promise<LicenseCheckResult> => {
  const deviceId = getRawDeviceId();
  const res = await apiFetch<LicenseCheckResult>('/v1/trial/start', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      appVersion: req.appVersion,
      os: req.os,
      locale: req.locale,
    }),
  });
  if (!res.ok) {
    logger.warn('trial/start failed', res.error);
    return {
      status: 'unverified',
      expiresAt: new Date(0).toISOString(),
      trialEndsAt: null,
      graceDays: 7,
      token: null,
    };
  }
  if (res.data.token) {
    await setSecret(TOKEN_KEY, res.data.token);
  }
  broadcastLicenseChanged(res.data);
  return res.data;
};

export const licenseCheck = async (req: CheckReq): Promise<LicenseCheckResult> => {
  const deviceId = getRawDeviceId();
  const res = await apiFetch<LicenseCheckResult>('/v1/license/check', {
    method: 'POST',
    body: JSON.stringify({ deviceId, appVersion: req.appVersion }),
  });
  if (!res.ok) {
    // Offline-Fallback: lokal verifizieren
    const cached = await getSecret(TOKEN_KEY);
    if (cached) {
      const verified = await verifyLicenseToken(cached);
      if (verified.valid && verified.claims) {
        return {
          status: verified.claims.status,
          expiresAt: verified.claims.expiresAt,
          trialEndsAt: verified.claims.trialEndsAt ?? null,
          graceDays: verified.claims.graceDays,
          token: cached,
        };
      }
    }
    return {
      status: 'unverified',
      expiresAt: new Date(0).toISOString(),
      trialEndsAt: null,
      graceDays: 7,
      token: null,
    };
  }
  if (res.data.token) {
    await setSecret(TOKEN_KEY, res.data.token);
  } else if (res.data.status === 'expired' || res.data.status === 'revoked') {
    await deleteSecret(TOKEN_KEY);
  }
  broadcastLicenseChanged(res.data);
  return res.data;
};

export const startCheckout = async (req: CheckoutReq): Promise<{ ok: boolean; error?: string }> => {
  const deviceId = getRawDeviceId();
  const res = await apiFetch<{ url: string; sessionId: string }>('/v1/checkout/stripe', {
    method: 'POST',
    body: JSON.stringify({ deviceId, locale: req.locale }),
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  await shell.openExternal(res.data.url);
  return { ok: true };
};

export const openPortal = async (_req: PortalReq): Promise<{ ok: boolean; error?: string }> => {
  const deviceId = getRawDeviceId();
  const res = await apiFetch<{ url: string }>('/v1/portal', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  await shell.openExternal(res.data.url);
  return { ok: true };
};

export const getCachedToken = async (): Promise<{ token: string | null; verified: VerifiedToken | null }> => {
  const token = await getSecret(TOKEN_KEY);
  if (!token) return { token: null, verified: null };
  const verified = await verifyLicenseToken(token);
  return { token, verified };
};

export const saveTokenFromDeepLink = async (token: string): Promise<LicenseCheckResult | null> => {
  const verified = await verifyLicenseToken(token);
  if (!verified.valid || !verified.claims) {
    logger.warn('deep-link token failed verification');
    return null;
  }
  await setSecret(TOKEN_KEY, token);
  const result: LicenseCheckResult = {
    status: verified.claims.status,
    expiresAt: verified.claims.expiresAt,
    trialEndsAt: verified.claims.trialEndsAt ?? null,
    graceDays: verified.claims.graceDays,
    token,
  };
  broadcastLicenseChanged(result);
  return result;
};

export const registerLicenseIpc = (): void => {
  ipcMain.handle(IPC.licenseTrialStart, async (_evt, req: TrialStartReq) => trialStart(req));
  ipcMain.handle(IPC.licenseCheck, async (_evt, req: CheckReq) => licenseCheck(req));
  ipcMain.handle(IPC.licenseCheckout, async (_evt, req: CheckoutReq) => startCheckout(req));
  ipcMain.handle(IPC.licensePortal, async (_evt, req: PortalReq) => openPortal(req));
  ipcMain.handle(IPC.licenseGetCached, async () => getCachedToken());
  ipcMain.handle(IPC.licenseVerifyLocal, async (_evt, token: string) => verifyLicenseToken(token));
};
