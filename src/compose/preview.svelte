<script lang="ts">
  /*
   * Outfit preview — flat-lay catalog layout.
   *
   * Three horizontal bands (upper / middle / lower) stack top-to-bottom.
   * Items in each band sit side-by-side with no overlap; flex ratios
   * (4 / 3 / 2.5) give the upper band the most room since tops and
   * outerwear are usually the visually dominant pieces. Empty bands
   * are removed from the DOM so the remaining bands stretch to fill.
   *
   * Goal here is *legibility for evaluation*, not figure-style composition.
   * The wife scans dozens of generated combos to pick candidates; final
   * polishing happens in Canva. So overlap-free wins over body-silhouette
   * realism.
   *
   * Same component is used by the compose grid, the Tinder full-screen
   * view, and the saved-outfits list — single scale-fluid component.
   */
  import type { Combination, Item } from '../shared/types';
  import { type SlotKey } from '../shared/slots';
  import Thumb from '../library/thumb.svelte';

  let { combo, accent = false }: { combo: Combination; accent?: boolean } = $props();

  const UPPER_SLOTS: SlotKey[] = ['top', 'outerwear', 'full_body'];
  const MIDDLE_SLOTS: SlotKey[] = ['bottom'];
  const LOWER_SLOTS: SlotKey[] = ['shoes', 'accessories', 'other'];

  function gather(slots: SlotKey[]): Item[] {
    const out: Item[] = [];
    for (const slot of slots) {
      const items = combo.bySlot[slot] ?? [];
      out.push(...items);
    }
    return out;
  }

  const upper = $derived(gather(UPPER_SLOTS));
  const middle = $derived(gather(MIDDLE_SLOTS));
  const lower = $derived(gather(LOWER_SLOTS));
</script>

<div class="canvas" class:accent>
  {#if upper.length > 0}
    <div class="band band-upper">
      {#each upper as item (item.id)}
        <div class="cell">
          <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} fit="contain" />
        </div>
      {/each}
    </div>
  {/if}
  {#if middle.length > 0}
    <div class="band band-middle">
      {#each middle as item (item.id)}
        <div class="cell">
          <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} fit="contain" />
        </div>
      {/each}
    </div>
  {/if}
  {#if lower.length > 0}
    <div class="band band-lower">
      {#each lower as item (item.id)}
        <div class="cell">
          <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} fit="contain" />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 5;
    background: var(--tile);
    overflow: hidden;
    isolation: isolate;
    border-radius: var(--radius-2);
    display: flex;
    flex-direction: column;
    padding: 4%;
    gap: 2%;
  }
  .canvas.accent {
    background: var(--tile);
  }

  .band {
    /* align-items defaults to stretch so cells fill the band's flex-
       allocated height. Using `center` here lets cells fall back to
       intrinsic image height, which blows past the band bounds and
       spills out the bottom of the card. */
    display: flex;
    justify-content: center;
    gap: 3%;
    min-height: 0;
    min-width: 0;
  }
  .band-upper { flex: 4; }
  .band-middle { flex: 3; }
  .band-lower { flex: 2.5; }

  /* No overflow: hidden here — `object-fit: contain` already constrains
     the image content to the cell box, and we WANT the drop-shadow halo
     to extend slightly past the cell so items look like they're floating
     rather than living inside hard rectangular crops. The outer .canvas
     still clips anything that exceeds the card itself. */
  .cell {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .cell :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 16px var(--tile-shadow));
  }
</style>
