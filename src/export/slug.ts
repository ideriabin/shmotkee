/*
 * Slugify a string for safe filenames. Transliterates Cyrillic to Latin,
 * lowercases, replaces non-[a-z0-9] with '-', trims leading/trailing
 * dashes, and collapses runs.
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

export function slugify(input: string): string {
  const lower = input.toLowerCase();
  const transliterated = [...lower]
    .map((ch) => (ch in CYRILLIC_MAP ? CYRILLIC_MAP[ch]! : ch))
    .join('');
  const cleaned = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'session';
}
