import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { hashDeviceId } from '../lib/deviceHash';
import { db, findDevice, findLicenseById } from '../lib/db';
import { getStripe } from '../lib/stripe';
import { badRequest, notFound, ok } from '../lib/responses';

export const portalRoutes = new Hono<{ Bindings: Bindings }>();

const PortalBody = z.object({
  deviceId: z.string().min(8).max(256),
});

portalRoutes.post('/', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = PortalBody.safeParse(json);
  if (!parsed.success) {
    return badRequest(c, 'invalid_body', parsed.error.issues[0]?.message ?? 'invalid body');
  }
  const env = c.env;
  const deviceIdHash = await hashDeviceId(parsed.data.deviceId, env.APP_DEVICE_SALT);
  const device = await findDevice(db(env), deviceIdHash);
  if (!device || !device.license_id) return notFound(c, 'no_license_for_device');
  const license = await findLicenseById(db(env), device.license_id);
  if (!license) return notFound(c, 'license_not_found');
  if (!license.provider_customer_id) {
    return badRequest(c, 'not_purchased', 'License has no Stripe customer yet');
  }

  const stripe = getStripe(env);
  const session = await stripe.billingPortal.sessions.create({
    customer: license.provider_customer_id,
    return_url: `${env.WEB_URL}/portal-return`,
  });

  return ok(c, { url: session.url });
});
