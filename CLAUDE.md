# Shmotkee — project context for Claude

Personal PWA for browsing combinations of a wardrobe. The owner's wife is the primary user; she uploads photos of her clothes, the app generates outfit combinations, she swipes / picks favourites and polishes them in Canva separately.

**Russian UI throughout.** Code, comments, and commits in English; user-visible strings in Russian.

## Stack

- **Svelte 5** (runes — `$state`, `$derived`, `$effect`, `{#key}`)
- **Vite** + `vite-plugin-pwa` (autoUpdate SW, base `/shmotkee/` in prod, `/` in dev)
- **Dexie** over IndexedDB (`tinder-dlya-shmotok`, schema v2)
- **TypeScript** strict
- **vitest** (no DOM env — pure modules + mocked APIs)
- **lucide-svelte** for icons

Deployed via GitHub Pages from `main` at `ideriabin.github.io/shmotkee/`.

## Commands

```bash
npm run dev         # vite dev server, port 5173
npm run check       # svelte-check — type errors must be 0
npm run build       # production build
npx vitest run      # tests
```

When verifying work, always run `npm run check` and `npx vitest run` before claiming done. Both must be clean.

## Architecture

### Top-level

Three tabs (`src/app/nav-bar.svelte`):
- **Library** (`src/library/library.svelte`) — manage uploaded items. Soft-delete trash with restore.
- **Compose** (`src/compose/compose.svelte`) — generate outfit combinations from a session.
- **Sessions** (`src/sessions/`) — list of sessions with saved outfits.

### Items & sessions

- **Item** (`src/shared/types.ts`): `id`, `name`, `slot`, `zPriority`, `blob`, `thumbnail`, `createdAt`, `deletedAt?`. Soft-delete via `deletedAt`; library/pickers/generator filter by `!deletedAt`.
- **Session**: `id`, `name`, `slotRanges`, `subsetIds: string[] | null`. Each session is a "capsule" — subset null = full wardrobe, non-null = curated pool.
- **SavedOutfit**: `sessionId` + `itemIds[]`. References items by id; outfit rendering still works after soft-delete (items are still in DB).

### Generator (`src/compose/generator.ts`)

Pure, no DOM, no I/O. Single function `generate(opts)` returns a Generator of `Combination`. Each slot samples independently within its `[min, max]` range from the supplied library pool. Empty outfits are never emitted.

**No XOR between top/bottom and full_body** — the wife confirmed slip-dress-under-sweater + pants is a legitimate look. Independent slot sampling.

**No "lock" concept.** "Always include item X" is expressed by leaving X as the only item of its slot in the subset — the generator picks 1 from a 1-item pool every time. Locks used to exist (`lockedIds`) but were dropped as a redundant convenience layer over subset.

### Outfit render (`src/compose/preview.svelte`)

Flat-lay band layout: three horizontal bands (upper / middle / lower) at flex ratios **4 / 3 / 2.5**. Items in each band sit side-by-side, no overlap. Empty bands collapse out of the DOM so present bands stretch.

Band assignment:
- **Upper**: `top`, `outerwear`, `full_body`
- **Middle**: `bottom`
- **Lower**: `shoes`, `accessories`, `other`

The PNG exporter (`src/export/canvas-renderer.ts`) mirrors the same layout pixel-for-pixel.

**Goal is legibility for evaluation, not figure-style composition** — the wife scans dozens of combos and finalizes in Canva. Overlap-free wins over body-silhouette realism.

### Trim & reprocess (`src/library/trim.ts`, `reprocess.ts`)

Alpha-based bounding box trim runs on every upload (transparent margin cropped, 2% padding). Idempotent — already-tight images return the original Blob ref.

`reprocessAllItems()` is an async generator over the library that yields `{done, total, failed, changed}`. UI sits in `upload-sheet.svelte` as "Перепроверить картинки".

### Tinder mode (`src/compose/tinder.svelte`)

Active card wrapped in `{#key composeState.tinderIndex}` so each swipe unmounts the leaving card's DOM cleanly. Without the key, the leaving class is animated *back* to base and the card snap-returns (a confusing bug).

Footer labels (`хуйня` / `заебись`) get a `.primed` class when `tint` magnitude exceeds 0.1, giving instant directional feedback within a few pixels of drag.

### Storage & migrations

- Dexie schema version **2** (`src/db/schema.ts`). v1→v2 upgrade migrates session ranges (`src/db/migrations.ts`).
- Newly-added fields (`deletedAt`, `subsetIds`) don't need an index, so they're handled by `hydrateSession` at read time rather than a Dexie version bump. Pattern: **non-indexed additive field = hydrate at read; indexed or transforming = version bump**.

### Sticky filter chips (library)

`position: sticky` on the chip strip works only because the strip's *parent* is `.page` (tall, the full scroll column). Nested inside a short `.hero` it would unpin within ~80px of scroll. `IntersectionObserver` with `rootMargin: '-1px 0 0 0'` toggles a `.pinned` class for the hairline shadow.

## Conventions

- **One commit per logical feature**, conventional commit prefixes (`feat:` / `fix:` / `refactor:`). HEREDOC for the body to preserve formatting.
- **No documentation files (`*.md`) without an explicit user ask.** `CLAUDE.md`, `ideas.md`, and `README.md` are the only ones.
- **Default to no comments.** Only when WHY is non-obvious — a hidden constraint, a workaround, a subtle invariant. Never narrate WHAT the code does.
- **Tests are colocated**: `foo.ts` + `foo.test.ts` in the same directory.
- **No `Math.random` in production paths that must be deterministic across renders** — for instance, the generator's `sortByZ` uses `id.localeCompare` as a tiebreaker so two samples with the same items produce the same dedupe key regardless of sample order.

## Design philosophy

- **Local-first.** All data in IndexedDB. No server. Photos never leave the device. PWA installable on iPad / iOS / desktop.
- **Generated outfits are a catalog, not a render.** Optimize for fast scanning over visual perfection.
- **The wife is non-technical.** UX errs toward fewer concepts, larger tap targets, fewer destructive actions. Soft-delete instead of hard-delete. Undo where possible.
- **Don't over-engineer.** This is one user. Indexes can wait; auto-classification can wait; AI features can wait.

## Recently dropped / never doing

- **Shape XOR** between separates and one-piece — reverted because real outfits sometimes combine.
- **Locks** as a separate concept — subset replaces them.
- **Schema migrations for additive non-indexed fields** — hydrate at read instead.

## Where AI fits next

See `ideas.md` LLM roadmap section. Short version:
1. Browser-side WASM background removal (no infra).
2. Cloudflare Worker proxy decision.
3. Claude vision item descriptions.
4. LLM-as-ranker over the existing generator.

## Files of note

| Path | Purpose |
|---|---|
| `src/compose/generator.ts` | Pure outfit sampling |
| `src/compose/preview.svelte` | Band-layout renderer |
| `src/compose/compose-state.svelte.ts` | Module-scope reactive state + `applySubset` |
| `src/compose/subset-picker.svelte` | Подборка picker (multi-select + select-all/clear-category) |
| `src/library/trim.ts` | Alpha-bounding-box trim (pure helpers + Canvas wrapper) |
| `src/library/reprocess.ts` | Async-generator bulk re-trim |
| `src/library/trash.svelte` | Trash bin (restore + purge) |
| `src/db/items.ts` | Item CRUD + soft-delete/restore/purge |
| `src/db/sessions.ts` | Session CRUD + `hydrateSession` |
| `src/db/migrations.ts` | v1→v2 range migration |
| `src/shared/slots.ts` | Slot keys, Russian labels, default ranges |
| `src/export/canvas-renderer.ts` | PNG export mirroring the band layout |
