export interface ReputationInput {
  /** Number of completed tasks */
  totalTasks: number;
  /** Number of successful tasks */
  successfulTasks: number;
  /** Average peer rating (1-5) */
  avgRating: number;
  /** Number of ratings received */
  totalRatings: number;
  /** Average response time in ms */
  avgResponseMs: number;
  /** SLA target response time in ms (optional) */
  slaTargetMs?: number;
  /** Days since agent first registered */
  ageDays: number;
  /** Rating standard deviation (for consistency bonus) */
  ratingStdDev: number;
  /** Days since last activity */
  inactiveDays: number;
}

export interface ReputationScore {
  /** Composite score 0-100 */
  overall: number;
  /** Individual component scores */
  components: {
    taskSuccess: number;
    ratings: number;
    speed: number;
    longevity: number;
    volume: number;
    consistency: number;
  };
  /** How reliable is this score? */
  confidenceLevel: 'low' | 'medium' | 'high';
}

/** Weights for each component */
const WEIGHTS = {
  taskSuccess: 0.35,
  ratings: 0.25,
  speed: 0.15,
  longevity: 0.10,
  volume: 0.05,
  consistency: 0.10,
} as const;

/** Decay rate: points lost per week of inactivity after 30 days */
const DECAY_PER_WEEK = 2;
const DECAY_THRESHOLD_DAYS = 30;
const NEUTRAL_SCORE = 50;

export function calculateReputation(input: ReputationInput): ReputationScore {
  const components = {
    taskSuccess: calcTaskSuccess(input),
    ratings: calcRatings(input),
    speed: calcSpeed(input),
    longevity: calcLongevity(input),
    volume: calcVolume(input),
    consistency: calcConsistency(input),
  };

  let overall =
    components.taskSuccess * WEIGHTS.taskSuccess +
    components.ratings * WEIGHTS.ratings +
    components.speed * WEIGHTS.speed +
    components.longevity * WEIGHTS.longevity +
    components.volume * WEIGHTS.volume +
    components.consistency * WEIGHTS.consistency;

  // Apply decay for inactive agents
  if (input.inactiveDays > DECAY_THRESHOLD_DAYS) {
    const weeksInactive = (input.inactiveDays - DECAY_THRESHOLD_DAYS) / 7;
    const decay = weeksInactive * DECAY_PER_WEEK;
    overall = Math.max(NEUTRAL_SCORE, overall - decay);
  }

  overall = clamp(overall, 0, 100);

  const confidenceLevel = getConfidenceLevel(input);

  return { overall, components, confidenceLevel };
}

function calcTaskSuccess(input: ReputationInput): number {
  if (input.totalTasks === 0) return NEUTRAL_SCORE;
  const rate = input.successfulTasks / input.totalTasks;
  return rate * 100;
}

function calcRatings(input: ReputationInput): number {
  if (input.totalRatings === 0) return NEUTRAL_SCORE;
  // Convert 1-5 scale to 0-100
  return ((input.avgRating - 1) / 4) * 100;
}

function calcSpeed(input: ReputationInput): number {
  if (input.totalTasks === 0) return NEUTRAL_SCORE;
  const targetMs = input.slaTargetMs ?? 5000;
  if (input.avgResponseMs <= targetMs) return 100;
  if (input.avgResponseMs >= targetMs * 5) return 0;
  // Linear interpolation between target and 5x target
  return 100 - ((input.avgResponseMs - targetMs) / (targetMs * 4)) * 100;
}

function calcLongevity(input: ReputationInput): number {
  // Score increases logarithmically with age, caps at ~100 after 365 days
  if (input.ageDays <= 0) return 0;
  return Math.min(100, Math.log10(input.ageDays + 1) * 39);
}

function calcVolume(input: ReputationInput): number {
  // Logarithmic — 1000 tasks ≈ 100 score
  if (input.totalTasks === 0) return 0;
  return Math.min(100, Math.log10(input.totalTasks + 1) * 33.3);
}

function calcConsistency(input: ReputationInput): number {
  if (input.totalRatings < 3) return NEUTRAL_SCORE;
  // Low std dev = high consistency
  // stdDev of 0 → 100, stdDev of 2 → 0
  return clamp(100 - input.ratingStdDev * 50, 0, 100);
}

function getConfidenceLevel(input: ReputationInput): 'low' | 'medium' | 'high' {
  if (input.totalTasks < 10) return 'low';
  if (input.totalTasks < 100) return 'medium';
  return 'high';
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
