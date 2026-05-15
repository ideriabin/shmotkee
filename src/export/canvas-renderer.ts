/*
 * Render an outfit combination to a 1080×1350 PNG Blob.
 *
 * Layout: outfit zone 1080×1080 (slot rects mirror SLOT_RECT exactly so
 * on-screen and export geometries match), caption zone 1080×270 with a
 * one-line-per-slot listing of item names.
 */

import { SLOT_RECT, SLOT_RENDER_ORDER, SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
import type { Combination } from '../shared/types';

const OUT_W = 1080;
const OUT_H = 1350;
const OUTFIT_H = 1080;
const CAPTION_H = OUT_H - OUTFIT_H; // 270

const BG = '#171012';
const CAPTION_BG = '#0F0A0C';
const CAPTION_TEXT = '#E6E1E2';
const CAPTION_MUTED = '#7E7378';
const ITEM_SHADOW = 'rgba(0, 0, 0, 0.45)';

export async function renderOutfitToPng(combo: Combination): Promise<Blob> {
  // Make sure Onest is loaded before the canvas renders captions —
  // canvas.fillText silently falls back to a generic sans if the font
  // hasn't arrived yet.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? (new OffscreenCanvas(OUT_W, OUT_H) as unknown as HTMLCanvasElement)
      : (() => {
          const c = document.createElement('canvas');
          c.width = OUT_W;
          c.height = OUT_H;
          return c;
        })();

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, OUT_W, OUT_H);

  // Outfit zone — slots back-to-front, items sorted by zPriority within each slot.
  // We compute slot rects in canvas pixels by mapping percentages onto OUT_W × OUTFIT_H.
  for (const slot of SLOT_RENDER_ORDER) {
    const items = combo.bySlot[slot as SlotKey] ?? [];
    if (items.length === 0) continue;
    const rect = SLOT_RECT[slot as SlotKey];
    const sx = (rect.x / 100) * OUT_W;
    const sy = (rect.y / 100) * OUTFIT_H;
    const sw = (rect.w / 100) * OUT_W;
    const sh = (rect.h / 100) * OUTFIT_H;

    for (const item of items) {
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(item.blob);
        const fitted = fitContain(bitmap.width, bitmap.height, sw, sh);
        const dx = sx + (sw - fitted.w) / 2;
        const dy = sy + (sh - fitted.h) / 2;
        ctx.save();
        ctx.shadowColor = ITEM_SHADOW;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(bitmap, dx, dy, fitted.w, fitted.h);
        ctx.restore();
      } finally {
        bitmap?.close();
      }
    }
  }

  // Caption zone
  ctx.fillStyle = CAPTION_BG;
  ctx.fillRect(0, OUTFIT_H, OUT_W, CAPTION_H);

  const padX = 64;
  const padTop = OUTFIT_H + 40;
  const lineH = 32;
  let y = padTop;

  ctx.textBaseline = 'top';

  for (const slot of SLOT_RENDER_ORDER) {
    const items = combo.bySlot[slot as SlotKey] ?? [];
    if (items.length === 0) continue;
    const label = SLOT_LABEL_RU[slot as SlotKey] + ':';
    const names = items.map((i) => i.name).join(' · ');

    ctx.font = '500 18px Onest, system-ui, sans-serif';
    ctx.fillStyle = CAPTION_MUTED;
    ctx.fillText(label, padX, y);

    ctx.font = '400 20px Onest, system-ui, sans-serif';
    ctx.fillStyle = CAPTION_TEXT;
    const labelWidth = ctx.measureText(label).width;
    ctx.fillText(names, padX + labelWidth + 12, y, OUT_W - padX * 2 - labelWidth - 12);

    y += lineH;
    if (y > OUT_H - 40) break;
  }

  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return await (canvas as unknown as OffscreenCanvas).convertToBlob({ type: 'image/png' });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
}

function fitContain(srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    return { w: dstW, h: dstW / srcRatio };
  }
  return { w: dstH * srcRatio, h: dstH };
}
