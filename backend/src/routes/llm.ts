// LLM-Proxy: Sidecar ruft uns, wir rufen Anthropic.
// Vorteil: User braucht keinen eigenen API-Key, wir kapseln Kosten + Limits zentral.
// Auth: deviceId → Lizenz-Check. Nur trial/active/grace bekommen Antworten.

import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { hashDeviceId } from '../lib/deviceHash';
import { db, findDevice, findLicenseById, logEvent } from '../lib/db';
import { refreshLicenseStatusInDb } from '../lib/license';
import { badRequest, json, notFound } from '../lib/responses';

const ClassifyBody = z.object({
  deviceId: z.string().min(8).max(256),
  subject: z.string().max(1024).optional().default(''),
  sender: z.string().max(512).optional().default(''),
  filename: z.string().max(512),
});

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';

export const llmRoutes = new Hono<{ Bindings: Bindings }>();

llmRoutes.post('/classify', async (c) => {
  const env = c.env;
  const body = await c.req.json().catch(() => null);
  const parsed = ClassifyBody.safeParse(body);
  if (!parsed.success) {
    return badRequest(c, 'invalid_body', parsed.error.issues[0]?.message ?? 'invalid body');
  }

  // 1) Lizenz validieren via deviceId
  const deviceIdHash = await hashDeviceId(parsed.data.deviceId, env.APP_DEVICE_SALT);
  const device = await findDevice(db(env), deviceIdHash);
  if (!device || !device.license_id) {
    return json(c, { error: { code: 'no_license_for_device' } }, 402);
  }
  const license = await findLicenseById(db(env), device.license_id);
  if (!license) return notFound(c, 'license_not_found');

  const status = await refreshLicenseStatusInDb(db(env), license);
  if (status === 'expired' || status === 'revoked') {
    return json(c, { error: { code: 'license_inactive', status } }, 402);
  }

  // 2) Anthropic-Aufruf
  const prompt =
    'Entscheide ob dieser E-Mail-Anhang eine Rechnung oder Quittung ist.\n' +
    `E-Mail Betreff: ${parsed.data.subject}\n` +
    `Absender: ${parsed.data.sender}\n` +
    `Dateiname: ${parsed.data.filename}\n\n` +
    'Antworte NUR mit: JA oder NEIN';

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      await logEvent(
        db(env),
        'llm.anthropic_error',
        { status: res.status, body: text.slice(0, 300) },
        { license_id: license.id, device_id_hash: deviceIdHash },
      );
      // Bei Anthropic-Fehler signalisieren wir "keine Aussage" — Sidecar fällt auf Keyword-Check zurück.
      return json(c, { is_invoice: false, method: 'fallback', reason: `anthropic_${res.status}` });
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const answer = (data.content?.[0]?.text ?? '').trim().toUpperCase();
    const isInvoice = answer.includes('JA');

    await logEvent(
      db(env),
      'llm.classified',
      { isInvoice, filenameLen: parsed.data.filename.length },
      { license_id: license.id, device_id_hash: deviceIdHash },
    );

    return json(c, { is_invoice: isInvoice, method: 'ai' });
  } catch (err) {
    await logEvent(
      db(env),
      'llm.fetch_error',
      { message: (err as Error).message },
      { license_id: license.id, device_id_hash: deviceIdHash },
    );
    return json(c, { is_invoice: false, method: 'fallback', reason: 'network_error' });
  }
});
