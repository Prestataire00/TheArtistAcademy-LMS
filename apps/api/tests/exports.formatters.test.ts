import { formatDate, formatDuration, formatPercent, percentInt } from '../src/modules/exports/exports.formatters';

describe('exports.formatters', () => {
  describe('formatDate', () => {
    it('formats a valid date in JJ/MM/AAAA hh:mm (Europe/Paris)', () => {
      // 11/05/2026 14:32 CEST = 12:32 UTC
      const d = new Date(Date.UTC(2026, 4, 11, 12, 32, 7));
      expect(formatDate(d)).toBe('11/05/2026 14:32');
    });

    it('keeps the date stable when timezone differs from UTC', () => {
      // 01/01/2026 00:30 CET = 23:30 UTC the previous day
      const d = new Date(Date.UTC(2025, 11, 31, 23, 30));
      expect(formatDate(d)).toBe('01/01/2026 00:30');
    });

    it('returns "-" for null', () => {
      expect(formatDate(null)).toBe('-');
    });

    it('returns "-" for undefined', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('returns "-" for an invalid Date (NaN)', () => {
      expect(formatDate(new Date('not-a-date'))).toBe('-');
    });

    it('zero-pads day, month, hour and minute', () => {
      // 03/02/2026 04:05 CET = 03:05 UTC
      const d = new Date(Date.UTC(2026, 1, 3, 3, 5));
      expect(formatDate(d)).toBe('03/02/2026 04:05');
    });
  });

  describe('formatDuration', () => {
    it('formats hh:mm:ss for a typical value (example 02:35:14)', () => {
      expect(formatDuration(9314)).toBe('02:35:14');
    });

    it('handles exactly 1 hour', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
    });

    it('handles values under one minute', () => {
      expect(formatDuration(59)).toBe('00:00:59');
    });

    it('handles exactly 1 minute', () => {
      expect(formatDuration(60)).toBe('00:01:00');
    });

    it('returns 00:00:00 for 0', () => {
      expect(formatDuration(0)).toBe('00:00:00');
    });

    it('returns 00:00:00 for null', () => {
      expect(formatDuration(null)).toBe('00:00:00');
    });

    it('returns 00:00:00 for undefined', () => {
      expect(formatDuration(undefined)).toBe('00:00:00');
    });

    it('returns 00:00:00 for negative values', () => {
      expect(formatDuration(-10)).toBe('00:00:00');
    });

    it('returns 00:00:00 for NaN', () => {
      expect(formatDuration(Number.NaN)).toBe('00:00:00');
    });

    it('handles long durations (> 99h) without truncation', () => {
      // 100h 0m 0s
      expect(formatDuration(360000)).toBe('100:00:00');
    });

    it('floors fractional seconds', () => {
      expect(formatDuration(61.9)).toBe('00:01:01');
    });
  });

  describe('formatPercent', () => {
    it('formats a decimal value as rounded percent', () => {
      expect(formatPercent(0.42)).toBe('42%');
    });

    it('formats 0 as 0%', () => {
      expect(formatPercent(0)).toBe('0%');
    });

    it('formats 1 as 100%', () => {
      expect(formatPercent(1)).toBe('100%');
    });

    it('rounds half-up by default (Math.round)', () => {
      expect(formatPercent(0.005)).toBe('1%');
      expect(formatPercent(0.994)).toBe('99%');
      expect(formatPercent(0.999)).toBe('100%');
    });

    it('returns "-" for null', () => {
      expect(formatPercent(null)).toBe('-');
    });

    it('returns "-" for undefined', () => {
      expect(formatPercent(undefined)).toBe('-');
    });

    it('returns "-" for NaN', () => {
      expect(formatPercent(Number.NaN)).toBe('-');
    });

    it('accepts values > 1 (no clamp)', () => {
      expect(formatPercent(1.5)).toBe('150%');
    });
  });

  describe('percentInt', () => {
    it('convertit un decimal en entier de pourcentage', () => {
      expect(percentInt(0.5)).toBe('50');
    });

    it('convertit 0.84 en "84"', () => {
      expect(percentInt(0.84)).toBe('84');
    });

    it('arrondit (Math.round) — 0.846 → "85"', () => {
      expect(percentInt(0.846)).toBe('85');
    });

    it('convertit 1 en "100"', () => {
      expect(percentInt(1)).toBe('100');
    });

    it('convertit 0 en "0"', () => {
      expect(percentInt(0)).toBe('0');
    });

    it('null → chaine vide', () => {
      expect(percentInt(null)).toBe('');
    });

    it('undefined → chaine vide', () => {
      expect(percentInt(undefined)).toBe('');
    });

    it('NaN → chaine vide', () => {
      expect(percentInt(Number.NaN)).toBe('');
    });

    it('valeur negative reste convertie (pas de clamp)', () => {
      expect(percentInt(-0.5)).toBe('-50');
    });

    it('valeur > 1 reste convertie (pas de clamp)', () => {
      expect(percentInt(1.5)).toBe('150');
    });
  });
});
