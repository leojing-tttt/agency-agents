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
