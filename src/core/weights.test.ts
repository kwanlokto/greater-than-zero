import {
  convertWeight,
  describeLoad,
  describeSet,
  displayWeightOf,
  formatWeight,
  isAtLeast,
  isHeavier,
  lightestOf,
  roundedForDisplay,
} from './weights';

describe('converting and rounding', () => {
  test('converts between pounds and kilograms at full precision', () => {
    expect(convertWeight(135, 'lb', 'kg')).toBeCloseTo(61.235, 3);
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.462, 3);
    expect(convertWeight(60, 'kg', 'kg')).toBe(60);
  });

  test('rounds to one decimal place, halves away from zero either way', () => {
    expect(roundedForDisplay(61.235)).toBe(61.2);
    expect(roundedForDisplay(2.25)).toBe(2.3);
    expect(roundedForDisplay(-2.25)).toBe(-2.3);
  });

  test('shows a weight in the display unit, and none for plain bodyweight', () => {
    expect(displayWeightOf(135, 'lb', 'kg')).toEqual({ value: 61.2, unit: 'kg' });
    expect(displayWeightOf(null, 'kg', 'lb')).toBeNull();
  });
});

describe('comparing', () => {
  test('compares exactly in one unit', () => {
    const sixty = { weight: 60, weightUnit: 'kg' } as const;
    expect(isHeavier({ weight: 60.5, weightUnit: 'kg' }, sixty)).toBe(true);
    expect(isHeavier(sixty, sixty)).toBe(false);
    expect(isAtLeast(sixty, sixty)).toBe(true);
  });

  test('treats weights within 0.05 kg across units as the same', () => {
    const target = { weight: 135, weightUnit: 'lb' } as const;
    // 61.25 kg is 0.015 kg over 135 lb: the same weight, loaded.
    expect(isHeavier({ weight: 61.25, weightUnit: 'kg' }, target)).toBe(false);
    expect(isAtLeast({ weight: 61.25, weightUnit: 'kg' }, target)).toBe(true);
    expect(isHeavier({ weight: 62.5, weightUnit: 'kg' }, target)).toBe(true);
  });

  test('counts plain bodyweight as no added weight', () => {
    expect(isHeavier({ weight: 5, weightUnit: 'kg' }, { weight: null, weightUnit: 'kg' })).toBe(
      true,
    );
    expect(
      lightestOf([
        { weight: 10, weightUnit: 'kg' },
        { weight: null, weightUnit: 'kg' },
        { weight: -5, weightUnit: 'kg' },
      ]),
    ).toEqual({ weight: -5, weightUnit: 'kg' });
  });
});

describe('reading out', () => {
  test('writes a weight with its unit, and a real minus sign', () => {
    expect(formatWeight({ value: 82.4, unit: 'kg' })).toBe('82.4 kg');
    expect(formatWeight({ value: -20, unit: 'lb' })).toBe('−20 lb');
  });

  test('describes a weighted load by its weight', () => {
    expect(describeLoad('weighted', { weight: 60, displayWeight: { value: 60, unit: 'kg' } })).toBe(
      '60 kg',
    );
  });

  test('describes blank and 0 added weight alike, as plain bodyweight', () => {
    expect(describeLoad('bodyweight', { weight: null, displayWeight: null })).toBe('bodyweight');
    expect(describeLoad('bodyweight', { weight: 0, displayWeight: { value: 0, unit: 'kg' } })).toBe(
      'bodyweight',
    );
  });

  test('signs added weight and help from an assisted machine', () => {
    expect(
      describeLoad('bodyweight', { weight: 10, displayWeight: { value: 10, unit: 'kg' } }),
    ).toBe('bodyweight + 10 kg');
    expect(
      describeLoad('bodyweight', { weight: -20, displayWeight: { value: -20, unit: 'lb' } }),
    ).toBe('bodyweight − 20 lb');
  });

  test('describes a Set with its reps, starting with a capital', () => {
    expect(
      describeSet('weighted', { weight: 80, displayWeight: { value: 80, unit: 'kg' }, reps: 9 }),
    ).toBe('80 kg × 9');
    expect(describeSet('bodyweight', { weight: null, displayWeight: null, reps: 10 })).toBe(
      'Bodyweight × 10',
    );
    expect(
      describeSet('bodyweight', {
        weight: 2.5,
        displayWeight: { value: 2.5, unit: 'kg' },
        reps: 6,
      }),
    ).toBe('Bodyweight + 2.5 kg × 6');
  });
});
