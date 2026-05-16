<script lang="ts">
  /*
   * Render a Blob as an <img>, managing the objectURL lifecycle.
   * Use this anywhere we render an item's thumbnail or full blob.
   */
  let {
    blob,
    alt = '',
    fit = 'contain',
  }: { blob: Blob | undefined; alt?: string; fit?: 'contain' | 'cover' } = $props();

  let url = $state<string>('');

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
    loading="lazy"
    decoding="async"
  />
{:else}
  <div class="placeholder" aria-hidden="true"></div>
{/if}

<style>
  img {
    width: 100%;
    height: 100%;
    display: block;
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
