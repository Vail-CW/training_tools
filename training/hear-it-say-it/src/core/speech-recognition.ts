import type { RecognitionResult, VoiceCalibration } from '../types';
import { store } from '../state/store';

// Prosign spoken forms - used for context-aware matching when expecting a prosign
// These include forms that conflict with letter mappings (like 'ar' which normally maps to 'R')
const PROSIGN_SPOKEN_FORMS: Record<string, string[]> = {
  '=': ['bt', 'b t', 'bee tee', 'bravo tango', 'bravo tang', 'bravo t', 'break', 'pause', 'equals', 'equal'],
  '+': ['ar', 'a r', 'r', 'are', 'ay are', 'ay ar', 'alpha romeo', 'alfa romeo', 'alpha rome', 'alfa rome', 'alpha r', 'alfa r', 'over', 'end of message', 'plus'],
  '>': ['sk', 's k', 'sierra kilo', 'sierra k', 'sierra kil', 'a ok', 'aok', 'okay', "that's ok", 'thats ok', "that's k", 'thats k',
        'a okay', "that's okay", 'thats okay', 'clear', 'out', 'silent key', 'end of contact'],
};

// NATO phonetic alphabet - used for strict mode validation
export const NATO_ALPHABET: Record<string, string> = {
  'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D',
  'echo': 'E', 'foxtrot': 'F', 'golf': 'G', 'hotel': 'H',
  'india': 'I', 'juliet': 'J', 'kilo': 'K', 'lima': 'L',
  'mike': 'M', 'november': 'N', 'oscar': 'O', 'papa': 'P',
  'quebec': 'Q', 'romeo': 'R', 'sierra': 'S', 'tango': 'T',
  'uniform': 'U', 'victor': 'V', 'whiskey': 'W', 'xray': 'X',
  'x-ray': 'X', 'yankee': 'Y', 'zulu': 'Z',
  // Common variations
  'alfa': 'A', 'juliett': 'J',
};

// Speech-to-character mapping
// Supports direct letters, NATO phonetic alphabet, numbers, and prosigns
// Also includes common misrecognitions from Web Speech API
const SPEECH_MAP: Record<string, string> = {
  // Direct letters (lowercase)
  'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E', 'f': 'F', 'g': 'G',
  'h': 'H', 'i': 'I', 'j': 'J', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N',
  'o': 'O', 'p': 'P', 'q': 'Q', 'r': 'R', 's': 'S', 't': 'T', 'u': 'U',
  'v': 'V', 'w': 'W', 'x': 'X', 'y': 'Y', 'z': 'Z',

  // NATO phonetic alphabet
  'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D',
  'echo': 'E', 'foxtrot': 'F', 'golf': 'G', 'hotel': 'H',
  'india': 'I', 'juliet': 'J', 'kilo': 'K', 'lima': 'L',
  'mike': 'M', 'november': 'N', 'oscar': 'O', 'papa': 'P',
  'quebec': 'Q', 'romeo': 'R', 'sierra': 'S', 'tango': 'T',
  'uniform': 'U', 'victor': 'V', 'whiskey': 'W', 'xray': 'X',
  'x-ray': 'X', 'yankee': 'Y', 'zulu': 'Z',

  // Common variations and NATO misspellings
  'alfa': 'A', 'juliett': 'J', 'ecco': 'E', 'eco': 'E',

  // Letter carrier phrases (e.g., "letter B")
  'letter a': 'A', 'letter b': 'B', 'letter c': 'C', 'letter d': 'D',
  'letter e': 'E', 'letter f': 'F', 'letter g': 'G', 'letter h': 'H',
  'letter i': 'I', 'letter j': 'J', 'letter k': 'K', 'letter l': 'L',
  'letter m': 'M', 'letter n': 'N', 'letter o': 'O', 'letter p': 'P',
  'letter q': 'Q', 'letter r': 'R', 'letter s': 'S', 'letter t': 'T',
  'letter u': 'U', 'letter v': 'V', 'letter w': 'W', 'letter x': 'X',
  'letter y': 'Y', 'letter z': 'Z',
  // "the letter X" variants
  'the letter a': 'A', 'the letter b': 'B', 'the letter c': 'C', 'the letter d': 'D',
  'the letter e': 'E', 'the letter f': 'F', 'the letter g': 'G', 'the letter h': 'H',
  'the letter i': 'I', 'the letter j': 'J', 'the letter k': 'K', 'the letter l': 'L',
  'the letter m': 'M', 'the letter n': 'N', 'the letter o': 'O', 'the letter p': 'P',
  'the letter q': 'Q', 'the letter r': 'R', 'the letter s': 'S', 'the letter t': 'T',
  'the letter u': 'U', 'the letter v': 'V', 'the letter w': 'W', 'the letter x': 'X',
  'the letter y': 'Y', 'the letter z': 'Z',

  // Common Web Speech API misrecognitions for single letters
  // (Note: single letter keys like 'a', 'b' etc are already defined above in Direct letters)
  // A
  'hey': 'A', 'ay': 'A', 'eh': 'A', 'aye': 'A', 'a.': 'A', 'aa': 'A', 'ah': 'A', 'ae': 'A',
  'hay': 'A', 'weigh': 'A', 'way': 'A', 'say': 'A', 'day': 'A', 'may': 'A', 'pay': 'A', 'play': 'A', 'stay': 'A', 'grey': 'A', 'gray': 'A',
  // B
  'be': 'B', 'bee': 'B', 'b.': 'B', 'bea': 'B', 'beat': 'B', 'bees': 'B', 'beef': 'B',
  'beam': 'B', 'bean': 'B', 'been': 'B', 'beach': 'B', 'beep': 'B', 'beer': 'B', 'bead': 'B',
  // C
  'see': 'C', 'sea': 'C', 'c.': 'C', 'si': 'C', 'she': 'C', 'seat': 'C', 'seed': 'C',
  'seal': 'C', 'seem': 'C', 'seen': 'C', 'seize': 'C', 'cease': 'C',
  // D
  'de': 'D', 'dee': 'D', 'd.': 'D', 'the': 'D', 'deal': 'D', 'deep': 'D', 'dean': 'D',
  'dear': 'D', 'deer': 'D', 'deed': 'D', 'deem': 'D',
  // E
  'he': 'E', 'ee': 'E', 'e.': 'E', 'ye': 'E', 'me': 'E', 'ea': 'E', 'eee': 'E', 'heat': 'E', 'eat': 'E', 'even': 'E',
  'ease': 'E', 'eel': 'E', 'each': 'E', 'east': 'E', 'evil': 'E', 'equal': 'E',
  // F
  'ef': 'F', 'eff': 'F', 'f.': 'F', 'if': 'F', 'have': 'F', 'half': 'F', 'jeff': 'F',
  'effort': 'F', 'effect': 'F',
  // G
  'gee': 'G', 'ge': 'G', 'g.': 'G', 'ji': 'G', 'jee': 'G', 'geez': 'G', 'jeez': 'G', 'jesus': 'G',
  'gene': 'G', 'jean': 'G', 'jeans': 'G', 'genius': 'G',
  // H
  'age': 'H', 'ach': 'H', 'h.': 'H', 'aitch': 'H', 'ache': 'H', 'ages': 'H',
  'eighth': 'H',
  // I
  'eye': 'I', 'i.': 'I', 'hi': 'I', 'high': 'I', 'eyes': 'I', 'ice': 'I',
  'buy': 'I', 'by': 'I', 'bye': 'I', 'guy': 'I', 'my': 'I', 'tie': 'I', 'try': 'I', 'fly': 'I', 'sky': 'I', 'cry': 'I', 'pie': 'I', 'die': 'I', 'shy': 'I',
  // J
  'jay': 'J', 'je': 'J', 'j.': 'J', 'jae': 'J', 'jade': 'J', 'jays': 'J', 'jane': 'J', 'james': 'J',
  'jail': 'J', 'jake': 'J', 'jack': 'J',
  // K
  'kay': 'K', 'ke': 'K', 'k.': 'K', 'okay': 'K', 'ok': 'K', 'cake': 'K', 'kate': 'K', 'cay': 'K', 'kaye': 'K',
  'came': 'K', 'case': 'K', 'cave': 'K',
  // L
  'el': 'L', 'ell': 'L', 'l.': 'L', 'elle': 'L', 'ale': 'L', 'hell': 'L', 'well': 'L', 'bell': 'L',
  'tell': 'L', 'sell': 'L', 'cell': 'L', 'fell': 'L', 'spell': 'L', 'shell': 'L', 'smell': 'L', 'yell': 'L', 'dwell': 'L',
  // M
  'em': 'M', 'm.': 'M', 'am': 'M', 'um': 'M', 'him': 'M', 'them': 'M', 'mm': 'M',
  'gem': 'M', 'hem': 'M', 'stem': 'M', 'condemn': 'M',
  // N
  'en': 'N', 'n.': 'N', 'and': 'N', 'an': 'N', 'in': 'N', 'end': 'N', 'hen': 'N', 'then': 'N', 'when': 'N',
  'pen': 'N', 'ten': 'N', 'men': 'N', 'den': 'N', 'ben': 'N', 'ken': 'N', 'yen': 'N', 'zen': 'N',
  // O
  'oh': 'O', 'owe': 'O', 'o.': 'O', 'eau': 'O', 'oo': 'O', 'ooh': 'O', 'go': 'O', 'no': 'O', 'so': 'O', 'yo': 'O',
  'low': 'O', 'row': 'O', 'show': 'O', 'slow': 'O', 'snow': 'O', 'grow': 'O', 'flow': 'O', 'blow': 'O', 'know': 'O', 'throw': 'O', 'glow': 'O',
  // P
  'pea': 'P', 'pe': 'P', 'p.': 'P', 'pee': 'P', 'peak': 'P', 'peas': 'P', 'pete': 'P', 'peace': 'P',
  'please': 'P', 'piece': 'P', 'peach': 'P', 'peel': 'P',
  // Q
  'cue': 'Q', 'queue': 'Q', 'q.': 'Q', 'que': 'Q', 'cu': 'Q', 'cute': 'Q',
  'cube': 'Q', 'cupid': 'Q', 'curious': 'Q', 'fuel': 'Q', 'few': 'Q', 'view': 'Q', 'hugh': 'Q', 'hue': 'Q', 'huge': 'Q',
  // R
  'are': 'R', 'ar': 'R', 'r.': 'R', 'our': 'R', 'or': 'R', 'err': 'R', 'her': 'R',
  'car': 'R', 'bar': 'R', 'far': 'R', 'star': 'R', 'jar': 'R', 'tar': 'R', 'par': 'R', 'mar': 'R',
  // S
  'es': 'S', 'ass': 'S', 's.': 'S', 'yes': 'S', 'is': 'S', 'us': 'S', 'this': 'S', 'has': 'S', 'was': 'S',
  'guess': 'S', 'less': 'S', 'mess': 'S', 'bless': 'S', 'dress': 'S', 'press': 'S', 'stress': 'S', 'access': 'S', 'excess': 'S',
  // T
  'tea': 'T', 'tee': 'T', 't.': 'T', 'te': 'T', 'ti': 'T', 'teeth': 'T', 'teas': 'T', 'teen': 'T',
  'team': 'T', 'teach': 'T', 'tear': 'T', 'tease': 'T',
  // U
  'you': 'U', 'ewe': 'U', 'u.': 'U', 'ew': 'U', 'yu': 'U', 'yew': 'U', 'use': 'U', 'used': 'U', 'who': 'U',
  'youth': 'U', 'unit': 'U', 'union': 'U', 'unique': 'U', 'universe': 'U', 'university': 'U', 'usual': 'U', 'utility': 'U',
  // V
  'vee': 'V', 've': 'V', 'v.': 'V', 'vi': 'V', 'fee': 'V', 'wee': 'V', 'visa': 'V',
  'veal': 'V', 'vein': 'V', 'venus': 'V', 'vehicle': 'V', 'very': 'V',
  // W
  'double you': 'W', 'double u': 'W', 'w.': 'W', 'dub': 'W', 'dubs': 'W',
  'dubya': 'W', 'double': 'W',
  // X
  'ex': 'X', 'x.': 'X', 'eggs': 'X', 'axe': 'X', 'ax': 'X', 'next': 'X', 'text': 'X', 'hex': 'X',
  'sex': 'X', 'flex': 'X', 'rex': 'X', 'lex': 'X', 'vex': 'X', 'apex': 'X', 'latex': 'X', 'annex': 'X',
  // Y
  'why': 'Y', 'y.': 'Y', 'wie': 'Y', 'wye': 'Y', 'wise': 'Y', 'white': 'Y',
  'wire': 'Y', 'wife': 'Y', 'wide': 'Y', 'wild': 'Y', 'while': 'Y', 'wipe': 'Y',
  // Z
  'zee': 'Z', 'zed': 'Z', 'z.': 'Z', 'ze': 'Z', 'said': 'Z', 'seas': 'Z', 'easy': 'Z',
  'zeal': 'Z', 'zebra': 'Z', 'zip': 'Z', 'zone': 'Z', 'zoo': 'Z',

  // Numbers - digits
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',

  // Numbers - words
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  'niner': '9', // Ham radio convention

  // Number carrier phrases (e.g., "number two")
  'number zero': '0', 'number one': '1', 'number two': '2', 'number three': '3',
  'number four': '4', 'number five': '5', 'number six': '6', 'number seven': '7',
  'number eight': '8', 'number nine': '9',

  // Spanish numbers
  'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
  'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',

  // German numbers
  'null': '0', 'eins': '1', 'zwei': '2', 'drei': '3', 'vier': '4',
  'fünf': '5', 'funf': '5', 'sechs': '6', 'sieben': '7', 'acht': '8', 'neun': '9',
  // German number sound-alikes (how speech recognition might hear them)
  'zvi': '2', 'svai': '2', 'drai': '3', 'fear': '4', 'feer': '4',
  'zex': '6', 'ziben': '7', 'noin': '9',

  // Number misrecognitions and sound-alikes
  'to': '2', 'too': '2', 'for': '4', 'ate': '8', 'won': '1',
  'tree': '3', 'free': '3', 'fiver': '5', 'sicks': '6',
  // Additional number sound-alikes
  'hero': '0', 'cheerio': '0',
  'juan': '1', 'want': '1', 'wand': '1', 'run': '1', 'done': '1', 'sun': '1', 'bun': '1',
  'tu': '2', 'tooth': '2', 'true': '2', 'through': '2', 'stew': '2', 'do': '2', 'dew': '2', 'due': '2', 'new': '2', 'knew': '2',
  'treat': '3', 'street': '3', 'agree': '3', 'decree': '3',
  'floor': '4', 'more': '4', 'door': '4', 'shore': '4', 'core': '4', 'store': '4', 'pour': '4', 'bore': '4', 'war': '4', 'roar': '4',
  'hive': '5', 'dive': '5', 'drive': '5', 'alive': '5', 'jive': '5', 'thrive': '5', 'strive': '5',
  'sick': '6', 'fix': '6', 'mix': '6', 'kicks': '6', 'clicks': '6', 'tricks': '6', 'picks': '6', 'sticks': '6', 'bricks': '6', 'dicks': '6',
  'heaven': '7', 'kevin': '7', 'eleven': '7', 'leaven': '7',
  'wait': '8', 'weight': '8', 'late': '8', 'gate': '8', 'great': '8', 'fate': '8', 'rate': '8', 'state': '8', 'plate': '8', 'date': '8', 'mate': '8', 'bait': '8', 'straight': '8',
  'mind': '9', 'line': '9', 'fine': '9', 'dine': '9', 'mine': '9', 'pine': '9', 'sign': '9', 'shine': '9', 'whine': '9', 'vine': '9', 'spine': '9', 'divine': '9',

  // Punctuation
  'period': '.', 'dot': '.', 'stop': '.', 'full stop': '.', '.': '.',
  'comma': ',', ',': ',',
  'question': '?', 'query': '?', 'question mark': '?', '?': '?',
  'slash': '/', 'stroke': '/', 'forward slash': '/', '/': '/',

  // Prosigns (displayed as BT, AR, SK) - includes NATO phonetic combos and partial recognitions
  'break': '=', 'bt': '=', 'b t': '=', 'bee tee': '=', 'bravo tango': '=', 'bravo tang': '=', 'bravo t': '=',
  'pause': '=', '=': '=', 'equals': '=',
  'a r': '+', 'alpha romeo': '+', 'alfa romeo': '+', 'alpha rome': '+', 'alfa rome': '+', 'alpha r': '+', 'alfa r': '+',
  'over': '+', 'end of message': '+', '+': '+', 'plus': '+',
  'sk': '>', 's k': '>', 'sierra kilo': '>', 'sierra kil': '>', 'sierra k': '>', 'a ok': '>', 'aok': '>',
  "that's ok": '>', 'thats ok': '>', "that's k": '>', 'thats k': '>', 'a okay': '>', "that's okay": '>', 'thats okay': '>',
  'clear': '>', 'out': '>', 'silent key': '>', 'end of contact': '>', '>': '>',
};

// Type definitions for Web Speech API
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

// Check if Web Speech API is supported
export function isSpeechRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

// Detect if we're on iOS
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Detect if we're on Android
export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

// Detect if we're on any mobile device (iOS or Android)
export function isMobile(): boolean {
  return isIOS() || isAndroid();
}

// Detect if we're using Chrome (not Edge which also has Chrome in UA)
export function isChrome(): boolean {
  return /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent);
}

// Build a reverse lookup from user calibration (heard transcript -> character)
function buildUserSpeechMap(calibration: VoiceCalibration): Record<string, string> {
  const userMap: Record<string, string> = {};
  for (const [char, transcripts] of Object.entries(calibration)) {
    for (const transcript of transcripts) {
      userMap[transcript.toLowerCase()] = char;
    }
  }
  return userMap;
}

// Normalize recognized text to a character
// When expectedChar is provided and strictNatoMode is OFF, accepts any word starting with the expected letter
export function normalizeRecognizedText(text: string, expectedChar?: string): string | null {
  const normalized = text.toLowerCase().trim();
  const settings = store.getSettings();

  // First, check user's personal calibration data (highest priority)
  const userCalibration = store.getUserSpeechMap();
  if (Object.keys(userCalibration).length > 0) {
    const userMap = buildUserSpeechMap(userCalibration);

    // Try exact match in user's calibration
    if (userMap[normalized]) {
      return userMap[normalized];
    }

    // Try first word only in user's calibration
    const firstWord = normalized.split(' ')[0];
    if (userMap[firstWord]) {
      return userMap[firstWord];
    }
  }

  // Context-aware prosign matching: when expecting a prosign, prioritize prosign forms
  // This allows 'ar' to map to '+' (AR prosign) when expecting '+', even though 'ar' normally maps to 'R'
  if (expectedChar && PROSIGN_SPOKEN_FORMS[expectedChar]) {
    const prosignForms = PROSIGN_SPOKEN_FORMS[expectedChar];
    if (prosignForms.includes(normalized) || prosignForms.includes(normalized.split(' ')[0])) {
      return expectedChar;
    }
  }

  // In strict NATO mode, only accept NATO phonetic words, single letters, and numbers/punctuation
  if (settings.strictNatoMode) {
    // Check NATO alphabet
    if (NATO_ALPHABET[normalized]) {
      return NATO_ALPHABET[normalized];
    }

    // Try first word for NATO
    const firstWord = normalized.split(' ')[0];
    if (NATO_ALPHABET[firstWord]) {
      return NATO_ALPHABET[firstWord];
    }

    // Check single letters (a-z)
    if (normalized.length === 1 && /^[a-z]$/.test(normalized)) {
      return normalized.toUpperCase();
    }

    // Check numbers and punctuation from SPEECH_MAP
    // (numbers, number words, punctuation, prosigns)
    const nonLetterEntries = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'niner',
      'to', 'too', 'for', 'ate', 'won', 'tree', 'free', 'fiver', 'sex', 'sicks',
      'period', 'dot', 'stop', 'full stop', '.', 'comma', ',',
      'question', 'query', 'question mark', '?', 'slash', 'stroke', 'forward slash', '/',
      'break', 'bt', 'pause', 'bee tee', '=', 'equals', 'equal',
      'over', 'a r', '+', 'plus', 'clear', 'sk', 'out', 'silent key', 's k', '>'];

    if (nonLetterEntries.includes(normalized) && SPEECH_MAP[normalized]) {
      return SPEECH_MAP[normalized];
    }
    if (nonLetterEntries.includes(firstWord) && SPEECH_MAP[firstWord]) {
      return SPEECH_MAP[firstWord];
    }

    return null;
  }

  // Flexible mode (strictNatoMode is OFF)
  // Fall back to default SPEECH_MAP
  // Try exact match first
  if (SPEECH_MAP[normalized]) {
    return SPEECH_MAP[normalized];
  }

  // Try first word only (speech recognition often adds extra words)
  const firstWord = normalized.split(' ')[0];
  if (SPEECH_MAP[firstWord]) {
    return SPEECH_MAP[firstWord];
  }

  // Try single letter if it's just one character
  if (normalized.length === 1 && SPEECH_MAP[normalized]) {
    return SPEECH_MAP[normalized];
  }

  // NEW: Flexible mode - accept any word starting with the expected letter (A-Z only)
  if (expectedChar && /^[A-Z]$/.test(expectedChar.toUpperCase())) {
    // Get the first letter of the spoken word
    const spokenFirstLetter = firstWord.charAt(0).toUpperCase();
    if (spokenFirstLetter === expectedChar.toUpperCase()) {
      return expectedChar.toUpperCase();
    }
  }

  return null;
}

// SpeechRecognition wrapper class
export class SpeechRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private onResultCallback: ((result: RecognitionResult) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onRawCallback: ((rawTranscript: string, normalized: string | null) => void) | null = null;
  private onEndCallback: (() => void) | null = null; // Called when recognition ends unexpectedly
  private firstSpeechTime: number | null = null; // Track when user started speaking
  private expectedChar: string | null = null; // Expected character for flexible mode validation

  // Continuous mode: keep recognition running, only process results when accepting
  private continuousMode = false;
  private isAcceptingResults = false;
  private lastIgnoredResultIndex = -1; // The resultIndex when we last called ignoreResults()
  private callsignMode = false; // When true, wait for longer transcripts (multi-word callsigns)
  private minWordCount = 1; // Minimum number of words before accepting (for callsign mode)

  constructor() {
    if (!isSpeechRecognitionSupported()) {
      console.warn('Web Speech API not supported');
      return;
    }
    // Don't create recognition instance here - create it fresh on each start()
  }

  private createRecognitionInstance(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass() as SpeechRecognitionInstance;

    // Configure - continuous mode keeps listening without stopping
    this.recognition.continuous = this.continuousMode;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  // Enable continuous mode - recognition stays active, use acceptResults/ignoreResults to control
  setContinuousMode(enabled: boolean): void {
    this.continuousMode = enabled;
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    // Debug: track all recognition lifecycle events
    (this.recognition as any).onstart = () => {
      console.log('SpeechRecognizer onstart - recognition service started');
    };
    (this.recognition as any).onaudiostart = () => {
      console.log('SpeechRecognizer onaudiostart - audio capture started');
    };
    (this.recognition as any).onsoundstart = () => {
      console.log('SpeechRecognizer onsoundstart - sound detected');
    };
    (this.recognition as any).onspeechstart = () => {
      console.log('SpeechRecognizer onspeechstart - speech detected');
    };
    (this.recognition as any).onspeechend = () => {
      console.log('SpeechRecognizer onspeechend - speech ended');
    };
    (this.recognition as any).onsoundend = () => {
      console.log('SpeechRecognizer onsoundend - sound ended');
    };
    (this.recognition as any).onaudioend = () => {
      console.log('SpeechRecognizer onaudioend - audio capture ended');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      // In continuous mode, ignore results when not accepting (e.g., during audio playback)
      if (this.continuousMode && !this.isAcceptingResults) {
        return;
      }

      // In continuous mode, only handle one result per round
      if (this.continuousMode && this.resultAlreadyHandled) {
        return;
      }

      // Track the highest result index we've seen (used by ignoreResults to set cutoff)
      if (event.resultIndex > this.lastProcessedResultIndex) {
        this.lastProcessedResultIndex = event.resultIndex;
      }

      // In continuous mode, reject results from before we started accepting
      // This prevents stale buffered results from previous utterances from being processed
      if (this.continuousMode && event.resultIndex <= this.lastIgnoredResultIndex) {
        console.log('Rejecting stale result (index', event.resultIndex, '<= lastIgnored', this.lastIgnoredResultIndex, ')');
        return;
      }

      // Record first speech time when we first detect any speech
      const now = performance.now();
      if (this.firstSpeechTime === null) {
        this.firstSpeechTime = now;
        console.log('First speech detected, resultIndex:', event.resultIndex);
      }

      // Get the most confident result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const isWordMode = this.expectedChar === null;

        // In word mode, handle results differently
        if (isWordMode) {
          if (result.length > 0) {
            const transcript = result[0].transcript.trim();
            const confidence = result[0].confidence;

            // Report raw transcript for debugging
            if (this.onRawCallback) {
              const status = result.isFinal ? '' : ' (listening...)';
              this.onRawCallback(transcript, transcript + status);
            }

            // Count words in transcript
            const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;

            // Send the result if:
            // 1. It's marked as final, OR
            // 2. For regular word mode: short transcript (1-5 chars)
            // 3. For callsign mode: wait for minimum word count before accepting interim results
            const isShortWord = transcript.length > 0 && transcript.length <= 5;
            const hasEnoughWords = wordCount >= this.minWordCount;
            const shouldSend = result.isFinal || (isShortWord && !this.callsignMode) || (this.callsignMode && hasEnoughWords && !result.isFinal);

            // In callsign mode with enough words but not final, wait a bit more for additional words
            // Only send interim results if we've been speaking for a while (prevents cutting off early)
            if (this.callsignMode && !result.isFinal && hasEnoughWords) {
              // Don't send yet - let the speech API finalize to capture more words
              continue;
            }

            if (shouldSend && transcript.length > 0 && this.onResultCallback) {
              const responseTimestamp = this.firstSpeechTime;
              this.resultAlreadyHandled = true;

              this.onResultCallback({
                transcript: transcript,
                rawTranscript: transcript,
                confidence,
                timestamp: responseTimestamp,
              });

              if (this.continuousMode) {
                this.isAcceptingResults = false;
              } else {
                this.stop();
              }
              return;
            }
          }
          continue; // Skip character mode processing for word mode
        }

        // Character mode: try all alternatives looking for a recognized character
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript;
          const confidence = result[j].confidence;

          const normalizedChar = normalizeRecognizedText(transcript, this.expectedChar || undefined);

          // Always report raw transcript for debugging
          if (this.onRawCallback) {
            this.onRawCallback(transcript, normalizedChar);
          }

          if (normalizedChar && this.onResultCallback) {
            // Use first speech time for accurate response measurement
            const responseTimestamp = this.firstSpeechTime;

            // Mark as handled to prevent duplicate results from same speech
            this.resultAlreadyHandled = true;

            this.onResultCallback({
              transcript: normalizedChar,
              rawTranscript: transcript,
              confidence,
              timestamp: responseTimestamp,
            });

            // In continuous mode, just stop accepting (don't stop recognition)
            // In normal mode, stop listening after successful recognition
            if (result.isFinal) {
              if (this.continuousMode) {
                this.isAcceptingResults = false;
              } else {
                this.stop();
              }
            }
            return;
          }
        }

        // If this is a final result and we didn't find a match in any alternative,
        // report it as unrecognized so it counts as wrong (character mode only)
        if (result.isFinal && result.length > 0 && this.onResultCallback && this.expectedChar !== null) {
          const transcript = result[0].transcript.trim();
          // Only report if there's actual speech content (not empty)
          if (transcript.length > 0) {
            const responseTimestamp = this.firstSpeechTime;

            // Mark as handled
            this.resultAlreadyHandled = true;

            // Send the raw transcript as-is (will be compared and fail)
            // Use a special marker to indicate unrecognized speech
            this.onResultCallback({
              transcript: `[unrecognized:${transcript}]`,
              rawTranscript: transcript,
              confidence: result[0].confidence,
              timestamp: responseTimestamp,
            });

            if (this.continuousMode) {
              this.isAcceptingResults = false;
            } else {
              this.stop();
            }
            return;
          }
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('SpeechRecognizer onerror:', event.error);

      // no-speech and aborted are normal in continuous mode - let onend handle restart
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // In continuous mode, don't stop listening - let onend auto-restart
        if (!this.continuousMode) {
          this.isListening = false;
        }
        return;
      }

      // Log actual errors
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(event.error);
      }
    };

    this.recognition.onend = () => {
      console.log('SpeechRecognizer onend, continuousMode:', this.continuousMode, 'isListening:', this.isListening);

      // In continuous mode, auto-restart to keep listening
      if (this.continuousMode && this.isListening) {
        console.log('Continuous mode: auto-restarting recognition');
        try {
          // Create a fresh instance for Android compatibility
          // Android Chrome doesn't handle restarting the same instance well
          this.createRecognitionInstance();
          // Reset result tracking since new instance starts with resultIndex 0
          this.lastIgnoredResultIndex = -1;
          this.lastProcessedResultIndex = -1;
          this.recognition?.start();
        } catch (err) {
          console.error('Failed to restart recognition:', err);
          this.isListening = false;
        }
        return;
      }

      // In non-continuous mode, if we were still supposed to be listening
      // (recognition ended due to no-speech timeout), notify the caller
      const wasListening = this.isListening;
      this.isListening = false;

      if (wasListening && this.onEndCallback) {
        console.log('Recognition ended unexpectedly, notifying caller');
        this.onEndCallback();
      }
    };
  }

  start(): void {
    if (!isSpeechRecognitionSupported()) {
      console.error('Speech recognition not available');
      return;
    }

    // Create a fresh recognition instance each time
    // iOS Safari requires this - reusing instances causes failures
    this.createRecognitionInstance();

    this.isListening = true;
    this.firstSpeechTime = null; // Reset for new listening session

    // Reset result tracking for fresh instance
    // New WebKit instance starts resultIndex at 0, so we must reset these
    // otherwise stale detection will reject all results
    this.lastIgnoredResultIndex = -1;
    this.lastProcessedResultIndex = -1;
    this.resultAlreadyHandled = false;

    try {
      console.log('SpeechRecognizer starting...');
      this.recognition!.start();
      console.log('SpeechRecognizer started');
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      this.isListening = false;
    }
  }

  stop(): void {
    console.log('SpeechRecognizer stop() called, recognition exists:', !!this.recognition, 'isListening:', this.isListening);
    this.isListening = false;
    this.isAcceptingResults = false;
    if (this.recognition) {
      console.log('SpeechRecognizer: calling recognition.stop() now');
      try {
        this.recognition.stop();
        console.log('SpeechRecognizer: recognition.stop() succeeded');
      } catch (err) {
        console.log('SpeechRecognizer: recognition.stop() threw:', err);
        // Already stopped, ignore
      }
      // Don't null the instance here - iOS needs it alive for the stop chime
      // The instance will be replaced on next start() anyway
    } else {
      console.log('SpeechRecognizer: no recognition instance to stop!');
    }
  }

  // Full reset - clears all state for a fresh start
  reset(): void {
    console.log('SpeechRecognizer reset() called');
    this.stop();
    // Clear the instance after stop
    this.recognition = null;
    this.lastIgnoredResultIndex = -1;
    this.lastProcessedResultIndex = -1;
    this.resultAlreadyHandled = false;
    this.firstSpeechTime = null;
  }

  // Start accepting results (for continuous mode)
  acceptResults(): void {
    this.isAcceptingResults = true;
    this.firstSpeechTime = null; // Reset for new listening window
    this.resultAlreadyHandled = false; // Allow new result
    console.log('Accepting results, will reject resultIndex <=', this.lastIgnoredResultIndex);
  }

  // Track if we already handled a result this round (prevent duplicates)
  private resultAlreadyHandled = false;
  // Track the last result index we processed (to reject stale results after)
  private lastProcessedResultIndex = -1;

  // Stop accepting results but keep recognition running (for continuous mode)
  // Also records the last processed result index so we can reject stale buffered results
  ignoreResults(): void {
    this.isAcceptingResults = false;
    // Mark the current result index as the cutoff - any results at or below this
    // will be rejected when we start accepting again
    this.lastIgnoredResultIndex = this.lastProcessedResultIndex;
    console.log('Ignoring results, lastIgnoredResultIndex set to:', this.lastIgnoredResultIndex);
  }

  // Set the expected character for flexible mode validation
  setExpectedChar(char: string | null): void {
    this.expectedChar = char;
  }

  // Set callsign mode - waits for longer transcripts before finalizing
  setCallsignMode(enabled: boolean, expectedLength: number = 3): void {
    this.callsignMode = enabled;
    // For callsigns, expect at least as many words as characters in the callsign
    this.minWordCount = enabled ? expectedLength : 1;
    console.log('Callsign mode:', enabled, 'minWordCount:', this.minWordCount);
  }

  onResult(callback: (result: RecognitionResult) => void): void {
    this.onResultCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  // Callback for ALL raw transcripts (even unrecognized ones) - useful for debugging
  onRaw(callback: (rawTranscript: string, normalized: string | null) => void): void {
    this.onRawCallback = callback;
  }

  // Callback when recognition ends unexpectedly (e.g., no-speech timeout in non-continuous mode)
  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  isActive(): boolean {
    return this.isListening;
  }
}
