// Stabile Geräte-ID. Wir geben sie roh an den Renderer, der Backend-Call hashed mit dem
// gleichen Salt wie der Worker — Hash entsteht serverseitig.
//
// `node-machine-id` ist plattformübergreifend stabil; auf Mac liest es das IOPlatformUUID,
// auf Win die MachineGuid aus der Registry.

import machineId from 'node-machine-id';
import { logger } from './logger';

const { machineIdSync } = machineId;

let cached: string | null = null;

export const getRawDeviceId = (): string => {
  if (cached) return cached;
  try {
    cached = machineIdSync(true);
  } catch (err) {
    logger.error('machineIdSync failed, falling back to random per-install id', err);
    cached = `fallback-${Math.random().toString(36).slice(2)}`;
  }
  return cached;
};
