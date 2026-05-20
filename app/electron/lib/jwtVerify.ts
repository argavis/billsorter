// Offline-Validation des License-JWT mit eingebettetem Ed25519 Public-Key.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { importSPKI, jwtVerify } from 'jose';
import type { LicenseStatus } from '@shared/types';
import { logger } from './logger';

let cachedKey: CryptoKey | null = null;

const loadPublicKey = async (): Promise<CryptoKey> => {
  if (cachedKey) return cachedKey;
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'jwt-public-key.pem')]
    : [
        path.resolve(__dirname, '..', '..', 'resources', 'jwt-public-key.pem'),
        path.resolve(__dirname, '..', 'resources', 'jwt-public-key.pem'),
      ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const pem = fs.readFileSync(p, 'utf-8');
      cachedKey = (await importSPKI(pem, 'EdDSA')) as CryptoKey;
      return cachedKey;
    }
  }
  throw new Error('jwt-public-key.pem not found at any expected location');
};

export type VerifiedToken = {
  valid: boolean;
  reason?: string;
  claims?: {
    licenseId: string;
    status: LicenseStatus;
    plan: string;
    deviceIdHash: string;
    expiresAt: string;
    trialEndsAt?: string | null;
    graceDays: number;
    iat: number;
    exp: number;
  };
};

export const verifyLicenseToken = async (token: string): Promise<VerifiedToken> => {
  try {
    const key = await loadPublicKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: 'billsorter.de',
      audience: 'billsorter.app',
    });
    return {
      valid: true,
      claims: {
        licenseId: String(payload.licenseId),
        status: payload.status as LicenseStatus,
        plan: String(payload.plan),
        deviceIdHash: String(payload.deviceIdHash),
        expiresAt: String(payload.expiresAt),
        trialEndsAt: payload.trialEndsAt as string | null | undefined,
        graceDays: Number(payload.graceDays),
        iat: Number(payload.iat),
        exp: Number(payload.exp),
      },
    };
  } catch (e) {
    logger.warn('jwt verify failed:', e);
    return { valid: false, reason: (e as Error).message };
  }
};
