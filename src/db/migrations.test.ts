import { describe, expect, it } from 'vitest';
import { migrateSessionRanges, V1_DEFAULTS } from './migrations';
import { DEFAULT_SLOT_RANGES } from '../shared/slots';

describe('migrateSessionRanges (v1 → v2)', () => {
  it('untouched v1 session → wholesale replace with new defaults', () => {
    const result = migrateSessionRanges({ ...V1_DEFAULTS });
    expect(result).toEqual(DEFAULT_SLOT_RANGES);
  });

  it('customized session → preserves user values except bottom/full_body mins', () => {
    const customized = {
      ...V1_DEFAULTS,
      top: { min: 1, max: 3 },
      accessories: { min: 1, max: 4 },
    };
    const result = migrateSessionRanges(customized);
    expect(result.top).toEqual({ min: 1, max: 3 });
    expect(result.accessories).toEqual({ min: 1, max: 4 });
  });

  it('floors bottom.min and full_body.min at 1', () => {
    const result = migrateSessionRanges({
      ...V1_DEFAULTS,
      top: { min: 1, max: 3 },
      bottom: { min: 0, max: 1 },
      full_body: { min: 0, max: 1 },
    });
    expect(result.bottom.min).toBe(1);
    expect(result.full_body.min).toBe(1);
  });

  it('bumps max alongside min when a user had min=0 max=0', () => {
    const result = migrateSessionRanges({
      ...V1_DEFAULTS,
      top: { min: 1, max: 3 },
      bottom: { min: 0, max: 0 },
      full_body: { min: 0, max: 0 },
    });
    expect(result.bottom).toEqual({ min: 1, max: 1 });
    expect(result.full_body).toEqual({ min: 1, max: 1 });
  });

  it('leaves bottom/full_body alone if user already raised the min', () => {
    const result = migrateSessionRanges({
      ...V1_DEFAULTS,
      top: { min: 1, max: 3 },
      bottom: { min: 2, max: 2 },
      full_body: { min: 1, max: 2 },
    });
    expect(result.bottom).toEqual({ min: 2, max: 2 });
    expect(result.full_body).toEqual({ min: 1, max: 2 });
  });
});
