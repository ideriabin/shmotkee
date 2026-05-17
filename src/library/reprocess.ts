/*
 * Re-process every item in the library: re-trim, regenerate thumbnail,
 * save back. Yields progress as an async generator so the UI can show
 * a progress bar without coupling to the work loop.
 *
 * Idempotent: trimming an already-tight image returns the original Blob
 * reference (see trim.ts), so we skip the DB write in that case. A user
 * can re-run safely after small additions; only changed items pay the
 * decode/encode cost.
 */

import { db } from '../db/schema';
import { trimTransparent, type TrimOptions } from './trim';
import { generateThumbnail } from './thumbnail';

export type ReprocessProgress = {
  done: number;
  total: number;
  failed: number;
  changed: number;
  lastName?: string;
};

export async function* reprocessAllItems(
  trimOpts?: TrimOptions,
): AsyncGenerator<ReprocessProgress> {
  const all = await db.items.toArray();
  let done = 0;
  let failed = 0;
  let changed = 0;
  yield { done, total: all.length, failed, changed };

  for (const item of all) {
    try {
      const trimmed = await trimTransparent(item.blob, trimOpts);
      if (trimmed !== item.blob) {
        const thumb = await generateThumbnail(trimmed);
        await db.items.update(item.id, { blob: trimmed, thumbnail: thumb });
        changed++;
      }
    } catch (e) {
      failed++;
      console.error('reprocess failed for', item.name, e);
    } finally {
      done++;
      yield { done, total: all.length, failed, changed, lastName: item.name };
    }
  }
}
