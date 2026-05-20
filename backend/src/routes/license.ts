import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { hashDeviceId } from '../lib/deviceHash';
import {
  db,
  findDevice,
  findLicenseById,
  logEvent,
  touchDevice,
} from '../lib/db';
import { buildLicenseToken, refreshLicenseStatusInDb } from '../lib/license';
import { badRequest, notFound, ok } from '../lib/responses';

const CheckBody = z.object({
  deviceId: z.string().min(8).max(256),
  appVersion: z.string().max(32).optional(),
});

export const licenseRoutes = new Hono<{ Bindings: Bindings }>();

licenseRoutes.post('/check', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = CheckBody.safeParse(json);
  if (!parsed.success) {
    return badRequest(c, 'invalid_body', parsed.error.issues[0]?.message ?? 'invalid body');
  }
  const env = c.env;

  const deviceIdHash = await hashDeviceId(parsed.data.deviceId, env.APP_DEVICE_SALT);
  const device = await findDevice(db(env), deviceIdHash);
  if (!device || !device.license_id) {
    return notFound(c, 'no_license_for_device');
  }

  const license = await findLicenseById(db(env), device.license_id);
  if (!license) {
    return notFound(c, 'license_not_found');
  }

  const effectiveStatus = await refreshLicenseStatusInDb(db(env), license);
  await touchDevice(db(env), deviceIdHash);
  const token = await buildLicenseToken(env, license, deviceIdHash, effectiveStatus);

  await logEvent(
    db(env),
    'license_checked',
    { effectiveStatus, appVersion: parsed.data.appVersion },
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
