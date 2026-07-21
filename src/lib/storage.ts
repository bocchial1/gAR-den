import fs from "node:fs/promises";
import path from "node:path";

export function storageRoot(): string {
  return path.resolve(process.env.STORAGE_ROOT || "./storage");
}

export function storagePath(...parts: string[]): string {
  return path.join(storageRoot(), ...parts);
}

export async function ensureStorageDir(...parts: string[]): Promise<string> {
  const dir = storagePath(...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
