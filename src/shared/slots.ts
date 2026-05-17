/*
 * Slot definitions: keys, labels, and outfit-composition metadata.
 *
 * Outfit render uses a flat-lay band layout (see preview.svelte) — no
 * per-slot geometry needed here. SLOT_RENDER_ORDER survives because the
 * generator's dedupe key (and the exporter's caption) iterate slots in
 * a canonical order.
 */

export const SLOT_KEYS = [
  'bottom',
  'full_body',
  'top',
  'outerwear',
  'shoes',
  'accessories',
  'other',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

export const SLOT_LABEL_RU: Record<SlotKey, string> = {
  bottom: 'Низ',
  full_body: 'Платья и комбинезоны',
  top: 'Верх',
  outerwear: 'Верхняя',
  shoes: 'Обувь',
  accessories: 'Аксессуары',
  other: 'Другое',
};

export const SLOT_LABEL_RU_PLURAL: Record<SlotKey, string> = {
  bottom: 'низы',
  full_body: 'платья и комбинезоны',
  top: 'верха',
  outerwear: 'верхняя одежда',
  shoes: 'обувь',
  accessories: 'аксессуары',
  other: 'другое',
};

/**
 * Canonical iteration order used by the generator's dedupe key and the
 * exporter's caption block. Render order in the DOM and canvas is driven
 * by band assignment in preview.svelte / canvas-renderer.ts, not by this.
 */
export const SLOT_RENDER_ORDER: SlotKey[] = [
  'bottom',
  'full_body',
  'top',
  'outerwear',
  'shoes',
  'accessories',
  'other',
];

export type SlotRange = { min: number; max: number };

/**
 * Each slot's range is sampled independently. There is no XOR between
 * top/bottom and full_body — overlap is sometimes legitimate (slip dress
 * under sweater + pants, bodysuit + skirt + top). Users who want
 * exclusivity can dial individual mins/maxes to taste.
 */
export const DEFAULT_SLOT_RANGES: Record<SlotKey, SlotRange> = {
  top: { min: 1, max: 2 },
  outerwear: { min: 0, max: 1 },
  bottom: { min: 0, max: 1 },
  full_body: { min: 0, max: 1 },
  shoes: { min: 1, max: 1 },
  accessories: { min: 0, max: 2 },
  other: { min: 0, max: 1 },
};
