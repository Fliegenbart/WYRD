export interface RatingEvent {
  reporterAgentId: string;
  subjectAgentId: string;
  rating: number;
  createdAt: number;
}

/**
 * Calculate the effective weight of a rating, applying anti-gaming measures.
 * Returns a weight between 0 and 1.
 */
export function calculateRatingWeight(
  event: RatingEvent,
  history: RatingEvent[],
  reporterReputation: number,
): number {
  let weight = 1.0;

  // 1. Self-rating is impossible (handled at protocol level via signature verification)
  if (event.reporterAgentId === event.subjectAgentId) return 0;

  // 2. Reporter reputation weight — low-rep agents' ratings count less
  weight *= reputationMultiplier(reporterReputation);

  // 3. Repeat reporter-subject decay
  weight *= repeatDecay(event, history);

  // 4. Outlier detection — ratings far from the mean are down-weighted
  weight *= outlierWeight(event, history);

  return Math.max(0, Math.min(1, weight));
}

/** Agents with higher reputation have more weight */
function reputationMultiplier(reputation: number): number {
  if (reputation < 20) return 0.2;
  if (reputation < 40) return 0.5;
  if (reputation < 60) return 0.8;
  return 1.0;
}

/** Repeated ratings from the same reporter to the same subject decay in weight */
function repeatDecay(event: RatingEvent, history: RatingEvent[]): number {
  const priorCount = history.filter(
    (h) =>
      h.reporterAgentId === event.reporterAgentId &&
      h.subjectAgentId === event.subjectAgentId,
  ).length;

  // Each prior rating halves the weight
  return Math.pow(0.5, priorCount);
}

/** Ratings that are outliers (>2 stddev from mean) are down-weighted */
function outlierWeight(event: RatingEvent, history: RatingEvent[]): number {
  const subjectRatings = history.filter(
    (h) => h.subjectAgentId === event.subjectAgentId,
  );

  if (subjectRatings.length < 5) return 1.0; // not enough data

  const ratings = subjectRatings.map((r) => r.rating);
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance = ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratings.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 1.0;

  const zScore = Math.abs(event.rating - mean) / stdDev;
  if (zScore <= 2) return 1.0;
  if (zScore >= 4) return 0.1;
  // Linear falloff between 2 and 4 stddev
  return 1.0 - (zScore - 2) * 0.45;
}
