import type { Context } from 'hono';

export const json = <T>(c: Context, body: T, status = 200) => c.json(body, status as 200);

export const ok = <T>(c: Context, body: T) => json(c, body, 200);

export const created = <T>(c: Context, body: T) => json(c, body, 201);

export const badRequest = (c: Context, code: string, message: string) =>
  json(c, { error: { code, message } }, 400);

export const unauthorized = (c: Context, message = 'Unauthorized') =>
  json(c, { error: { code: 'unauthorized', message } }, 401);

export const notFound = (c: Context, message = 'Not found') =>
  json(c, { error: { code: 'not_found', message } }, 404);

export const conflict = (c: Context, code: string, message: string) =>
  json(c, { error: { code, message } }, 409);

export const serverError = (c: Context, message = 'Internal server error') =>
  json(c, { error: { code: 'internal', message } }, 500);
