// Character history for a single character
export interface CharacterHistory {
  wma: number; // Weighted moving average response time (ms)
  mostRecent: number; // Most recent response time (ms)
  totalAttempts: number;
  correctAttempts: number;
  lastPracticed: number; // timestamp
}

// Word character history - tracks character progress via word practice
export interface WordCharacterHistory {
  wma: number; // Weighted moving average response time (ms)
  mostRecent: number; // Most recent response time (ms)
  totalAttempts: number; // Times this char appeared in practiced words
  correctAttempts: number; // Times correctly identified in words
  lastPracticed: number; // timestamp
}

// Word history state (keyed by character)
export interface WordHistoryState {
  [char: string]: WordCharacterHistory;
}

// Callsign character history - tracks character progress via callsign practice
export interface CallsignCharacterHistory {
  wma: number; // Weighted moving average response time (ms)
  mostRecent: number; // Most recent response time (ms)
  totalAttempts: number; // Times this char appeared in practiced callsigns
  correctAttempts: number; // Times correctly identified in callsigns
  lastPracticed: number; // timestamp
}

// Callsign history state (keyed by character)
export interface CallsignHistoryState {
  [char: string]: CallsignCharacterHistory;
}

// Practice mode
export type PracticeMode = 'character' | 'word' | 'callsign';

// Word mode settings
export interface WordModeSettings {
  practiceMode: PracticeMode;
  wordLength: 3 | 4 | 5;
}

// Callsign mode settings
export interface CallsignModeSettings {
  enabledFormats: string[]; // ['1x1', '1x2', '2x1', '2x2', '1x3', '2x3']
}

// Full history state
export interface HistoryState {
  [char: string]: CharacterHistory;
}

// App settings
export interface Settings {
  characterSpeed: number; // WPM (15-40)
  adaptiveGain: number; // 0-100
  toneFrequency: number; // Hz (400-1000)
  volume: number; // 0-1
  repeatUntilCorrect: boolean; // Repeat wrong characters until correct
  maxRepeatTries: number; // Max tries before showing answer (1-5, 6=unlimited)
  strictNatoMode: boolean; // When true, only accept NATO phonetic words and single letters
}

// Character set configuration
export interface CharacterSetConfig {
  selectedSets: string[];
  included: string[]; // Manually included characters
  excluded: string[]; // Manually excluded characters
}

// Current practice session state
export interface SessionState {
  isRunning: boolean;
  currentChar: string | null;
  charPlayedAt: number; // timestamp when audio finished
  sessionStartTime: number;
  totalCharsThisSession: number;
  lastBreakReminder: number;
}

// Complete app state
export interface AppState {
  settings: Settings;
  characterSet: CharacterSetConfig;
  history: HistoryState;
  wordHistory: WordHistoryState;
  callsignHistory: CallsignHistoryState;
  wordModeSettings: WordModeSettings;
  callsignModeSettings: CallsignModeSettings;
  session: SessionState;
  voiceCalibration: CalibrationState;
  pronunciationAliases: PronunciationAliases; // For character mode
  wordPronunciationAliases: PronunciationAliases; // For word mode
}

// Speech recognition result
export interface RecognitionResult {
  transcript: string; // Normalized character (e.g., 'E')
  rawTranscript: string; // What was actually heard (e.g., 'he', 'echo')
  confidence: number;
  timestamp: number;
}

// Event types for the event bus
export type AppEvents = {
  'settings:changed': Settings;
  'history:updated': HistoryState;
  'wordHistory:updated': WordHistoryState;
  'callsignHistory:updated': CallsignHistoryState;
  'wordModeSettings:changed': WordModeSettings;
  'callsignModeSettings:changed': CallsignModeSettings;
  'session:started': void;
  'session:stopped': void;
  'character:played': string;
  'character:recognized': { char: string; correct: boolean; responseTime: number };
  'word:played': string;
  'word:recognized': { word: string; correct: boolean; responseTime: number };
  'callsign:played': string;
  'callsign:recognized': { callsign: string; correct: boolean; responseTime: number };
  'break:reminder': void;
};

// History file format for save/restore
export interface HistoryFile {
  version: string;
  exportedAt: string;
  settings: Settings;
  characterSet: CharacterSetConfig;
  characters: HistoryState;
  wordCharacters?: WordHistoryState;
  callsignCharacters?: CallsignHistoryState;
  wordModeSettings?: WordModeSettings;
  callsignModeSettings?: CallsignModeSettings;
  pronunciationAliases?: PronunciationAliases;
  wordPronunciationAliases?: PronunciationAliases;
}

// Voice calibration - stores what the speech API hears when user says each character
export interface VoiceCalibration {
  [char: string]: string[]; // Character -> array of heard transcripts (e.g., 'E' -> ['he', 'heat', 'e'])
}

// Pronunciation aliases - user-confirmed mappings from misheard text to expected character/word
// Different from VoiceCalibration: these are explicitly accepted by user during practice
export interface PronunciationAliases {
  [expected: string]: string[]; // Expected char/word -> array of accepted misheard transcripts
}

// Calibration state
export interface CalibrationState {
  isCalibrated: boolean;
  calibratedAt: number; // timestamp
  calibration: VoiceCalibration;
}
