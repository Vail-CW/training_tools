import type {
  AppState,
  Settings,
  CharacterSetConfig,
  HistoryState,
  SessionState,
  CharacterHistory,
  CalibrationState,
  VoiceCalibration,
  WordHistoryState,
  WordCharacterHistory,
  CallsignHistoryState,
  CallsignCharacterHistory,
  WordModeSettings,
  CallsignModeSettings,
  PronunciationAliases,
} from '../types';
import { getDefaultWMA } from '../core/weighted-average';
import { DEFAULT_CHARACTER_SET, getActiveCharacters } from '../data/character-sets';

// Default settings
const DEFAULT_SETTINGS: Settings = {
  characterSpeed: 25,
  adaptiveGain: 50,
  toneFrequency: 700,
  volume: 0.5,
  repeatUntilCorrect: false,
  maxRepeatTries: 6, // 1-5 = limited tries, 6 = unlimited
  strictNatoMode: false, // Default: accept any word starting with the correct letter
};

// Default session state
const DEFAULT_SESSION: SessionState = {
  isRunning: false,
  currentChar: null,
  charPlayedAt: 0,
  sessionStartTime: 0,
  totalCharsThisSession: 0,
  lastBreakReminder: 0,
};

// Default calibration state
const DEFAULT_CALIBRATION: CalibrationState = {
  isCalibrated: false,
  calibratedAt: 0,
  calibration: {},
};

// Default word mode settings
const DEFAULT_WORD_MODE_SETTINGS: WordModeSettings = {
  practiceMode: 'character',
  wordLength: 3,
};

// Default callsign mode settings
const DEFAULT_CALLSIGN_MODE_SETTINGS: CallsignModeSettings = {
  enabledFormats: ['2x3'], // Default to most common format
};

// Event listener type
type Listener<T> = (value: T) => void;

// Simple reactive store
class Store {
  private state: AppState;
  private listeners: Map<string, Set<Listener<unknown>>> = new Map();

  constructor() {
    this.state = this.loadFromStorage() || this.getDefaultState();
  }

  private getDefaultState(): AppState {
    return {
      settings: { ...DEFAULT_SETTINGS },
      characterSet: { ...DEFAULT_CHARACTER_SET },
      history: {},
      wordHistory: {},
      callsignHistory: {},
      wordModeSettings: { ...DEFAULT_WORD_MODE_SETTINGS },
      callsignModeSettings: { ...DEFAULT_CALLSIGN_MODE_SETTINGS },
      session: { ...DEFAULT_SESSION },
      voiceCalibration: { ...DEFAULT_CALIBRATION },
      pronunciationAliases: {},
      wordPronunciationAliases: {},
    };
  }

  private loadFromStorage(): AppState | null {
    try {
      const stored = localStorage.getItem('morse-icr-state');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle missing properties
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          characterSet: { ...DEFAULT_CHARACTER_SET, ...parsed.characterSet },
          history: parsed.history || {},
          wordHistory: parsed.wordHistory || {},
          callsignHistory: parsed.callsignHistory || {},
          wordModeSettings: { ...DEFAULT_WORD_MODE_SETTINGS, ...parsed.wordModeSettings },
          callsignModeSettings: { ...DEFAULT_CALLSIGN_MODE_SETTINGS, ...parsed.callsignModeSettings },
          session: { ...DEFAULT_SESSION }, // Don't restore session state
          voiceCalibration: { ...DEFAULT_CALIBRATION, ...parsed.voiceCalibration },
          pronunciationAliases: parsed.pronunciationAliases || {},
          wordPronunciationAliases: parsed.wordPronunciationAliases || {},
        };
      }
    } catch (e) {
      console.error('Failed to load state from storage:', e);
    }
    return null;
  }

  private saveToStorage(): void {
    try {
      const toSave = {
        settings: this.state.settings,
        characterSet: this.state.characterSet,
        history: this.state.history,
        wordHistory: this.state.wordHistory,
        callsignHistory: this.state.callsignHistory,
        wordModeSettings: this.state.wordModeSettings,
        callsignModeSettings: this.state.callsignModeSettings,
        voiceCalibration: this.state.voiceCalibration,
        pronunciationAliases: this.state.pronunciationAliases,
        wordPronunciationAliases: this.state.wordPronunciationAliases,
      };
      localStorage.setItem('morse-icr-state', JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save state to storage:', e);
    }
  }

  private emit(key: string, value: unknown): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach((listener) => listener(value));
    }

    // Also emit to wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((listener) => listener(this.state));
    }
  }

  // Subscribe to state changes
  subscribe<K extends keyof AppState>(
    key: K,
    listener: Listener<AppState[K]>
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as Listener<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener as Listener<unknown>);
    };
  }

  // Get current state
  getState(): AppState {
    return this.state;
  }

  // Settings
  getSettings(): Settings {
    return this.state.settings;
  }

  updateSettings(updates: Partial<Settings>): void {
    this.state.settings = { ...this.state.settings, ...updates };
    this.saveToStorage();
    this.emit('settings', this.state.settings);
  }

  // Character set
  getCharacterSet(): CharacterSetConfig {
    return this.state.characterSet;
  }

  getActiveCharacters(): string[] {
    const { selectedSets, included, excluded } = this.state.characterSet;
    return getActiveCharacters(selectedSets, included, excluded);
  }

  updateCharacterSet(updates: Partial<CharacterSetConfig>): void {
    this.state.characterSet = { ...this.state.characterSet, ...updates };
    this.saveToStorage();
    this.emit('characterSet', this.state.characterSet);
  }

  // History
  getHistory(): HistoryState {
    return this.state.history;
  }

  getCharacterHistory(char: string): CharacterHistory {
    return (
      this.state.history[char] || {
        wma: getDefaultWMA(),
        mostRecent: getDefaultWMA(),
        totalAttempts: 0,
        correctAttempts: 0,
        lastPracticed: 0,
      }
    );
  }

  updateCharacterHistory(char: string, updates: Partial<CharacterHistory>): void {
    const current = this.getCharacterHistory(char);
    this.state.history[char] = { ...current, ...updates };
    this.saveToStorage();
    this.emit('history', this.state.history);
  }

  setHistory(history: HistoryState): void {
    this.state.history = history;
    this.saveToStorage();
    this.emit('history', this.state.history);
  }

  resetHistory(): void {
    this.state.history = {};
    this.saveToStorage();
    this.emit('history', this.state.history);
  }

  // Revert a character attempt (undo the last history update)
  revertCharacterAttempt(char: string, wasCorrect: boolean, previousWMA: number, previousMostRecent: number): void {
    const history = this.getCharacterHistory(char);
    if (history.totalAttempts <= 0) return;

    this.state.history[char] = {
      ...history,
      wma: previousWMA,
      mostRecent: previousMostRecent,
      totalAttempts: history.totalAttempts - 1,
      correctAttempts: history.correctAttempts - (wasCorrect ? 1 : 0),
    };
    this.saveToStorage();
    this.emit('history', this.state.history);
  }

  // Word History (character progress via word practice)
  getWordHistory(): WordHistoryState {
    return this.state.wordHistory;
  }

  getWordCharacterHistory(char: string): WordCharacterHistory {
    return (
      this.state.wordHistory[char] || {
        wma: getDefaultWMA(),
        mostRecent: getDefaultWMA(),
        totalAttempts: 0,
        correctAttempts: 0,
        lastPracticed: 0,
      }
    );
  }

  updateWordCharacterHistory(char: string, updates: Partial<WordCharacterHistory>): void {
    const current = this.getWordCharacterHistory(char);
    this.state.wordHistory[char] = { ...current, ...updates };
    this.saveToStorage();
    this.emit('wordHistory', this.state.wordHistory);
  }

  setWordHistory(history: WordHistoryState): void {
    this.state.wordHistory = history;
    this.saveToStorage();
    this.emit('wordHistory', this.state.wordHistory);
  }

  resetWordHistory(): void {
    this.state.wordHistory = {};
    this.saveToStorage();
    this.emit('wordHistory', this.state.wordHistory);
  }

  // Revert word character attempts (undo the last history update for each char in word)
  revertWordCharacterAttempts(
    chars: string[],
    wasCorrect: boolean,
    previousWMAs: Record<string, { wma: number; mostRecent: number }>
  ): void {
    for (const char of chars) {
      const history = this.getWordCharacterHistory(char);
      if (history.totalAttempts <= 0) continue;

      const prev = previousWMAs[char];
      if (!prev) continue;

      this.state.wordHistory[char] = {
        ...history,
        wma: prev.wma,
        mostRecent: prev.mostRecent,
        totalAttempts: history.totalAttempts - 1,
        correctAttempts: history.correctAttempts - (wasCorrect ? 1 : 0),
      };
    }
    this.saveToStorage();
    this.emit('wordHistory', this.state.wordHistory);
  }

  // Callsign History (character progress via callsign practice)
  getCallsignHistory(): CallsignHistoryState {
    return this.state.callsignHistory;
  }

  getCallsignCharacterHistory(char: string): CallsignCharacterHistory {
    return (
      this.state.callsignHistory[char] || {
        wma: getDefaultWMA(),
        mostRecent: getDefaultWMA(),
        totalAttempts: 0,
        correctAttempts: 0,
        lastPracticed: 0,
      }
    );
  }

  updateCallsignCharacterHistory(char: string, updates: Partial<CallsignCharacterHistory>): void {
    const current = this.getCallsignCharacterHistory(char);
    this.state.callsignHistory[char] = { ...current, ...updates };
    this.saveToStorage();
    this.emit('callsignHistory', this.state.callsignHistory);
  }

  setCallsignHistory(history: CallsignHistoryState): void {
    this.state.callsignHistory = history;
    this.saveToStorage();
    this.emit('callsignHistory', this.state.callsignHistory);
  }

  resetCallsignHistory(): void {
    this.state.callsignHistory = {};
    this.saveToStorage();
    this.emit('callsignHistory', this.state.callsignHistory);
  }

  // Revert callsign character attempts (undo the last history update for each char in callsign)
  revertCallsignCharacterAttempts(
    chars: string[],
    wasCorrect: boolean,
    previousWMAs: Record<string, { wma: number; mostRecent: number }>
  ): void {
    for (const char of chars) {
      const history = this.getCallsignCharacterHistory(char);
      if (history.totalAttempts <= 0) continue;

      const prev = previousWMAs[char];
      if (!prev) continue;

      this.state.callsignHistory[char] = {
        ...history,
        wma: prev.wma,
        mostRecent: prev.mostRecent,
        totalAttempts: history.totalAttempts - 1,
        correctAttempts: history.correctAttempts - (wasCorrect ? 1 : 0),
      };
    }
    this.saveToStorage();
    this.emit('callsignHistory', this.state.callsignHistory);
  }

  // Word Mode Settings
  getWordModeSettings(): WordModeSettings {
    return this.state.wordModeSettings;
  }

  updateWordModeSettings(updates: Partial<WordModeSettings>): void {
    this.state.wordModeSettings = { ...this.state.wordModeSettings, ...updates };
    this.saveToStorage();
    this.emit('wordModeSettings', this.state.wordModeSettings);
  }

  // Callsign Mode Settings
  getCallsignModeSettings(): CallsignModeSettings {
    return this.state.callsignModeSettings;
  }

  updateCallsignModeSettings(updates: Partial<CallsignModeSettings>): void {
    this.state.callsignModeSettings = { ...this.state.callsignModeSettings, ...updates };
    this.saveToStorage();
    this.emit('callsignModeSettings', this.state.callsignModeSettings);
  }

  // Session
  getSession(): SessionState {
    return this.state.session;
  }

  updateSession(updates: Partial<SessionState>): void {
    this.state.session = { ...this.state.session, ...updates };
    this.emit('session', this.state.session);
  }

  startSession(): void {
    this.updateSession({
      isRunning: true,
      sessionStartTime: Date.now(),
      totalCharsThisSession: 0,
      lastBreakReminder: Date.now(),
    });
  }

  stopSession(): void {
    this.updateSession({
      isRunning: false,
      currentChar: null,
    });
  }

  // Voice calibration
  getVoiceCalibration(): CalibrationState {
    return this.state.voiceCalibration;
  }

  isVoiceCalibrated(): boolean {
    return this.state.voiceCalibration.isCalibrated;
  }

  getCalibrationForChar(char: string): string[] {
    return this.state.voiceCalibration.calibration[char] || [];
  }

  // Add a heard transcript for a character during calibration
  addCalibrationEntry(char: string, heardTranscript: string): void {
    const current = this.state.voiceCalibration.calibration[char] || [];
    // Avoid duplicates
    if (!current.includes(heardTranscript.toLowerCase())) {
      this.state.voiceCalibration.calibration[char] = [...current, heardTranscript.toLowerCase()];
      this.saveToStorage();
      this.emit('voiceCalibration', this.state.voiceCalibration);
    }
  }

  // Set full calibration for a character (replaces existing)
  setCalibrationForChar(char: string, transcripts: string[]): void {
    this.state.voiceCalibration.calibration[char] = transcripts.map(t => t.toLowerCase());
    this.saveToStorage();
    this.emit('voiceCalibration', this.state.voiceCalibration);
  }

  // Mark calibration as complete
  completeCalibration(): void {
    this.state.voiceCalibration.isCalibrated = true;
    this.state.voiceCalibration.calibratedAt = Date.now();
    this.saveToStorage();
    this.emit('voiceCalibration', this.state.voiceCalibration);
  }

  // Clear all calibration data
  clearCalibration(): void {
    this.state.voiceCalibration = { ...DEFAULT_CALIBRATION };
    this.saveToStorage();
    this.emit('voiceCalibration', this.state.voiceCalibration);
  }

  // Get the full user calibration map (for use in speech recognition)
  getUserSpeechMap(): VoiceCalibration {
    return this.state.voiceCalibration.calibration;
  }

  // Pronunciation Aliases - user-confirmed mappings from misheard text to expected character/word

  // Get all aliases for character mode
  getPronunciationAliases(): PronunciationAliases {
    return this.state.pronunciationAliases;
  }

  // Get all aliases for word mode
  getWordPronunciationAliases(): PronunciationAliases {
    return this.state.wordPronunciationAliases;
  }

  // Get aliases for a specific expected character/word
  getAliasesFor(expected: string, isWordMode: boolean): string[] {
    const aliases = isWordMode
      ? this.state.wordPronunciationAliases
      : this.state.pronunciationAliases;
    return aliases[expected.toUpperCase()] || [];
  }

  // Add a pronunciation alias (user accepted a misheard response)
  addPronunciationAlias(expected: string, heardText: string, isWordMode: boolean): void {
    const key = expected.toUpperCase();
    const normalizedHeard = heardText.toUpperCase().trim();

    // Don't add empty or very long strings
    if (!normalizedHeard || normalizedHeard.length > 50) return;

    const aliases = isWordMode
      ? this.state.wordPronunciationAliases
      : this.state.pronunciationAliases;

    const current = aliases[key] || [];

    // Avoid duplicates
    if (!current.includes(normalizedHeard)) {
      if (isWordMode) {
        this.state.wordPronunciationAliases[key] = [...current, normalizedHeard];
        this.emit('wordPronunciationAliases', this.state.wordPronunciationAliases);
      } else {
        this.state.pronunciationAliases[key] = [...current, normalizedHeard];
        this.emit('pronunciationAliases', this.state.pronunciationAliases);
      }
      this.saveToStorage();
    }
  }

  // Check if a heard transcript matches an alias for the expected character/word
  matchesAlias(expected: string, heardText: string, isWordMode: boolean): boolean {
    const aliases = this.getAliasesFor(expected, isWordMode);
    const normalizedHeard = heardText.toUpperCase().trim();
    return aliases.includes(normalizedHeard);
  }

  // Remove a specific alias
  removeAlias(expected: string, alias: string, isWordMode: boolean): void {
    const key = expected.toUpperCase();
    const normalizedAlias = alias.toUpperCase().trim();

    const aliases = isWordMode
      ? this.state.wordPronunciationAliases
      : this.state.pronunciationAliases;

    const current = aliases[key] || [];
    const filtered = current.filter(a => a !== normalizedAlias);

    if (isWordMode) {
      this.state.wordPronunciationAliases[key] = filtered;
      this.emit('wordPronunciationAliases', this.state.wordPronunciationAliases);
    } else {
      this.state.pronunciationAliases[key] = filtered;
      this.emit('pronunciationAliases', this.state.pronunciationAliases);
    }
    this.saveToStorage();
  }

  // Clear all pronunciation aliases
  clearAllAliases(isWordMode: boolean): void {
    if (isWordMode) {
      this.state.wordPronunciationAliases = {};
      this.emit('wordPronunciationAliases', this.state.wordPronunciationAliases);
    } else {
      this.state.pronunciationAliases = {};
      this.emit('pronunciationAliases', this.state.pronunciationAliases);
    }
    this.saveToStorage();
  }

  // Full state import (for restore from file)
  importState(imported: Partial<AppState>): void {
    if (imported.settings) {
      this.state.settings = { ...DEFAULT_SETTINGS, ...imported.settings };
    }
    if (imported.characterSet) {
      this.state.characterSet = { ...DEFAULT_CHARACTER_SET, ...imported.characterSet };
    }
    if (imported.history) {
      this.state.history = imported.history;
    }
    if (imported.wordHistory) {
      this.state.wordHistory = imported.wordHistory;
    }
    if (imported.callsignHistory) {
      this.state.callsignHistory = imported.callsignHistory;
    }
    if (imported.wordModeSettings) {
      this.state.wordModeSettings = { ...DEFAULT_WORD_MODE_SETTINGS, ...imported.wordModeSettings };
    }
    if (imported.callsignModeSettings) {
      this.state.callsignModeSettings = { ...DEFAULT_CALLSIGN_MODE_SETTINGS, ...imported.callsignModeSettings };
    }
    if (imported.pronunciationAliases) {
      this.state.pronunciationAliases = imported.pronunciationAliases;
    }
    if (imported.wordPronunciationAliases) {
      this.state.wordPronunciationAliases = imported.wordPronunciationAliases;
    }
    this.saveToStorage();
    this.emit('settings', this.state.settings);
    this.emit('characterSet', this.state.characterSet);
    this.emit('history', this.state.history);
    this.emit('wordHistory', this.state.wordHistory);
    this.emit('callsignHistory', this.state.callsignHistory);
    this.emit('wordModeSettings', this.state.wordModeSettings);
    this.emit('callsignModeSettings', this.state.callsignModeSettings);
    this.emit('pronunciationAliases', this.state.pronunciationAliases);
    this.emit('wordPronunciationAliases', this.state.wordPronunciationAliases);
  }
}

// Export singleton instance
export const store = new Store();
