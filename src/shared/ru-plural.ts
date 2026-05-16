/**
 * Correct Russian pluralization. Takes a number and three forms:
 *   - one form (1, 21, 31… but not 11)
 *   - few form (2-4, 22-24… but not 12-14)
 *   - many form (0, 5-20, 25-30, …)
 */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n);
  const n10 = abs % 10;
  const n100 = abs % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

export const OUTFITS = ['образ', 'образа', 'образов'] as const;
export const ITEMS = ['вещь', 'вещи', 'вещей'] as const;
export const FILES = ['файл', 'файла', 'файлов'] as const;
export const DAYS_AGO = ['день назад', 'дня назад', 'дней назад'] as const;
export const HOURS_AGO = ['час назад', 'часа назад', 'часов назад'] as const;
export const MINUTES_AGO = ['минуту назад', 'минуты назад', 'минут назад'] as const;
