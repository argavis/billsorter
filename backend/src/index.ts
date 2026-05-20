import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Bindings } from './types';
import { trialRoutes } from './routes/trial';
import { licenseRoutes } from './routes/license';
import { checkoutRoutes } from './routes/checkout';
import { portalRoutes } from './routes/portal';
import { webhookRoutes } from './routes/webhooks';
import { adminRoutes } from './routes/admin';
import { llmRoutes } from './routes/llm';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use('*', secureHeaders());

// CORS: erlauben File://-Origins von Electron, Localhost-Dev, und Marketing-Domain.
// Webhooks bekommen kein CORS (server-to-server, kein Origin).
app.use('/v1/*', (c, next) => {
  const handler = cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (
        origin === 'null' ||
        origin.startsWith('file://') ||
        origin.startsWith('app://') ||
        origin.startsWith('billsorter://') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin === c.env.WEB_URL
      ) {
        return origin;
      }
      return null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization'],
    maxAge: 600,
  });
  return handler(c, next);
});

// Health.
app.get('/', (c) => c.json({ name: 'billsorter-api', status: 'ok', env: c.env.ENVIRONMENT }));
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Mounts.
app.route('/v1/trial', trialRoutes);
app.route('/v1/license', licenseRoutes);
app.route('/v1/checkout', checkoutRoutes);
app.route('/v1/portal', portalRoutes);
app.route('/v1/llm', llmRoutes);
app.route('/v1/admin', adminRoutes);
app.route('/webhooks', webhookRoutes);

// 404 + Errors.
app.notFound((c) => c.json({ error: { code: 'not_found', path: c.req.path } }, 404));
app.onError((err, c) => {
  console.error('unhandled', err);
  return c.json({ error: { code: 'internal', message: 'Internal error' } }, 500);
});

export default app;
