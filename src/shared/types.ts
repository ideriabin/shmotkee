import type { SlotKey, SlotRange } from './slots';

export type Item = {
  id: string;
  name: string;
  slot: SlotKey;
  zPriority: number;
  blob: Blob;
  thumbnail: Blob;
  createdAt: number;
};

export type Session = {
  id: string;
  name: string;
  slotRanges: Record<SlotKey, SlotRange>;
  createdAt: number;
  updatedAt: number;
};

export type SavedOutfit = {
  id: string;
  sessionId: string;
  itemIds: string[];
  createdAt: number;
};

export type Combination = {
  bySlot: Record<SlotKey, Item[]>;
  key: string;
};
