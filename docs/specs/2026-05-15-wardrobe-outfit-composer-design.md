# Wardrobe Outfit Composer — Design Spec

**Date:** 2026-05-15
**Status:** Design approved, pending spec review

## Overview

A local-only, mobile-first web app for composing outfits from a personal wardrobe library. The user uploads photos of her clothes (categorized by slot), then generates combinations by locking 0+ items and letting a constraint solver fill the rest. Outfits she likes are saved into named sessions and exported as rendered flat-lay images with item captions for use in Canva.

All data lives in the browser (IndexedDB). No server, no auth, no upload.

## Users & primary flow

**Primary user:** one person (the author's wife). Russian-language UI. Mostly Chrome on iPhone/iPad/desktop. Installed as a PWA via Add-to-Home-Screen on touch devices.

**Data lifecycle:**

- **Library (items)** is durable — she'll grow it over months, photo by photo.
- **Sessions and saved outfits are ephemeral** — she creates a session, generates options, saves the ones she likes, exports them, then deletes the session. A session is working memory, not a record. The spec optimises persistence for the library; sessions can be lossy.

**Primary flow:**

1. Open the app. First-time: empty library. Returning: library populated.
2. Upload photos — either single, multi-select, or a whole folder (desktop) — into a chosen slot.
3. Open Compose. Configure per-slot sample ranges if needed (defaults sensible).
4. Lock 0+ items as constraints (e.g., "this pair of jeans, must include").
5. Tap "Generate" → grid of 30 sampled outfit thumbnails.
6. Tap a tile → Tinder view, full-screen single outfit. Swipe or tap `хуйня` / `заебись`.
7. `заебись` saves into the current session; `хуйня` advances. Stream auto-extends.
8. Return to grid at any point, change constraints, generate again.
9. Open Sessions → review saved outfits → export selection as PNG images with captions.

## Out of scope (v1)

- Multi-user / cloud sync
- Camera capture in-app (she'll photograph and AirDrop in)
- AI tagging, color analysis, style suggestions
- Background removal (relies on her uploading transparent PNGs)
- Outfit history analytics ("you wore this 3 times this month")
- Sharing outfits via link
- Cross-slot items (one item assigned to multiple slots)

## Domain model

### Slots

Fixed layout positions, render order back-to-front:

| Slot           | Render zone                            |
| -------------- | -------------------------------------- |
| `bottom`       | низ — hips/legs band                   |
| `full_body`    | платья — torso through hips            |
| `top`          | верх — torso, over bottom and full_body |
| `outerwear`    | верхняя — over top, top-right anchored |
| `shoes`        | обувь — bottom band                    |
| `accessories`  | аксессуары — floating positions        |
| `other`        | другое — freeform overlay              |

Russian labels in UI; English keys in code.

### Item

```ts
type Item = {
  id: string;                  // uuid
  name: string;                // editable, defaults to filename stem
  slot: SlotKey;               // assigned at upload
  zPriority: number;           // within-slot stacking, integer, lower = behind
  blob: Blob;                  // raw image bytes (any format browser can decode)
  thumbnail: Blob;             // 320px max-side downscaled, generated at import
  createdAt: number;           // ms epoch
};
```

The thumbnail is generated once at import time via offscreen canvas to keep the library grid fast. The full blob is only loaded when rendering a preview or export.

### Session

```ts
type Session = {
  id: string;
  name: string;                // user-named
  slotRanges: Record<SlotKey, {min: number; max: number}>;  // per-session config
  createdAt: number;
  updatedAt: number;
};
```

Default `slotRanges`:

- `top`: 1–2
- `outerwear`: 0–1
- `bottom`: 0–1
- `full_body`: 0–1
- `shoes`: 1
- `accessories`: 0–2
- `other`: 0–1

A session is "active" while she's composing. She can switch active session at any time.

### SavedOutfit

```ts
type SavedOutfit = {
  id: string;
  sessionId: string;
  itemIds: string[];           // sorted by (slot order, zPriority) for stable dedupe
  createdAt: number;
};
```

Outfits reference items by id, not value. See [Item deletion](#item-deletion) for how cascading works.

## Generation engine

A pure function (no DOM, no I/O) that takes:

```ts
generate(opts: {
  library: Item[];
  locked: Item[];              // user-fixed items, counted toward slot capacity
  slotRanges: SessionSlotRanges;
  seenOutfitKeys: Set<string>; // for session-scoped dedupe
}): Generator<Combination>
```

It lazily yields unique `Combination` objects on demand. When the seen-set covers all reachable combinations under current constraints, it returns (consumer sees `done: true`).

A `Combination` is:

```ts
type Combination = {
  bySlot: Record<SlotKey, Item[]>;  // items per slot, sorted by zPriority
  key: string;                      // canonical hash for dedupe
};
```

**Algorithm:**

1. Group library items by slot.
2. For each slot, compute the effective sample range:
   - `effectiveMin = max(0, min - lockedCount)`
   - `effectiveMax = min(max - lockedCount, unlockedInSlot.length)` (clamp to available pool)
   - If `effectiveMax < effectiveMin`, slot uses locked items only (skip sampling).
   - Otherwise sample `n` uniformly from `[effectiveMin, effectiveMax]` items from `unlockedInSlot`.
3. Combine locked + sampled per slot, sort by `zPriority`.
4. Compute `key` = sorted item-id list joined by `:`.
5. If `key ∈ seenOutfitKeys`, retry up to N times (e.g., N=20). If all retries collide, the generator returns done — caller can prompt user to widen ranges or reset.
6. Yield.

The generator is a JS `function*` — lazy, no precomputation. Grid mode pulls 30; Tinder mode pulls 1 at a time. Same instance per "Generate" click.

**Why a generator:** lets both Grid and Tinder consume from the same lazy stream. State (seen set) lives outside, in the session. Pulling more = scrolling, swiping, or hitting "30 more."

## UI architecture

Three top-level tabs, bottom-nav on mobile, side-nav on desktop:

### Tab 1 — Library

- Header: slot filter chips (все / верх / низ / ...).
- Grid: 3-column on mobile, 5-col tablet, 8-col desktop. Each tile = thumbnail + name truncated.
- Tap tile → item detail sheet: rename, change slot, set `zPriority` (numeric stepper), delete.
- Floating action button: "+ Добавить".
  - On desktop: two options — "Файлы" or "Папка" (folder triggers `webkitdirectory`).
  - On iOS: one option — multi-file picker.
- After picking files: a "destination slot" sheet appears once; all files in the batch are imported into that slot. (Mixed-slot batches need separate uploads — keeps the UX one-tap.)

### Tab 2 — Compose

Header: current session indicator (tap to switch / rename / create new).

**Constraints strip** (top, horizontally scrollable): "+ Закрепить" button + tiles for each locked item. Tap a locked item to remove.

**Slot ranges control** (collapsible accordion): seven rows, each with min/max steppers. Defaults preloaded; user adjusts per session.

**Action**: large "Сгенерировать" button → fills the grid below.

**Results grid**: 3-column on mobile, 4-col tablet, 6-col desktop. Each tile is a mini composed preview (rendered live, see [Preview rendering](#preview-rendering)). Tap → opens Tinder view.

**"Ещё 30"** button at bottom pulls more from the generator.

### Tab 2b — Tinder view (modal over Compose)

Full-screen single-outfit preview, large.

- Bottom bar: two big buttons, `хуйня` (left, neutral) and `заебись` (right, accent). Tap or swipe.
- Top bar: close (X), current position indicator (e.g., "12 / unlimited"), back button (revisit the previous outfit).
- Swipe gestures: left = хуйня, right = заебись. Tactile feedback (scale + transform on drag).
- After action, fades out and slides to next outfit from the same stream.
- `заебись` immediately writes to `savedOutfits` table.

### Tab 3 — Sessions

- List of sessions (newest first). Each row: name, outfit count, last updated.
- Tap a session → session detail.

**Session detail:**

- Scrollable list of saved outfits (each = rendered preview + caption).
- Per-outfit: remove (✕ icon).
- Bottom action bar: "Экспорт всех" (zip), or multi-select for partial export.
- Rename / delete session via menu.

**Post-export prompt:** after a successful bulk export, show a modal: *"Готово! Удалить сессию?"* with `Удалить` (primary) and `Оставить` (secondary). Defaults to deletion since sessions are throwaway. Reinforces the lifecycle in the UI.

## Preview rendering

Outfit previews are needed in three places:
1. Compose results grid (small, ~150px wide)
2. Tinder view (large, full-screen)
3. Saved-outfits list (medium, ~300px wide)

All three use the same DOM-based renderer:

```html
<div class="outfit-canvas" style="aspect-ratio: 4/5">
  <div class="slot slot-bottom"   style="...">{items as <img>}</div>
  <div class="slot slot-full_body" ...>...</div>
  <div class="slot slot-top"       ...>...</div>
  <div class="slot slot-outerwear" ...>...</div>
  <div class="slot slot-shoes"     ...>...</div>
  <div class="slot slot-accessories" ...>...</div>
</div>
```

- Each slot is absolutely positioned within the outfit-canvas with a fixed % rectangle.
- Each `<img>` within a slot uses `object-fit: contain` and its z-index from `zPriority`.
- Slots themselves are z-ordered: `bottom < full_body < top < outerwear < accessories`. (Shoes get their own band at the bottom of the frame, not overlapping top.)
- The `outfit-canvas` scales fluidly — `width: 100%`, `aspect-ratio: 4/5`.

The DOM renderer is purely declarative — same component, different sizes.

## Export rendering

Export uses a separate Canvas 2D renderer that takes a `Combination` and outputs a `Blob`.

**Output format:** PNG, 1080×1350 (4:5 portrait). Two zones:

- **Outfit zone:** top 1080×1080 square. Slot bounding boxes match the DOM preview's percentages, so on-screen and exported geometries are identical.
- **Caption zone:** bottom 1080×270. White background, simple text rendering per slot:

```
Верх: white-tee · grey-cardigan
Низ: dark-jeans
Обувь: white-sneakers
Аксессуары: silver-watch
```

Slot label is the Russian name. Items in a slot are joined by ` · `. Empty slots are omitted.

**Renderer module:**

```ts
async function renderOutfit(combo: Combination): Promise<Blob>
```

For each item, loads its full blob (not thumbnail), decodes via `createImageBitmap`, computes `contain` math for the slot rect, calls `ctx.drawImage`. Caption rendered with `ctx.fillText` after measuring with `ctx.measureText` and wrapping if needed.

**Filename:** `{slug(session-name)}_{NNN}.png` where `slug()` lowercases, transliterates Cyrillic, replaces non-`[a-z0-9]` with `-`, and trims. NNN is the outfit's index within the session, zero-padded to 3 digits. Example: session "Lisbon Trip" → `lisbon-trip_007.png`. Session "Весна 2026" → `vesna-2026_007.png`.

**Bulk export:** uses `jszip` (small, no deps) to build a zip in-memory and trigger a single download. On iOS, Web Share API as fallback when downloads land in awkward locations.

## Data persistence

**Library** (Dexie schema):

```ts
db.version(1).stores({
  items:        'id, slot, createdAt',
  sessions:     'id, updatedAt',
  savedOutfits: 'id, sessionId, createdAt',
});
```

Indexes:
- `items.slot` — fast filter in Library tab
- `sessions.updatedAt` — sort sessions list
- `savedOutfits.sessionId` — fetch outfits per session

**Blob storage:** Dexie stores blobs natively in IndexedDB. No base64, no inflation. On read, `URL.createObjectURL(blob)` produces a tab-local URL for `<img src>` or canvas drawing.

**Persistence request:** on first item save, call `navigator.storage.persist()` to opt out of cache eviction. Don't bother on session/outfit save — those are ephemeral.

**iOS storage tip (not warning):** since sessions are throwaway, eviction risk only matters for the library. After ~5 items exist, show a one-time non-blocking tip: *"Совет: установи как приложение через Поделиться → На экран Домой — это сохранит вещи надолго."* Dismissible. Don't show again.

**Chrome desktop / Android:** IndexedDB is robust without further action. The tip above only appears on WebKit (iOS Safari / iOS Chrome — same engine).

**PWA setup:** include `manifest.json` and a minimal service worker so Add-to-Home produces a real installed PWA. The SW caches the app shell only; data stays in IDB. This is the canonical install path for her iPhone/iPad use.

## Item deletion

When an item is deleted from the library:
- All `savedOutfits` that reference it are loaded in one query.
- For each affected outfit:
  - Remove the item from `itemIds`.
  - If `itemIds.length === 0`, delete the outfit row.
  - Otherwise, save the shortened outfit (it stays in the session, just with one fewer item — fine since sessions are throwaway and she's likely to re-export anyway).
- If `N > 0` referencing outfits exist, show confirmation: *"Удалить вещь? Она используется в N образах."* Otherwise delete silently.

## Tech stack

| Concern         | Choice                                          | Why                                                         |
| --------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Build tool      | Vite                                            | Fast, zero-config, native ESM in dev                        |
| UI framework    | Svelte 5 (runes)                                | Tiny bundle, reactive without ceremony, no virtual DOM cost |
| Language        | TypeScript                                      | Catches slot-key typos and combination shape bugs           |
| Persistence     | Dexie 4                                         | Promise-friendly IndexedDB, ~25kb min+gz                    |
| Image decode    | `createImageBitmap` (native)                    | No deps, off-main-thread decode                             |
| Export ZIP      | `jszip` (only loaded on bulk export)            | Lazy-loaded chunk                                           |
| Touch swipes    | Native pointer events + small custom hook       | Avoid heavy gesture libs                                    |
| Routing         | Manual hash router or `svelte-routing`          | Three tabs don't need a heavy router                        |
| Styling         | Plain CSS with custom properties (design tokens) | Native theming, no runtime overhead                         |
| Icons           | Lucide via `lucide-svelte`                      | Tree-shakeable                                              |

**Bundle target:** < 200 KB initial JS gzipped. Lazy-load `jszip` and the export renderer (only need them on Sessions tab).

## File layout

```
src/
  app/
    App.svelte
    routes.ts
    nav-bar.svelte
  library/
    library.svelte
    upload-sheet.svelte
    item-detail.svelte
    thumbnail.ts          # generate 320px thumb at import
  compose/
    compose.svelte
    constraints-strip.svelte
    slot-ranges.svelte
    grid.svelte
    tinder.svelte
    generator.ts          # pure constraint solver
    preview.svelte        # DOM-based outfit preview, used by grid+tinder+sessions
  sessions/
    sessions.svelte
    session-detail.svelte
    outfit-list.svelte
  export/
    canvas-renderer.ts    # pure Canvas → Blob
    download.ts           # single + zip flows
  db/
    schema.ts             # Dexie schema
    items.ts              # CRUD
    sessions.ts
    outfits.ts
    persist.ts            # storage.persist() helper
  shared/
    slots.ts              # SlotKey enum, labels, render geometry
    types.ts
    object-url.ts         # URL.createObjectURL with lifecycle
  styles/
    tokens.css
    global.css
public/
  manifest.json
  icons/
docs/
  specs/
    2026-05-15-wardrobe-outfit-composer-design.md  ← this file
index.html
package.json
tsconfig.json
vite.config.ts
```

## Testing strategy

- **Generator unit tests** (vitest): given a fixture library and slot ranges, verify combinations satisfy all constraints, locked items always present, dedupe works, edge cases (empty pool, all locked, min > pool size).
- **Render geometry tests**: small set of fixture outfits → assert DOM positions match Canvas positions within 1px tolerance.
- **DB integration tests**: fake-indexeddb in jsdom, exercise CRUD + cascade-delete.
- **No E2E in v1** — manual testing on her devices.

## Risks & mitigations

| Risk                                                    | Mitigation                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| iOS WebKit IndexedDB eviction after ~7 days inactivity  | persist() for items + PWA install tip. Sessions are throwaway so loss is bounded. |
| Large images (>10MB) crash decode on low-RAM iPhone     | Downscale to thumbnail at import; lazy-load full blob only when rendering   |
| Folder upload missing on iOS                            | Detected at runtime; UI shows file picker instead, with hint copy           |
| Performance with 200+ library items                     | Virtual scrolling in library grid; lazy `<img>` decoding                    |
| User deletes item → broken saved outfits                | Cascade-confirm dialog with outfit count                                    |
| Saved outfit references items with stale `zPriority`    | Outfits store item IDs only; rendering reads current `zPriority` at render time |

## Open questions

None. All v1 design decisions resolved during brainstorming.

## What's deliberately deferred

- **Background removal**: monitor whether transparent-PNG uploads cover her real workflow. If she's photographing items on cluttered surfaces, revisit with `@imgly/background-removal` (WASM, ~15MB).
- **In-app camera**: revisit if AirDrop-from-Photos friction proves annoying.
- **Cross-slot items**: revisit if she runs into "this t-shirt is also a dress" cases. Solution path: per-item slot multi-select + variant selection at generation time.
- **Keyboard shortcuts**: not needed on touch devices.
- **Sharing outfits via link**: needs a server. Out of v1 scope.
