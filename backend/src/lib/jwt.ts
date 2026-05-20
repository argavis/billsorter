// Ed25519 JWT — signed im Worker, verifiziert offline im Electron-Client.
// Client embedded `JWT_PUBLIC_KEY_PEM` und nutzt jose o.ä. zum Verify.

import { SignJWT, importPKCS8, importSPKI, type JWTPayload } from 'jose';
import type { Bindings, LicenseStatus } from '../types';

export type LicenseTokenClaims = {
  licenseId: string;
  status: LicenseStatus;
  plan: string;
  deviceIdHash: string;
  expiresAt: string;
  trialEndsAt?: string | null;
  graceDays: number;
};

const ALG = 'EdDSA';
const ISSUER = 'billsorter.de';
const AUDIENCE = 'billsorter.app';

let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicKey: CryptoKey | null = null;

const normalizePem = (pem: string): string =>
  // .dev.vars escapes Newlines as \n — wieder in echte Newlines wandeln.
  pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;

const getPrivateKey = async (env: Bindings): Promise<CryptoKey> => {
  if (cachedPrivateKey) return cachedPrivateKey;
  cachedPrivateKey = (await importPKCS8(normalizePem(env.JWT_PRIVATE_KEY_PEM), ALG)) as CryptoKey;
  return cachedPrivateKey;
};

export const getPublicKey = async (env: Bindings): Promise<CryptoKey> => {
  if (cachedPublicKey) return cachedPublicKey;
  cachedPublicKey = (await importSPKI(normalizePem(env.JWT_PUBLIC_KEY_PEM), ALG)) as CryptoKey;
  return cachedPublicKey;
};

export const signLicenseToken = async (
  env: Bindings,
  claims: LicenseTokenClaims,
): Promise<string> => {
  const key = await getPrivateKey(env);

  const expSec = Math.floor(new Date(claims.expiresAt).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);

  // exp = expiresAt + graceDays (Client darf graceDays nach exp noch akzeptieren)
  const tokenExp = expSec + claims.graceDays * 86400;

  const payload: JWTPayload & LicenseTokenClaims = {
    ...claims,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.deviceIdHash)
    .setIssuedAt(nowSec)
    .setExpirationTime(tokenExp)
    .sign(key);
};
