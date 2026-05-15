/*
 * Slot definitions: keys, labels, and render geometry.
 *
 * Geometry is expressed as % of the outfit-canvas rectangle (which has a
 * fixed 4:5 aspect ratio). Both the DOM preview and the Canvas exporter
 * read from this single source of truth, so on-screen and exported
 * positions stay in lockstep.
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
  full_body: 'Платья',
  top: 'Верх',
  outerwear: 'Верхняя',
  shoes: 'Обувь',
  accessories: 'Аксессуары',
  other: 'Другое',
};

export const SLOT_LABEL_RU_PLURAL: Record<SlotKey, string> = {
  bottom: 'низы',
  full_body: 'платья',
  top: 'верха',
  outerwear: 'верхняя одежда',
  shoes: 'обувь',
  accessories: 'аксессуары',
  other: 'другое',
};

/**
 * Geometry of each slot in the outfit canvas. Origin is top-left.
 * The canvas itself is 4:5 (width:height) — these percentages are
 * within that rectangle.
 *
 * z-order (back → front): bottom → full_body → top → outerwear → accessories.
 * shoes sit in their own band at the bottom and don't overlap.
 * other is a freeform top layer above accessories.
 */
export type SlotRect = {
  x: number; // % from left
  y: number; // % from top
  w: number; // % width
  h: number; // % height
  z: number; // z-index basis (within-slot zPriority added)
};

export const SLOT_RECT: Record<SlotKey, SlotRect> = {
  bottom: { x: 18, y: 38, w: 64, h: 36, z: 10 },
  full_body: { x: 18, y: 10, w: 64, h: 64, z: 15 },
  top: { x: 16, y: 10, w: 68, h: 38, z: 20 },
  outerwear: { x: 8, y: 6, w: 84, h: 50, z: 30 },
  shoes: { x: 26, y: 76, w: 48, h: 18, z: 25 },
  accessories: { x: 60, y: 4, w: 36, h: 32, z: 40 },
  other: { x: 4, y: 56, w: 30, h: 30, z: 50 },
};

/**
 * The on-screen render order — items drawn back-to-front follow this list.
 * (CSS z-index handles this in the DOM renderer; Canvas drawImage calls
 * follow this array in order in the exporter.)
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

export const DEFAULT_SLOT_RANGES: Record<SlotKey, SlotRange> = {
  top: { min: 1, max: 2 },
  outerwear: { min: 0, max: 1 },
  bottom: { min: 0, max: 1 },
  full_body: { min: 0, max: 1 },
  shoes: { min: 1, max: 1 },
  accessories: { min: 0, max: 2 },
  other: { min: 0, max: 1 },
};
