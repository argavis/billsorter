import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import {
  db,
  findLicenseById,
  logEvent,
  revokeLicense,
  updateLicenseStatus,
} from '../lib/db';
import { badRequest, notFound, ok, unauthorized } from '../lib/responses';

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

// Bearer-Token-Middleware
adminRoutes.use('*', async (c, next) => {
  const auth = c.req.header('authorization') ?? '';
  const expected = `Bearer ${c.env.ADMIN_TOKEN}`;
  if (auth !== expected) return unauthorized(c, 'admin_token_invalid');
  await next();
});

const RevokeBody = z.object({
  licenseId: z.string().uuid(),
  reason: z.string().min(3).max(256),
});

adminRoutes.post('/revoke', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = RevokeBody.safeParse(json);
  if (!parsed.success) {
    return badRequest(c, 'invalid_body', parsed.error.issues[0]?.message ?? 'invalid body');
  }
  const env = c.env;
  const license = await findLicenseById(db(env), parsed.data.licenseId);
  if (!license) return notFound(c, 'license_not_found');

  await revokeLicense(db(env), license.id, parsed.data.reason);
  await updateLicenseStatus(db(env), license.id, 'revoked');
  await logEvent(
    db(env),
    'admin.revoke',
    { reason: parsed.data.reason },
    { license_id: license.id },
  );
  return ok(c, { revoked: license.id });
});

adminRoutes.get('/stats', async (c) => {
  const env = c.env;
  const counts = await db(env)
    .prepare(
      `SELECT status, COUNT(*) as count
         FROM licenses
        GROUP BY status`,
    )
    .all<{ status: string; count: number }>();

  const recentEvents = await db(env)
    .prepare(
      `SELECT type, COUNT(*) as count
         FROM events
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY type
        ORDER BY count DESC
        LIMIT 20`,
    )
    .all<{ type: string; count: number }>();

  return ok(c, {
    licensesByStatus: counts.results,
    events7d: recentEvents.results,
  });
});
