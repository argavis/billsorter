import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { hashDeviceId } from '../lib/deviceHash';
import { db, logEvent } from '../lib/db';
import { buildLicenseToken, ensureDeviceLicense, refreshLicenseStatusInDb } from '../lib/license';
import { badRequest, ok } from '../lib/responses';

const TrialStartBody = z.object({
  deviceId: z.string().min(8).max(256),
  appVersion: z.string().max(32).optional().default('0.0.0'),
  os: z.enum(['mac', 'windows', 'linux']).optional().default('mac'),
  locale: z.enum(['de', 'en']).optional().default('de'),
});

export const trialRoutes = new Hono<{ Bindings: Bindings }>();

trialRoutes.post('/start', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = TrialStartBody.safeParse(json);
  if (!parsed.success) {
    return badRequest(c, 'invalid_body', parsed.error.issues[0]?.message ?? 'invalid body');
  }
  const { deviceId, appVersion, os, locale } = parsed.data;
  const env = c.env;

  const deviceIdHash = await hashDeviceId(deviceId, env.APP_DEVICE_SALT);
  const trialDays = Number(env.TRIAL_DAYS ?? '7');

  const license = await ensureDeviceLicense(db(env), deviceIdHash, trialDays, {
    app_version: appVersion,
    os,
    locale,
  });

  const effectiveStatus = await refreshLicenseStatusInDb(db(env), license);
  const token = await buildLicenseToken(env, license, deviceIdHash, effectiveStatus);

  await logEvent(
    db(env),
    'trial_started_or_resumed',
    { os, locale, appVersion, effectiveStatus },
    { license_id: license.id, device_id_hash: deviceIdHash },
  );

  return ok(c, {
    status: effectiveStatus,
    expiresAt: license.expires_at,
    trialEndsAt: license.trial_ends_at,
    graceDays: Number(env.GRACE_DAYS ?? '7'),
    token,
  });
});
