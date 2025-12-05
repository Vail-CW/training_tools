// Morse code definitions: character -> dit/dah pattern
// '.' = dit, '-' = dah
export const MORSE_CODES: Record<string, string> = {
  // Letters
  'A': '.-',
  'B': '-...',
  'C': '-.-.',
  'D': '-..',
  'E': '.',
  'F': '..-.',
  'G': '--.',
  'H': '....',
  'I': '..',
  'J': '.---',
  'K': '-.-',
  'L': '.-..',
  'M': '--',
  'N': '-.',
  'O': '---',
  'P': '.--.',
  'Q': '--.-',
  'R': '.-.',
  'S': '...',
  'T': '-',
  'U': '..-',
  'V': '...-',
  'W': '.--',
  'X': '-..-',
  'Y': '-.--',
  'Z': '--..',

  // Numbers
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',

  // Punctuation
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '/': '-..-.',
};

// Reverse lookup: morse pattern -> character
export const MORSE_TO_CHAR: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_CODES).map(([char, code]) => [code, char])
);

// All available characters
export const ALL_CHARACTERS = Object.keys(MORSE_CODES);

// Character display names (for special characters if needed)
export const CHAR_DISPLAY_NAMES: Record<string, string> = {};

// Get display name for a character
export function getCharDisplayName(char: string): string {
  return CHAR_DISPLAY_NAMES[char] || char;
}
