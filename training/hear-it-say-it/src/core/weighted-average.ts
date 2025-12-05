// Weighted Moving Average calculation
// Uses exponential smoothing to give more weight to recent results

const WMA_DECAY = 0.15; // Weight given to new observation (0.15 = 15%)
const DEFAULT_WMA = 5000; // Default response time for new characters (ms)
const MAX_PENALTY_TIME = 5000; // Maximum penalty time for incorrect answers (ms)

/**
 * Calculate proportional penalty time based on current WMA
 * Wrong answers penalize at 2x current WMA, capped at MAX_PENALTY_TIME
 */
export function calculatePenaltyTime(currentWMA: number): number {
  return Math.min(currentWMA * 2, MAX_PENALTY_TIME);
}

/**
 * Calculate new WMA given previous WMA and new response time
 * Uses exponential weighted moving average formula:
 * WMA_new = (1 - decay) * WMA_old + decay * new_value
 */
export function calculateWMA(
  previousWMA: number,
  responseTime: number,
  isCorrect: boolean
): number {
  const effectiveTime = isCorrect ? responseTime : calculatePenaltyTime(previousWMA);
  return (1 - WMA_DECAY) * previousWMA + WMA_DECAY * effectiveTime;
}

/**
 * Get default WMA for a new character
 */
export function getDefaultWMA(): number {
  return DEFAULT_WMA;
}

/**
 * Get the penalty time for incorrect responses
 * @param currentWMA - The current WMA to calculate proportional penalty
 */
export function getPenaltyTime(currentWMA: number): number {
  return calculatePenaltyTime(currentWMA);
}

/**
 * Determine the performance level based on WMA
 * - 'icr': Instant Character Recognition (< 600ms)
 * - 'cr': Character Recognition (< 2000ms)
 * - 'learning': Still learning (>= 2000ms)
 */
export function getPerformanceLevel(wma: number): 'icr' | 'cr' | 'learning' {
  if (wma < 600) return 'icr';
  if (wma < 2000) return 'cr';
  return 'learning';
}

/**
 * Get threshold values for chart display
 */
export const THRESHOLDS = {
  ICR: 600, // Instant Character Recognition
  CR: 2000, // Character Recognition
  MAX: 5000, // Maximum (default/penalty)
};
