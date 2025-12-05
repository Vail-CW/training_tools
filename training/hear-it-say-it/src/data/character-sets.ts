// CWops curriculum character sets (Sessions 1-10)
// Each session adds new characters progressively

export const CHARACTER_SETS: Record<string, string> = {
  'Standard': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,/?',
  'Session 1': 'AENT',
  'Session 2': 'IOS14',
  'Session 3': 'DHLR25',
  'Session 4': 'CU',
  'Session 5': 'MW36?',
  'Session 6': 'FY,',
  'Session 7': 'GPQ79/',
  'Session 8': 'BV=', // = is BT prosign
  'Session 9': 'JK08+', // + is AR prosign
  'Session 10': 'XZ.>', // > is SK prosign
  'Special': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,/?=+>!',
  'Letters Only': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'Numbers Only': '0123456789',
};

// Sessions in order for cumulative selection
export const SESSION_ORDER = [
  'Session 1',
  'Session 2',
  'Session 3',
  'Session 4',
  'Session 5',
  'Session 6',
  'Session 7',
  'Session 8',
  'Session 9',
  'Session 10',
];

// Get cumulative characters up to and including a session
export function getSessionCharacters(upToSession: number): string {
  let chars = '';
  for (let i = 0; i < upToSession && i < SESSION_ORDER.length; i++) {
    chars += CHARACTER_SETS[SESSION_ORDER[i]];
  }
  return chars;
}

// Get active characters based on selected sets, includes, and excludes
export function getActiveCharacters(
  selectedSets: string[],
  included: string[],
  excluded: string[]
): string[] {
  const charSet = new Set<string>();

  // Add characters from selected sets
  for (const setName of selectedSets) {
    const chars = CHARACTER_SETS[setName];
    if (chars) {
      for (const char of chars) {
        charSet.add(char);
      }
    }
  }

  // Add manually included characters
  for (const char of included) {
    charSet.add(char);
  }

  // Remove excluded characters
  for (const char of excluded) {
    charSet.delete(char);
  }

  return Array.from(charSet).sort();
}

// Default character set for new users
export const DEFAULT_CHARACTER_SET = {
  selectedSets: ['Standard'],
  included: [] as string[],
  excluded: [] as string[],
};
