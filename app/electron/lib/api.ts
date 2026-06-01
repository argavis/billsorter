// HTTP-Client für das Lizenz-Backend.
// Default-URL kommt aus env (BILLSORTER_API_URL) für Dev-Override.

import { logger } from './logger';

const DEFAULT_API_URL = 'https://api.billsorter.app';

export const apiBaseUrl = (): string =>
  process.env.BILLSORTER_API_URL ?? DEFAULT_API_URL;

export type ApiError = {
  status: number;
  code: string;
  message: string;
};

export const apiFetch = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> => {
  const url = apiBaseUrl() + path;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const json = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
      return {
        ok: false,
        error: {
          status: res.status,
          code: err?.code ?? `http_${res.status}`,
          message: err?.message ?? `HTTP ${res.status}`,
        },
      };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    logger.warn(`apiFetch ${path} failed:`, e);
    return {
      ok: false,
      error: {
        status: 0,
        code: 'network_error',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
