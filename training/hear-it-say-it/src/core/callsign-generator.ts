import type { CallsignHistoryState } from '../types';
import { getDefaultWMA } from './weighted-average';

// Callsign format definitions
export interface CallsignFormat {
  id: string;           // '1x1', '1x2', etc.
  name: string;         // Display name
  prefixLength: 1 | 2;
  suffixLength: 1 | 2 | 3;
}

export const CALLSIGN_FORMATS: CallsignFormat[] = [
  { id: '1x1', name: '1×1 (e.g., K1A)', prefixLength: 1, suffixLength: 1 },
  { id: '1x2', name: '1×2 (e.g., W3AB)', prefixLength: 1, suffixLength: 2 },
  { id: '2x1', name: '2×1 (e.g., KA5X)', prefixLength: 2, suffixLength: 1 },
  { id: '2x2', name: '2×2 (e.g., WB2XY)', prefixLength: 2, suffixLength: 2 },
  { id: '1x3', name: '1×3 (e.g., N7ABC)', prefixLength: 1, suffixLength: 3 },
  { id: '2x3', name: '2×3 (e.g., KE9BOS)', prefixLength: 2, suffixLength: 3 },
];

// Valid first letters for US amateur callsigns
const US_PREFIX_FIRST = ['K', 'N', 'W', 'A'];

// All letters for suffix and second prefix position
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Digits 0-9
const DIGITS = '0123456789'.split('');

/**
 * Get format by ID
 */
export function getFormatById(id: string): CallsignFormat | undefined {
  return CALLSIGN_FORMATS.find(f => f.id === id);
}

/**
 * Get formats by IDs
 */
export function getFormatsByIds(ids: string[]): CallsignFormat[] {
  return CALLSIGN_FORMATS.filter(f => ids.includes(f.id));
}

/**
 * Select a character based on weighted probabilities
 * Higher WMA (slower response) = higher chance of selection
 */
function selectWeightedChar(
  candidates: string[],
  callsignHistory: CallsignHistoryState,
  adaptiveGain: number
): string {
  if (candidates.length === 0) {
    throw new Error('No candidates for weighted selection');
  }

  if (candidates.length === 1 || adaptiveGain === 0) {
    // Random selection when no gain or single candidate
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const defaultWMA = getDefaultWMA();
  const exponent = adaptiveGain / 50; // 0 to 2

  // Calculate weight for each candidate
  const weights = candidates.map(char => {
    const wma = callsignHistory[char]?.wma ?? defaultWMA;
    const weight = Math.pow(wma / 1000, exponent);
    return { char, weight };
  });

  // Calculate total weight
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

  // Fallback
  return weights[weights.length - 1].char;
}

/**
 * Generate a realistic US amateur callsign with adaptive character weighting
 *
 * @param format - The callsign format to generate
 * @param callsignHistory - Character history for adaptive weighting
 * @param activeChars - Active character set (letters only used if they're active)
 * @param adaptiveGain - How much to weight toward weak characters (0-100)
 */
export function generateCallsign(
  format: CallsignFormat,
  callsignHistory: CallsignHistoryState,
  activeChars: string[],
  adaptiveGain: number
): string {
  // Filter to only use active letters/digits
  const activeLetters = ALL_LETTERS.filter(l => activeChars.includes(l));
  const activeDigits = DIGITS.filter(d => activeChars.includes(d));

  // Must have at least some letters and digits
  const lettersToUse = activeLetters.length > 0 ? activeLetters : ALL_LETTERS;
  const digitsToUse = activeDigits.length > 0 ? activeDigits : DIGITS;

  // First letter must be valid US prefix
  const validFirstLetters = US_PREFIX_FIRST.filter(l => lettersToUse.includes(l));
  const firstLetterCandidates = validFirstLetters.length > 0 ? validFirstLetters : US_PREFIX_FIRST;

  let callsign = '';

  // Generate prefix
  callsign += selectWeightedChar(firstLetterCandidates, callsignHistory, adaptiveGain);

  if (format.prefixLength === 2) {
    // Second prefix letter can be any letter
    callsign += selectWeightedChar(lettersToUse, callsignHistory, adaptiveGain);
  }

  // Generate digit (always exactly one)
  callsign += selectWeightedChar(digitsToUse, callsignHistory, adaptiveGain);

  // Generate suffix
  for (let i = 0; i < format.suffixLength; i++) {
    callsign += selectWeightedChar(lettersToUse, callsignHistory, adaptiveGain);
  }

  return callsign;
}

/**
 * Select a random format from enabled formats
 */
export function selectRandomFormat(enabledFormatIds: string[]): CallsignFormat {
  const formats = getFormatsByIds(enabledFormatIds);

  if (formats.length === 0) {
    // Default to 2x3 if nothing enabled
    return CALLSIGN_FORMATS.find(f => f.id === '2x3')!;
  }

  return formats[Math.floor(Math.random() * formats.length)];
}

/**
 * Generate a callsign using a random format from enabled formats
 */
export function generateRandomCallsign(
  enabledFormatIds: string[],
  callsignHistory: CallsignHistoryState,
  activeChars: string[],
  adaptiveGain: number,
  previousCallsign: string | null = null
): string {
  const format = selectRandomFormat(enabledFormatIds);
  let callsign = generateCallsign(format, callsignHistory, activeChars, adaptiveGain);

  // Avoid immediate repeats (try up to 3 times)
  let attempts = 0;
  while (callsign === previousCallsign && attempts < 3) {
    callsign = generateCallsign(format, callsignHistory, activeChars, adaptiveGain);
    attempts++;
  }

  return callsign;
}

/**
 * Get the total length of a callsign for a given format
 */
export function getCallsignLength(format: CallsignFormat): number {
  return format.prefixLength + 1 + format.suffixLength; // prefix + digit + suffix
}
