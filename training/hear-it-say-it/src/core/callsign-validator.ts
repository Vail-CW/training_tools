/**
 * Callsign Validator
 *
 * Parses spoken input and validates against expected callsign.
 * Uses flexible matching: any word starting with the correct letter is accepted.
 *
 * Examples:
 * - "Kilo Echo Nine Bravo Oscar Sierra" -> "KE9BOS" (NATO)
 * - "Kevin Edward Nine Boston Oscar Sam" -> "KE9BOS" (flexible)
 * - "Kangaroo Elephant 9 Banana Orange Snake" -> "KE9BOS" (also valid)
 */

// Number word mappings (spoken word -> digit)
const NUMBER_WORDS: Record<string, string> = {
  // Standard
  'zero': '0',
  'one': '1',
  'two': '2',
  'three': '3',
  'four': '4',
  'five': '5',
  'six': '6',
  'seven': '7',
  'eight': '8',
  'nine': '9',

  // Ham radio / NATO variants
  'niner': '9',
  'tree': '3',
  'fower': '4',
  'fife': '5',

  // Common misrecognitions
  'oh': '0',
  'o': '0',
  'won': '1',
  'wun': '1',
  'to': '2',
  'too': '2',
  'free': '3',
  'for': '4',
  'ate': '8',
  'ait': '8',
};

export interface CallsignValidationResult {
  isCorrect: boolean;
  expected: string;
  parsed: string;
  errors: CallsignError[];
}

export interface CallsignError {
  position: number;
  expected: string;
  got: string;
}

/**
 * Parse a single spoken word to a callsign character
 *
 * @param word - The spoken word
 * @returns The character (letter or digit), or '?' if unrecognized
 */
function parseWordToChar(word: string): string {
  const normalized = word.toLowerCase().trim();

  // Empty or whitespace
  if (!normalized) {
    return '?';
  }

  // Check if it's a number word
  if (NUMBER_WORDS[normalized]) {
    return NUMBER_WORDS[normalized];
  }

  // Check if it's a single digit
  if (/^[0-9]$/.test(normalized)) {
    return normalized;
  }

  // Check if it's an ordinal number (1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th, 0th)
  // Speech recognition often converts "nine" to "9th" etc.
  const ordinalMatch = normalized.match(/^([0-9])(st|nd|rd|th)$/i);
  if (ordinalMatch) {
    return ordinalMatch[1];
  }

  // Check if it's a single letter
  if (/^[a-z]$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  // For any other word, take the first letter (flexible matching)
  const firstChar = normalized.charAt(0);
  if (/[a-z]/i.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  // Unrecognized
  return '?';
}

/**
 * Parse spoken words into a callsign string
 *
 * @param transcript - The full spoken transcript (e.g., "Kilo Echo Nine Bravo Oscar Sierra")
 * @returns The parsed callsign (e.g., "KE9BOS")
 */
export function parseWordsToCallsign(transcript: string): string {
  // Split into words, filtering out empty strings
  const words = transcript
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);

  // Parse each word to a character
  return words.map(parseWordToChar).join('');
}

/**
 * Validate a spoken transcript against an expected callsign
 *
 * @param expected - The expected callsign (e.g., "KE9BOS")
 * @param transcript - The spoken transcript (e.g., "Kilo Echo Nine Bravo Oscar Sierra")
 * @returns Validation result with detailed error information
 */
export function validateCallsign(
  expected: string,
  transcript: string
): CallsignValidationResult {
  const parsed = parseWordsToCallsign(transcript);
  const expectedUpper = expected.toUpperCase();

  const errors: CallsignError[] = [];

  // Compare character by character
  const maxLen = Math.max(expectedUpper.length, parsed.length);

  for (let i = 0; i < maxLen; i++) {
    const expectedChar = expectedUpper[i] || '';
    const parsedChar = parsed[i] || '';

    if (expectedChar !== parsedChar) {
      errors.push({
        position: i,
        expected: expectedChar || '(missing)',
        got: parsedChar || '(missing)',
      });
    }
  }

  return {
    isCorrect: errors.length === 0 && parsed.length === expectedUpper.length,
    expected: expectedUpper,
    parsed,
    errors,
  };
}

/**
 * Format a callsign for display with error highlighting
 * Returns HTML with correct characters in green and errors in red
 *
 * @param result - The validation result
 * @returns HTML string for display
 */
export function formatCallsignFeedback(result: CallsignValidationResult): string {
  if (result.isCorrect) {
    return `<span class="correct">${result.expected}</span>`;
  }

  const errorPositions = new Set(result.errors.map(e => e.position));
  let html = '';

  for (let i = 0; i < result.expected.length; i++) {
    const char = result.expected[i];
    if (errorPositions.has(i)) {
      html += `<span class="incorrect">${char}</span>`;
    } else {
      html += `<span class="correct">${char}</span>`;
    }
  }

  return html;
}

/**
 * Get a human-readable error description
 *
 * @param result - The validation result
 * @returns Description of what went wrong
 */
export function getErrorDescription(result: CallsignValidationResult): string {
  if (result.isCorrect) {
    return 'Correct!';
  }

  if (result.parsed.length === 0) {
    return 'No response detected';
  }

  if (result.parsed.length !== result.expected.length) {
    return `Expected ${result.expected.length} characters, got ${result.parsed.length}`;
  }

  if (result.errors.length === 1) {
    const err = result.errors[0];
    return `Position ${err.position + 1}: expected "${err.expected}", heard "${err.got}"`;
  }

  return `${result.errors.length} errors: ${result.errors.map(e => `"${e.got}" should be "${e.expected}"`).join(', ')}`;
}
