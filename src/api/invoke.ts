/**
 * The only module that calls Tauri's `invoke`. Errors come back as `AppError` with the stable code
 * the Rust side chose (`duplicate_part_code`, `not_found`, ...), which the UI translates.
 */
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e && typeof e === 'object' && 'code' in e) {
    const o = e as { code: unknown; detail?: unknown };
    return new AppError(String(o.code), String(o.detail ?? ''));
  }
  return new AppError('internal', e instanceof Error ? e.message : String(e));
}

/** A shared command: the argument struct travels as `{ args }`. */
export async function call<T>(cmd: string, args: object = {}): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, { args });
  } catch (e) {
    throw toAppError(e);
  }
}

/** A desktop command with its own named arguments. */
export async function callDesktop<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e);
  }
}

/** Sends bytes as the request body (no JSON encoding). */
export async function callWithBody<T>(cmd: string, body: Uint8Array, headers: Record<string, string>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, body, { headers });
  } catch (e) {
    throw toAppError(e);
  }
}

/** Reads a raw binary response (images, schematics). */
export async function callBytes(cmd: string, args: Record<string, unknown>): Promise<Uint8Array> {
  try {
    const out = await tauriInvoke<ArrayBuffer | number[]>(cmd, args);
    return out instanceof ArrayBuffer ? new Uint8Array(out) : Uint8Array.from(out);
  } catch (e) {
    throw toAppError(e);
  }
}
