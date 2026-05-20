#!/usr/bin/env node
// Erzeugt ein Ed25519-Keypair für JWT-Signierung.
// Ausgabe: PKCS8-PEM (privat) + SPKI-PEM (public), gefolgt von Wrangler-Secret-Befehlen.
//
//   node ./scripts/generate-keys.mjs

import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const privPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const pubPem = publicKey.export({ format: 'pem', type: 'spki' });

const escape = (pem) => pem.replace(/\n/g, '\\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Ed25519 Keypair erzeugt.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('▶ Private Key (PKCS8 PEM) — NICHT committen, nur in Workers-Secret:');
console.log(privPem);

console.log('▶ Public Key (SPKI PEM) — wird im Electron-Client embedded:');
console.log(pubPem);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Setup-Befehle für Cloudflare Workers:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('# Dev (lokal, in .dev.vars):');
console.log(`JWT_PRIVATE_KEY_PEM="${escape(privPem)}"`);
console.log(`JWT_PUBLIC_KEY_PEM="${escape(pubPem)}"\n`);

console.log('# Production (Workers Secrets):');
console.log(`echo '${escape(privPem)}' | wrangler secret put JWT_PRIVATE_KEY_PEM --env production`);
console.log(`echo '${escape(pubPem)}' | wrangler secret put JWT_PUBLIC_KEY_PEM --env production\n`);

console.log('# Public Key später ins App-Repo kopieren (z.B. app/electron/lib/jwt-public-key.pem)');
