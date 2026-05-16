<script lang="ts">
  /*
   * Render a Blob as an <img>, managing the objectURL lifecycle.
   * Use this anywhere we render an item's thumbnail or full blob.
   *
   * Fade-in caveat: `loaded` is initialised to false ONCE and never
   * reset by the effect. The image stays at opacity 0 until onload
   * fires, then permanently fades to opacity 1. Filter swaps that
   * keep the component mounted (visibility: display:none in library)
   * don't re-trigger the fade — only the genuine first decode does.
   */
  let {
    blob,
    alt = '',
    fit = 'contain',
  }: { blob: Blob | undefined; alt?: string; fit?: 'contain' | 'cover' } = $props();

  let url = $state<string>('');
  let loaded = $state(false);

  $effect(() => {
    if (!blob) {
      url = '';
      return;
    }
    const next = URL.createObjectURL(blob);
    url = next;
    return () => URL.revokeObjectURL(next);
  });
</script>

{#if url}
  <img
    src={url}
    {alt}
    class:cover={fit === 'cover'}
    class:contain={fit === 'contain'}
    class:loaded
    loading="lazy"
    decoding="async"
    onload={() => (loaded = true)}
  />
{:else}
  <div class="placeholder" aria-hidden="true"></div>
{/if}

<style>
  img {
    width: 100%;
    height: 100%;
    display: block;
    opacity: 0;
    transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  img.loaded {
    opacity: 1;
  }
  .contain {
    object-fit: contain;
  }
  .cover {
    object-fit: cover;
  }
  .placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--surface-2) 0%,
      var(--surface-3) 50%,
      var(--surface-2) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .placeholder { animation: none; }
  }
</style>
