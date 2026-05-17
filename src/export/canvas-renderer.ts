/*
 * Render an outfit combination to a 1080×1350 PNG Blob.
 *
 * Layout mirrors preview.svelte exactly: three horizontal bands
 * (upper / middle / lower) at flex ratios 4 / 3 / 2.5. Items inside
 * a band sit side-by-side, evenly distributed, no overlap. The
 * caption zone below lists each used slot's items by name.
 */

import { SLOT_RENDER_ORDER, SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
import type { Combination, Item } from '../shared/types';

const OUT_W = 1080;
const OUT_H = 1350;
const OUTFIT_H = 1080;
const CAPTION_H = OUT_H - OUTFIT_H; // 270

const BG = '#171012';
const CAPTION_BG = '#0F0A0C';
const CAPTION_TEXT = '#E6E1E2';
const CAPTION_MUTED = '#7E7378';
const ITEM_SHADOW = 'rgba(0, 0, 0, 0.45)';

const UPPER_SLOTS: SlotKey[] = ['top', 'outerwear', 'full_body'];
const MIDDLE_SLOTS: SlotKey[] = ['bottom'];
const LOWER_SLOTS: SlotKey[] = ['shoes', 'accessories', 'other'];

const UPPER_FLEX = 4;
const MIDDLE_FLEX = 3;
const LOWER_FLEX = 2.5;

const PADDING_PCT = 0.04;
const BAND_GAP_PCT = 0.02;
const CELL_GAP_PCT = 0.03;

export async function renderOutfitToPng(combo: Combination): Promise<Blob> {
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

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, OUT_W, OUT_H);

  await drawBands(ctx, combo);
  drawCaption(ctx, combo);

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

async function drawBands(ctx: CanvasRenderingContext2D, combo: Combination): Promise<void> {
  const upper = gather(UPPER_SLOTS, combo);
  const middle = gather(MIDDLE_SLOTS, combo);
  const lower = gather(LOWER_SLOTS, combo);

  const bands: { items: Item[]; flex: number }[] = [];
  if (upper.length > 0) bands.push({ items: upper, flex: UPPER_FLEX });
  if (middle.length > 0) bands.push({ items: middle, flex: MIDDLE_FLEX });
  if (lower.length > 0) bands.push({ items: lower, flex: LOWER_FLEX });

  if (bands.length === 0) return;

  const padX = OUT_W * PADDING_PCT;
  const padY = OUTFIT_H * PADDING_PCT;
  const bandGap = OUTFIT_H * BAND_GAP_PCT;
  const totalGap = bandGap * (bands.length - 1);
  const availableH = OUTFIT_H - padY * 2 - totalGap;
  const availableW = OUT_W - padX * 2;
  const totalFlex = bands.reduce((s, b) => s + b.flex, 0);

  let y = padY;
  for (const band of bands) {
    const bandH = (band.flex / totalFlex) * availableH;
    await drawBand(ctx, band.items, padX, y, availableW, bandH);
    y += bandH + bandGap;
  }
}

async function drawBand(
  ctx: CanvasRenderingContext2D,
  items: Item[],
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  const cellGap = w * CELL_GAP_PCT;
  const totalGap = cellGap * (items.length - 1);
  const cellW = (w - totalGap) / items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const cellX = x + i * (cellW + cellGap);
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(item.blob);
      const fitted = fitContain(bitmap.width, bitmap.height, cellW, h);
      const dx = cellX + (cellW - fitted.w) / 2;
      const dy = y + (h - fitted.h) / 2;
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

function drawCaption(ctx: CanvasRenderingContext2D, combo: Combination): void {
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
}

function gather(slots: SlotKey[], combo: Combination): Item[] {
  const out: Item[] = [];
  for (const slot of slots) {
    const items = combo.bySlot[slot] ?? [];
    out.push(...items);
  }
  return out;
}

function fitContain(srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    return { w: dstW, h: dstW / srcRatio };
  }
  return { w: dstH * srcRatio, h: dstH };
}
