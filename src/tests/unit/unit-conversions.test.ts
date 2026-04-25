import { describe, it, expect } from 'vitest';
import {
  stpMassToKevUm,
  stpMassToMeVcm,
  csdaGcm2ToCm,
  autoScaleLengthCm,
  formatSigFigs,
} from '$lib/utils/unit-conversions';

describe('stpMassToKevUm', () => {
  it('converts mass stopping power to linear (solid)', () => {
    // Stopping power fixtures (S_mass=25, ρ=1.0):
    expect(stpMassToKevUm(25, 1.0)).toBe(2.5);
  });

  it('converts mass stopping power to linear (gas)', () => {
    // gas fixture (S_mass=25, ρ=0.0012):
    expect(stpMassToKevUm(25, 0.0012)).toBeCloseTo(0.003, 6);
  });

  it('returns null when density is zero', () => {
    expect(stpMassToKevUm(25, 0)).toBeNull();
  });

  it('returns null when density is negative', () => {
    expect(stpMassToKevUm(25, -1.0)).toBeNull();
  });

  it('handles typical material densities', () => {
    expect(stpMassToKevUm(100, 2.5)).toBe(25);
    expect(stpMassToKevUm(50, 0.9)).toBe(4.5);
  });
});

describe('stpMassToMeVcm', () => {
  it('converts mass stopping power to MeV/cm (solid)', () => {
    // Stopping power fixtures (S_mass=25, ρ=1.0):
    expect(stpMassToMeVcm(25, 1.0)).toBe(25);
  });

  it('converts mass stopping power to MeV/cm (gas)', () => {
    // gas fixture:
    expect(stpMassToMeVcm(25, 0.0012)).toBeCloseTo(0.03, 4);
  });

  it('returns null when density is zero', () => {
    expect(stpMassToMeVcm(25, 0)).toBeNull();
  });

  it('returns null when density is negative', () => {
    expect(stpMassToMeVcm(25, -1.0)).toBeNull();
  });
});

describe('csdaGcm2ToCm', () => {
  it('converts CSDA range from g/cm² to cm (solid)', () => {
    // CSDA range fixtures (range_mass=0.2, ρ=1.0):
    expect(csdaGcm2ToCm(0.2, 1.0)).toBe(0.2);
  });

  it('converts CSDA range for gas', () => {
    expect(csdaGcm2ToCm(0.1, 0.0012)).toBeCloseTo(83.33, 2);
  });

  it('returns null when density is zero', () => {
    expect(csdaGcm2ToCm(0.2, 0)).toBeNull();
  });

  it('returns null when density is negative', () => {
    expect(csdaGcm2ToCm(0.2, -1.0)).toBeNull();
  });
});

describe('autoScaleLengthCm', () => {
  it('scales to meters for large values', () => {
    // autoScaleLengthCm(250) → { value: 2.5, unit: 'm' }
    expect(autoScaleLengthCm(250)).toEqual({ value: 2.5, unit: 'm' });
  });

  it('scales to cm for values >= 1 cm', () => {
    expect(autoScaleLengthCm(5)).toEqual({ value: 5, unit: 'cm' });
    expect(autoScaleLengthCm(1)).toEqual({ value: 1, unit: 'cm' });
  });

  it('scales to mm for values >= 0.1 cm', () => {
    // autoScaleLengthCm(0.2) → { value: 2, unit: 'mm' }
    expect(autoScaleLengthCm(0.2)).toEqual({ value: 2, unit: 'mm' });
    expect(autoScaleLengthCm(0.1)).toEqual({ value: 1, unit: 'mm' });
  });

  it('scales to µm for values >= 0.0001 cm', () => {
    // autoScaleLengthCm(0.00012) → { value: 1.2, unit: 'µm' }
    expect(autoScaleLengthCm(0.00012)).toEqual({ value: 1.2, unit: 'µm' });
    expect(autoScaleLengthCm(0.0001)).toEqual({ value: 1, unit: 'µm' });
    expect(autoScaleLengthCm(0.0005)).toEqual({ value: 5, unit: 'µm' });
  });

  it('scales to nm for very small values', () => {
    expect(autoScaleLengthCm(0.00005)).toEqual({ value: 500, unit: 'nm' });
    expect(autoScaleLengthCm(1e-5).value).toBeCloseTo(100, 0);
    expect(autoScaleLengthCm(1.5e-4).value).toBeCloseTo(1.5, 1);
    expect(autoScaleLengthCm(1.5e-4).unit).toBe('µm');
  });

  it('handles boundary conditions', () => {
    // Exactly at boundaries
    expect(autoScaleLengthCm(100)).toEqual({ value: 1, unit: 'm' });
    expect(autoScaleLengthCm(1)).toEqual({ value: 1, unit: 'cm' });
    expect(autoScaleLengthCm(0.1)).toEqual({ value: 1, unit: 'mm' });
    expect(autoScaleLengthCm(0.0001)).toEqual({ value: 1, unit: 'µm' });
  });
});

describe('formatSigFigs', () => {
  it('formats to 4 significant figures', () => {
    // formatSigFigs examples:
    expect(formatSigFigs(45.7623, 4)).toBe('45.76');
    expect(formatSigFigs(0.001234, 4)).toBe('0.001234');
    expect(formatSigFigs(12340, 4)).toBe('12340');
  });

  it('handles small numbers', () => {
    expect(formatSigFigs(0.00012345, 4)).toBe('0.0001235');
    expect(formatSigFigs(0.0000123, 4)).toBe('0.0000123');
    expect(formatSigFigs(0.001234, 4)).toBe('0.001234');
    expect(formatSigFigs(0.00123456, 4)).toBe('0.001235');
  });

  it('handles large numbers', () => {
    expect(formatSigFigs(1234567, 4)).toBe('1234567');
    expect(formatSigFigs(99999, 4)).toBe('99999');
    expect(formatSigFigs(12340, 4)).toBe('12340');
    // 12345 with 4 sig figs has 0 decimal places → no rounding needed at integer level
    expect(formatSigFigs(12345, 4)).toBe('12345');
  });

  it('handles zero', () => {
    expect(formatSigFigs(0, 4)).toBe('0');
  });

  it('handles negative numbers', () => {
    expect(formatSigFigs(-45.7623, 4)).toBe('-45.76');
    expect(formatSigFigs(-0.001234, 4)).toBe('-0.001234');
  });

  it('formats with different sig fig counts', () => {
    expect(formatSigFigs(123.456, 3)).toBe('123');
    expect(formatSigFigs(123.456, 5)).toBe('123.46');
    expect(formatSigFigs(0.123456, 2)).toBe('0.12');
  });

  it('handles exact values', () => {
    expect(formatSigFigs(2.5, 4)).toBe('2.5');
    expect(formatSigFigs(1.0, 4)).toBe('1');
    expect(formatSigFigs(45.7623, 4)).toBe('45.76');
  });
});
