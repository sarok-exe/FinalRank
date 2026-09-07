import { describe, it, expect } from 'vitest';
import { estimateGameRating, skillLevel } from '../src/lib/reporter/expectedPoints';

describe('estimateGameRating', () => {
  it('maps chess.com reference accuracies to their exact game ratings', () => {
    // Reference data: chess.com Game Review for sarok_exe vs adrianboss70
    expect(estimateGameRating(80.8)).toBe(1900);
    expect(estimateGameRating(67.0)).toBe(1400);
  });

  it('clamps minimum rating at 300', () => {
    expect(estimateGameRating(0)).toBe(300);
    expect(estimateGameRating(10)).toBe(300);
  });

  it('handles 100% accuracy', () => {
    expect(estimateGameRating(100)).toBe(2595);
  });

  it('returns sensible values across the common range', () => {
    expect(estimateGameRating(90)).toBeGreaterThan(2200);
    expect(estimateGameRating(75)).toBeGreaterThan(1400);
    expect(estimateGameRating(60)).toBeLessThan(1200);
  });
});

describe('skillLevel', () => {
  it('returns Professional for estimated rating >= 2000', () => {
    expect(skillLevel(2000)).toBe('Professional');
    expect(skillLevel(2500)).toBe('Professional');
  });

  it('returns Amateur for estimated rating < 2000', () => {
    expect(skillLevel(1999)).toBe('Amateur');
    expect(skillLevel(1400)).toBe('Amateur');
  });
});
