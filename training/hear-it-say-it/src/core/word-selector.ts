import type { WordHistoryState } from '../types';
import { getDefaultWMA } from './weighted-average';
import { getWordsByLength, filterWordsByActiveChars, type WordLength } from '../data/word-lists';

/**
 * Calculate a word's "weakness score" based on constituent character WMAs.
 * Higher score = word contains weaker characters = should be practiced more.
 */
export function calculateWordWeakness(
  word: string,
  wordHistory: WordHistoryState
): number {
  const chars = word.toUpperCase().split('');
  const defaultWMA = getDefaultWMA();

  // Sum of WMAs for all characters in the word
  const totalWMA = chars.reduce((sum, char) => {
    const wma = wordHistory[char]?.wma ?? defaultWMA;
    return sum + wma;
  }, 0);

  // Average WMA for the word
  return totalWMA / chars.length;
}

/**
 * Adaptive word selection algorithm
 * Words containing characters with higher (slower) WMA get higher selection probability
 * Adaptive gain controls how much the distribution is skewed toward weak words
 */
export function selectNextWord(
  wordLength: WordLength,
  wordHistory: WordHistoryState,
  activeChars: string[],
  adaptiveGain: number = 50,
  previousWord: string | null = null
): string {
  const allWords = getWordsByLength(wordLength);
  const validWords = filterWordsByActiveChars(allWords, activeChars);

  if (validWords.length === 0) {
    throw new Error('No valid words available with current character set');
  }

  if (validWords.length === 1) {
    return validWords[0];
  }

  // Calculate weights for each word based on average character weakness
  const weights = validWords.map((word) => {
    const weakness = calculateWordWeakness(word, wordHistory);

    // Adaptive gain transforms the distribution:
    // gain = 0: flat distribution (all equal weight)
    // gain = 50: linear relationship to weakness
    // gain = 100: squared relationship (heavily favor weak words)
    const exponent = adaptiveGain / 50; // 0 to 2
    let weight = Math.pow(weakness / 1000, exponent); // Normalize to reasonable range

    // Reduce weight of previous word to avoid immediate repeats
    if (word === previousWord) {
      weight *= 0.2;
    }

    return { word, weight };
  });

  // Calculate total weight for normalization
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  // Random selection based on weighted probabilities
  const random = Math.random() * totalWeight;
  let cumulative = 0;

  for (const { word, weight } of weights) {
    cumulative += weight;
    if (random <= cumulative) {
      return word;
    }
  }

  // Fallback (should rarely happen due to floating point)
  return weights[weights.length - 1].word;
}

/**
 * Get the selection probability for each word (for debugging/visualization)
 */
export function getWordSelectionProbabilities(
  wordLength: WordLength,
  wordHistory: WordHistoryState,
  activeChars: string[],
  adaptiveGain: number = 50
): Array<{ word: string; probability: number; avgWMA: number }> {
  const allWords = getWordsByLength(wordLength);
  const validWords = filterWordsByActiveChars(allWords, activeChars);

  if (validWords.length === 0) return [];

  const exponent = adaptiveGain / 50;

  const weights = validWords.map((word) => {
    const avgWMA = calculateWordWeakness(word, wordHistory);
    const weight = Math.pow(avgWMA / 1000, exponent);
    return { word, weight, avgWMA };
  });

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  return weights.map(({ word, weight, avgWMA }) => ({
    word,
    probability: weight / totalWeight,
    avgWMA,
  }));
}

/**
 * Check if word mode is available with current character set
 * Returns true if at least one word can be formed
 */
export function isWordModeAvailable(
  wordLength: WordLength,
  activeChars: string[]
): boolean {
  const allWords = getWordsByLength(wordLength);
  const validWords = filterWordsByActiveChars(allWords, activeChars);
  return validWords.length > 0;
}

/**
 * Get count of available words for a given length and character set
 */
export function getAvailableWordCount(
  wordLength: WordLength,
  activeChars: string[]
): number {
  const allWords = getWordsByLength(wordLength);
  const validWords = filterWordsByActiveChars(allWords, activeChars);
  return validWords.length;
}
