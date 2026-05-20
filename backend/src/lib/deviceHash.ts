// HMAC-SHA256(APP_DEVICE_SALT, rawDeviceId) → hex.
// Wir speichern nur den Hash. Der raw deviceId verlässt das Client-Device als String,
// aber wir persistieren ihn nicht im Klartext.

const enc = new TextEncoder();

export const hashDeviceId = async (rawDeviceId: string, salt: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawDeviceId));
  return bufToHex(sig);
};

export const hashEmail = async (email: string): Promise<string> => {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(normalized));
  return bufToHex(digest);
};

const bufToHex = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
};
