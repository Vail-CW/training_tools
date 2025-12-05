import type { HistoryState } from '../types';
import { getDefaultWMA } from './weighted-average';

/**
 * Adaptive character selection algorithm
 * Characters with higher (slower) WMA get higher selection probability
 * Adaptive gain controls how much the distribution is skewed toward slow characters
 */
export function selectNextCharacter(
  activeChars: string[],
  history: HistoryState,
  adaptiveGain: number = 50,
  previousChar: string | null = null
): string {
  if (activeChars.length === 0) {
    throw new Error('No active characters to select from');
  }

  if (activeChars.length === 1) {
    return activeChars[0];
  }

  const defaultWMA = getDefaultWMA();

  // Calculate weights for each character
  const weights = activeChars.map((char) => {
    const wma = history[char]?.wma ?? defaultWMA;

    // Adaptive gain transforms the distribution:
    // gain = 0: flat distribution (all equal weight)
    // gain = 50: linear relationship to WMA
    // gain = 100: squared relationship (heavily favor slow chars)
    const exponent = adaptiveGain / 50; // 0 to 2
    let weight = Math.pow(wma / 1000, exponent); // Normalize WMA to reasonable range

    // Reduce weight of previous character to avoid immediate repeats
    if (char === previousChar) {
      weight *= 0.2;
    }

    return { char, weight };
  });

  // Calculate total weight for normalization
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  // Random selection based on weighted probabilities
  const random = Math.random() * totalWeight;
  let cumulative = 0;

  for (const { char, weight } of weights) {
    cumulative += weight;
    if (random <= cumulative) {
      return char;
    }
  }

  // Fallback (should rarely happen due to floating point)
  return weights[weights.length - 1].char;
}

/**
 * Get the selection probability for each character (for debugging/visualization)
 */
export function getSelectionProbabilities(
  activeChars: string[],
  history: HistoryState,
  adaptiveGain: number = 50
): Array<{ char: string; probability: number }> {
  if (activeChars.length === 0) return [];

  const defaultWMA = getDefaultWMA();
  const exponent = adaptiveGain / 50;

  const weights = activeChars.map((char) => {
    const wma = history[char]?.wma ?? defaultWMA;
    const weight = Math.pow(wma / 1000, exponent);
    return { char, weight };
  });

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  return weights.map(({ char, weight }) => ({
    char,
    probability: weight / totalWeight,
  }));
}
