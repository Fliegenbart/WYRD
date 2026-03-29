import { describe, it, expect } from 'vitest';
import { calculateReputation, type ReputationInput } from './scoring.js';

function makeInput(overrides: Partial<ReputationInput> = {}): ReputationInput {
  return {
    totalTasks: 100,
    successfulTasks: 95,
    avgRating: 4.5,
    totalRatings: 50,
    avgResponseMs: 1000,
    ageDays: 90,
    ratingStdDev: 0.5,
    inactiveDays: 0,
    ...overrides,
  };
}

describe('Reputation Scoring', () => {
  it('calculates a high score for a good agent', () => {
    const score = calculateReputation(makeInput());
    expect(score.overall).toBeGreaterThan(75);
    expect(score.confidenceLevel).toBe('high');
  });

  it('gives new agents a neutral score with low confidence', () => {
    const score = calculateReputation(makeInput({
      totalTasks: 0,
      successfulTasks: 0,
      totalRatings: 0,
      avgRating: 0,
      ageDays: 0,
    }));
    expect(score.overall).toBeGreaterThanOrEqual(20);
    expect(score.overall).toBeLessThanOrEqual(60);
    expect(score.confidenceLevel).toBe('low');
  });

  it('penalizes low success rate', () => {
    const good = calculateReputation(makeInput({ successfulTasks: 95 }));
    const bad = calculateReputation(makeInput({ successfulTasks: 30 }));
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(bad.components.taskSuccess).toBeLessThan(50);
  });

  it('decays score after 30 days inactivity', () => {
    const active = calculateReputation(makeInput({ inactiveDays: 0 }));
    const inactive = calculateReputation(makeInput({ inactiveDays: 60 }));
    expect(active.overall).toBeGreaterThan(inactive.overall);
  });

  it('never decays below 50 (neutral)', () => {
    const veryInactive = calculateReputation(makeInput({ inactiveDays: 365 }));
    expect(veryInactive.overall).toBeGreaterThanOrEqual(50);
  });

  it('rewards consistency (low rating variance)', () => {
    const consistent = calculateReputation(makeInput({ ratingStdDev: 0.2 }));
    const inconsistent = calculateReputation(makeInput({ ratingStdDev: 1.8 }));
    expect(consistent.components.consistency).toBeGreaterThan(inconsistent.components.consistency);
  });
});
