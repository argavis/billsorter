// Geteilte License-Lifecycle-Helfer — von Trial-Route + Webhook-Handlern genutzt.

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings, LicenseRow, LicenseStatus } from '../types';
import { signLicenseToken } from './jwt';
import {
  addDays,
  findDevice,
  findLicenseById,
  insertLicense,
  isPast,
  isRevoked,
  nowIso,
  touchDevice,
  updateLicenseStatus,
  upsertDevice,
  uuid,
} from './db';

export const computeStatus = async (
  db: D1Database,
  license: LicenseRow,
): Promise<LicenseStatus> => {
  if (await isRevoked(db, license.id)) return 'revoked';
  if (license.status === 'revoked') return 'revoked';

  const exp = license.expires_at;
  const grace = addDays(exp, 7);

  if (!isPast(exp)) {
    // Trial bleibt 'trial', sonst 'active'.
    return license.status === 'trial' ? 'trial' : 'active';
  }
  if (!isPast(grace)) return 'grace';
  return 'expired';
};

export const createTrialLicense = async (
  db: D1Database,
  trialDays: number,
): Promise<LicenseRow> => {
  const now = nowIso();
  const trialEnd = addDays(now, trialDays);
  const id = uuid();

  await insertLicense(db, {
    id,
    user_id: null,
    plan: 'monthly',
    status: 'trial',
    provider: null,
    provider_sub_id: null,
    provider_customer_id: null,
    trial_ends_at: trialEnd,
    expires_at: trialEnd,
  });

  const row = await findLicenseById(db, id);
  if (!row) throw new Error('License insert failed');
  return row;
};

export const ensureDeviceLicense = async (
  db: D1Database,
  deviceIdHash: string,
  trialDays: number,
  meta: { app_version: string | null; os: string | null; locale: string | null },
): Promise<LicenseRow> => {
  const existing = await findDevice(db, deviceIdHash);
  if (existing?.license_id) {
    const lic = await findLicenseById(db, existing.license_id);
    if (lic) {
      await touchDevice(db, deviceIdHash);
      return lic;
    }
  }

  // Neuer Trial.
  const license = await createTrialLicense(db, trialDays);
  await upsertDevice(db, {
    device_id_hash: deviceIdHash,
    license_id: license.id,
    app_version: meta.app_version,
    os: meta.os,
    locale: meta.locale,
  });
  return license;
};

export const refreshLicenseStatusInDb = async (
  db: D1Database,
  license: LicenseRow,
): Promise<LicenseStatus> => {
  const computed = await computeStatus(db, license);
  if (computed !== license.status) {
    await updateLicenseStatus(db, license.id, computed);
  }
  return computed;
};

export const buildLicenseToken = async (
  env: Bindings,
  license: LicenseRow,
  deviceIdHash: string,
  effectiveStatus: LicenseStatus,
): Promise<string | null> => {
  // Revoked/expired Lizenzen bekommen keinen Token.
  if (effectiveStatus === 'revoked' || effectiveStatus === 'expired') return null;

  return signLicenseToken(env, {
    licenseId: license.id,
    status: effectiveStatus,
    plan: license.plan,
    deviceIdHash,
    expiresAt: license.expires_at,
    trialEndsAt: license.trial_ends_at,
    graceDays: Number(env.GRACE_DAYS ?? '7'),
  });
};
