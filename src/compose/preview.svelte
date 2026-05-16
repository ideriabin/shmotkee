<script lang="ts">
  /*
   * DOM-based outfit preview. Same component scales fluidly — used in
   * compose grid tiles (small), Tinder full-screen (large), and saved
   * outfits list (medium). Geometry comes from SLOT_RECT so canvas
   * export stays in lockstep with on-screen rendering.
   */
  import type { Combination } from '../shared/types';
  import { SLOT_RECT, SLOT_RENDER_ORDER, type SlotKey } from '../shared/slots';
  import Thumb from '../library/thumb.svelte';

  let { combo, accent = false }: { combo: Combination; accent?: boolean } = $props();
</script>

<div class="canvas" class:accent>
  {#each SLOT_RENDER_ORDER as slot (slot)}
    {#each combo.bySlot[slot] ?? [] as item, idx (item.id)}
      {@const rect = SLOT_RECT[slot as SlotKey]}
      <div
        class="slot"
        style:left="{rect.x}%"
        style:top="{rect.y}%"
        style:width="{rect.w}%"
        style:height="{rect.h}%"
        style:z-index={rect.z + item.zPriority + idx * 0.01}
      >
        <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} fit="contain" />
      </div>
    {/each}
  {/each}
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
  }
  .canvas.accent {
    background: var(--tile);
  }
  .slot {
    position: absolute;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .slot :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 6px 16px var(--tile-shadow));
  }
</style>
