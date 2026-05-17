<script lang="ts">
  import { X, Undo2 } from 'lucide-svelte';
  import { composeState, pullBatch } from './compose-state.svelte';
  import { saveOutfit } from '../db/outfits';
  import Preview from './preview.svelte';

  let { onClose }: { onClose: () => void } = $props();

  let dragX = $state(0);
  let dragging = $state(false);
  let leaving = $state<'left' | 'right' | null>(null);
  let entering = $state(false);
  let pointerId: number | null = null;
  let startX = 0;

  let closing = $state(false);
  function requestClose() {
    if (closing) return;
    closing = true;
    setTimeout(onClose, 260);
  }

  const PULL_AHEAD = 8;
  const SWIPE_THRESHOLD = 100;

  const current = $derived(composeState.results[composeState.tinderIndex]);

  $effect(() => {
    // Keep the results buffer ahead of the cursor so we don't stall on swipe.
    if (composeState.results.length - composeState.tinderIndex < PULL_AHEAD && !composeState.exhausted) {
      pullBatch(20);
    }
  });

  function onPointerDown(ev: PointerEvent) {
    if (leaving) return;
    pointerId = ev.pointerId;
    startX = ev.clientX;
    dragging = true;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev: PointerEvent) {
    if (!dragging || ev.pointerId !== pointerId) return;
    dragX = ev.clientX - startX;
  }

  function onPointerUp(ev: PointerEvent) {
    if (!dragging || ev.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    if (dragX <= -SWIPE_THRESHOLD) {
      decide(false);
    } else if (dragX >= SWIPE_THRESHOLD) {
      decide(true);
    } else {
      dragX = 0;
    }
  }

  async function decide(keep: boolean) {
    if (!current) return;
    leaving = keep ? 'right' : 'left';
    if (navigator.vibrate) navigator.vibrate(keep ? [12, 30, 12] : 8);
    if (keep && composeState.session) {
      await saveOutfit(composeState.session.id, current);
    }
    // After exit animation, advance.
    setTimeout(() => {
      composeState.tinderIndex++;
      dragX = 0;
      leaving = null;
      entering = true;
      setTimeout(() => (entering = false), 60);
    }, 220);
  }

  function back() {
    if (composeState.tinderIndex > 0) {
      composeState.tinderIndex--;
      dragX = 0;
      leaving = null;
    }
  }

  const angle = $derived(Math.max(-12, Math.min(12, dragX / 14)));
  const tint = $derived(Math.max(-1, Math.min(1, dragX / SWIPE_THRESHOLD)));
</script>

<div class="tinder" class:closing role="dialog" aria-modal="true">
  <header class="top">
    <button class="icon-btn" type="button" aria-label="Закрыть" onclick={requestClose}>
      <X size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <div class="position">
      <span class="position-current">{Math.min(composeState.tinderIndex + 1, composeState.results.length)}</span>
      <span class="position-of">/</span>
      <span class="position-total">{composeState.results.length}{composeState.exhausted ? '' : '+'}</span>
    </div>
    <button
      class="icon-btn"
      type="button"
      aria-label="Назад"
      disabled={composeState.tinderIndex === 0}
      onclick={back}
    >
      <Undo2 size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
  </header>

  <div
    class="stage"
    role="application"
    aria-label="Карточки образов. Свайп влево или вправо для выбора"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#if current}
      {@const next1 = composeState.results[composeState.tinderIndex + 1]}
      {@const next2 = composeState.results[composeState.tinderIndex + 2]}
      <div class="deck">
        {#if next2}
          <div class="card card-back card-back-2">
            <Preview combo={next2} accent />
          </div>
        {/if}
        {#if next1}
          <div class="card card-back card-back-1">
            <Preview combo={next1} accent />
          </div>
        {/if}
        <!-- Key on the index so each swiped card unmounts cleanly when
             advancing — without the key, the same DOM node is reused and
             the leaving class is animated *back* to base, producing the
             "card comes back" visual bug. -->
        {#key composeState.tinderIndex}
          <div
            class="card card-active"
            class:dragging
            class:leaving-left={leaving === 'left'}
            class:leaving-right={leaving === 'right'}
            class:entering
            style:transform={dragging
              ? `translateX(${dragX}px) rotate(${angle}deg)`
              : ''}
          >
            <Preview combo={current} accent />
            <div class="tint nope" style:opacity={Math.max(0, -tint)}></div>
            <div class="tint yes" style:opacity={Math.max(0, tint)}></div>
            <div class="badge nope-badge" style:opacity={Math.max(0, -tint)}>хуйня</div>
            <div class="badge yes-badge" style:opacity={Math.max(0, tint)}>заебись</div>
          </div>
        {/key}
      </div>
    {:else if composeState.exhausted}
      <div class="empty">
        <p class="empty-eyebrow">всё</p>
        <p class="empty-title">
          <span class="display">Комбинаций больше</span>
          <br />
          <span class="display empty-accent">не осталось.</span>
        </p>
        <p class="empty-hint">Расширь диапазоны или закрепи меньше вещей.</p>
      </div>
    {:else}
      <div class="loading">
        <span class="display loading-text">подбираю…</span>
      </div>
    {/if}
  </div>

  <footer class="actions">
    <button
      class="action nope"
      class:primed={tint < -0.1}
      type="button"
      disabled={!current}
      onclick={() => decide(false)}
    >
      <span class="display action-label">хуйня</span>
    </button>
    <button
      class="action yes"
      class:primed={tint > 0.1}
      type="button"
      disabled={!current}
      onclick={() => decide(true)}
    >
      <span class="display action-label">заебись</span>
    </button>
  </footer>
</div>

<style>
  .tinder {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    z-index: 300;
    padding: var(--safe-top) 0 var(--safe-bottom);
    animation: tinder-in var(--dur-medium) var(--ease-out-expo);
  }
  .tinder.closing {
    animation: tinder-out var(--dur-base) var(--ease-out) forwards;
  }
  @keyframes tinder-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tinder-out {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(8px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tinder, .tinder.closing { animation: none; }
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-xs) var(--space-md);
  }

  .icon-btn {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .icon-btn:hover {
      color: var(--text);
      background: var(--surface);
    }
  }
  .icon-btn:active:not(:disabled) {
    transform: scale(0.9);
    background: var(--surface);
    color: var(--text);
    transition-duration: 60ms;
  }
  .icon-btn:disabled {
    opacity: 0.3;
  }

  .position {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    display: flex;
    align-items: baseline;
    gap: var(--space-3xs);
    color: var(--text);
  }
  .position-of, .position-total {
    color: var(--text-muted);
  }

  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: var(--space-sm) var(--space-md);
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }

  /* The deck holds the active card + 2 peek-cards behind it. Active
     card claims the deck's box; back cards are positioned absolute
     inside the deck with translated/scaled transforms so they
     "peek" from behind. Stack pattern: classic Tinder. */
  .deck {
    position: relative;
    width: min(100%, 540px);
    aspect-ratio: 4 / 5;
  }
  .card {
    position: absolute;
    inset: 0;
    transition: transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out);
    cursor: grab;
    will-change: transform;
    touch-action: none;
  }
  .card.card-active {
    z-index: 2;
  }
  .card.card-back {
    pointer-events: none;
  }
  /* Back cards lean slightly left/right with rotation — the "scattered
     deck" look. Without the offset+rotation, center-origin scale leaves
     them fully hidden behind the active card. */
  .card.card-back-1 {
    transform: translate(-8px, 10px) rotate(-2.5deg) scale(0.96);
    opacity: 0.55;
    z-index: 1;
  }
  .card.card-back-2 {
    transform: translate(8px, 20px) rotate(2.5deg) scale(0.92);
    opacity: 0.28;
    z-index: 0;
  }
  /* While the finger is down, kill the transition so the card tracks
     1:1 with movement (no easing = no shake). On release we re-enable
     the transition and either snap back or fly off-screen. */
  .card.dragging {
    transition: none;
    cursor: grabbing;
  }
  .card.leaving-left {
    transform: translateX(-130%) rotate(-15deg);
  }
  .card.leaving-right {
    transform: translateX(130%) rotate(15deg);
  }
  .card.entering {
    transform: translateY(8px) scale(0.985);
    opacity: 0.7;
  }

  .tint {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity var(--dur-quick) linear;
  }
  .tint.nope { background: oklch(0.3 0.02 18 / 0.45); }
  .tint.yes  { background: var(--accent-tint); }

  .badge {
    position: absolute;
    top: var(--space-md);
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    line-height: 1;
    pointer-events: none;
    text-transform: lowercase;
    letter-spacing: var(--track-tight);
    padding: var(--space-2xs) var(--space-sm);
    border: 2px solid currentColor;
    transition: opacity var(--dur-quick) linear;
  }
  .nope-badge {
    left: var(--space-md);
    color: var(--text);
    transform: rotate(-8deg);
  }
  .yes-badge {
    right: var(--space-md);
    color: var(--accent);
    transform: rotate(8deg);
  }

  .empty, .loading {
    text-align: center;
    padding: var(--space-2xl) var(--space-md);
    max-width: 400px;
  }
  .empty-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-sm);
  }
  .empty-title {
    font-size: var(--text-3xl);
    color: var(--text);
    line-height: 1.05;
    margin-bottom: var(--space-md);
  }
  .empty-accent {
    color: var(--accent);
  }
  .empty-hint {
    color: var(--text-muted);
  }
  .loading-text {
    font-size: var(--text-2xl);
    color: var(--text-muted);
    animation: pulse 1.6s ease-in-out infinite;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--border-soft);
  }
  .action {
    /* Grid + place-items centers the label horizontally and vertically
       regardless of the button's intrinsic content metrics, so the label
       sits dead-center in its half rather than wherever default button
       alignment ends up putting it. */
    display: grid;
    place-items: center;
    padding: var(--space-md) var(--space-sm);
    transition:
      background var(--dur-quick) var(--ease-out),
      color var(--dur-quick) var(--ease-out),
      transform var(--dur-quick) var(--ease-out);
    background: var(--bg);
    color: var(--text);
  }
  .action.nope {
    color: var(--text-muted);
  }
  .action.yes {
    color: var(--accent);
  }
  @media (hover: hover) {
    .action.nope:hover {
      background: var(--surface);
      color: var(--text);
    }
    .action.yes:hover {
      background: var(--accent);
      color: var(--accent-on);
    }
  }
  .action:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 60ms;
  }
  .action.nope:active:not(:disabled),
  .action.nope.primed {
    background: var(--surface);
    color: var(--text);
  }
  .action.yes:active:not(:disabled),
  .action.yes.primed {
    background: var(--accent);
    color: var(--accent-on);
  }
  .action:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .action-label {
    font-size: var(--text-3xl);
    line-height: 1;
    letter-spacing: var(--track-tight);
    text-transform: lowercase;
    transition: transform var(--dur-quick) var(--ease-out);
  }
  /* Bump scale on the primed label so the swipe direction reads even
     before the threshold trips — the user sees "the app heard me start
     swiping right" within the first few pixels of motion. */
  .action.primed .action-label {
    transform: scale(1.08);
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
