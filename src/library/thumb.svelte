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
  let loaded = $state(false);

  $effect(() => {
    loaded = false;
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
    transition: opacity var(--dur-base) var(--ease-out);
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
    background: var(--surface-2);
  }
</style>
