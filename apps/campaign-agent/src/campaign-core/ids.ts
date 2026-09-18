import { randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function versionId(objectId: string, version: number): string {
  return `${objectId}:v${version}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** ISO time that never goes backwards relative to a previous stamp on the same object. */
export function nowIsoMonotonic(previousIso?: string): string {
  const now = Date.now();
  const previousMs = previousIso ? Date.parse(previousIso) : Number.NaN;
  const ms = Number.isFinite(previousMs) && previousMs >= now ? previousMs + 1 : now;
  return new Date(ms).toISOString();
}
