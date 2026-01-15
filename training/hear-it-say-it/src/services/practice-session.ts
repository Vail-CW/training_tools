import { store } from '../state/store';
import { playMorseCharacter, playMorseWord, resumeAudioContext, stopAllAudio, playCorrectTone, playIncorrectTone } from '../core/morse-audio';
import { SpeechRecognizer, isSpeechRecognitionSupported, isIOS, isAndroid } from '../core/speech-recognition';
import { selectNextCharacter } from '../core/adaptive-selector';
import { selectNextWord, isWordModeAvailable } from '../core/word-selector';
import { generateRandomCallsign } from '../core/callsign-generator';
import { validateCallsign, getErrorDescription } from '../core/callsign-validator';
import { calculateWMA, calculatePenaltyTime } from '../core/weighted-average';
import { getCharDisplayName } from '../data/morse-codes';
import type { WordLength } from '../data/word-lists';


const BREAK_REMINDER_INTERVAL = 10 * 60 * 1000; // 10 minutes
const NEXT_CHAR_DELAY = 800; // Delay before next character (ms) - used for correct answers
const WRONG_ANSWER_DELAY = 6000; // Delay after wrong answer (ms) - gives time to hit "Accept My Answer"
const CALLSIGN_WRONG_DELAY = 4000; // Delay after wrong callsign (ms) - gives time to review the answer
// Web Speech API has significant latency: time from speaking to when onresult fires
// This includes audio capture, transmission to Google servers, processing, and return
// Typical values: 500-1500ms depending on connection and phrase length
const SPEECH_API_LATENCY = 1200; // Increased latency compensation (ms)

// Audio Level Monitor - shows real-time mic input during practice
class AudioLevelMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationId: number | null = null;
  private levelBar: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.container = document.getElementById('practice-level-container');
    this.levelBar = document.getElementById('practice-level');
  }

  async start(): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      this.isRunning = true;
      this.show();
      this.updateLevel();
      return true;
    } catch (err) {
      console.error('Failed to start audio level monitor:', err);
      return false;
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.hide();
  }

  show(): void {
    this.container?.classList.remove('hidden');
  }

  hide(): void {
    this.container?.classList.add('hidden');
    if (this.levelBar) {
      this.levelBar.style.width = '0%';
    }
  }

  private updateLevel(): void {
    if (!this.analyser || !this.isRunning) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);

    if (this.levelBar) {
      this.levelBar.style.width = `${level}%`;

      // Update color class based on level
      this.levelBar.classList.remove('low', 'medium', 'high');
      if (level < 20) {
        this.levelBar.classList.add('low');
      } else if (level < 50) {
        this.levelBar.classList.add('medium');
      } else {
        this.levelBar.classList.add('high');
      }
    }

    this.animationId = requestAnimationFrame(() => this.updateLevel());
  }
}

export class PracticeSession {
  private recognizer: SpeechRecognizer | null = null;
  private previousChar: string | null = null;
  private previousWord: string | null = null;
  private previousCallsign: string | null = null;
  private currentWord: string | null = null; // Track current word in word mode
  private currentCallsign: string | null = null; // Track current callsign in callsign mode
  private audioPlayedAt: number = 0;
  private breakCheckInterval: number | null = null;
  private nextCharTimeout: number | null = null;
  private isPlayingChar: boolean = false;
  // Use continuous mode on iOS to avoid jingle on each start/stop
  private useContinuousMode: boolean = false;
  // Track if we just restarted speech recognition (needs longer delay)
  private justRestartedRecognition: boolean = false;
  // Screen wake lock to prevent device sleep during practice
  private wakeLock: WakeLockSentinel | null = null;

  // Track last wrong answer for "Accept My Answer" feature
  private lastWrongAnswer: {
    expected: string;
    heard: string;
    responseTime: number;
    isWordMode: boolean;
  } | null = null;

  // Track last attempt for recovery/undo feature
  private lastAttempt: {
    type: 'character' | 'word' | 'callsign';
    value: string;
    chars: string[];
    wasCorrect: boolean;
    previousWMAs: Record<string, { wma: number; mostRecent: number }>;
  } | null = null;

  // Track repeat attempts for max tries feature
  private repeatAttempts: number = 0;

  // Audio level monitor for visual feedback
  private audioLevelMonitor: AudioLevelMonitor;

  // DOM elements
  private startBtn: HTMLButtonElement;
  private currentCharEl: HTMLElement;
  private feedbackTextEl: HTMLElement;
  private listeningIndicator: HTMLElement;
  private breakModal: HTMLElement;
  private debugHeardEl: HTMLElement;
  private acceptAnswerBtn: HTMLButtonElement;
  private recoveryBtn: HTMLButtonElement;

  constructor() {
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.currentCharEl = document.getElementById('current-char') as HTMLElement;
    this.feedbackTextEl = document.getElementById('feedback-text') as HTMLElement;
    this.listeningIndicator = document.getElementById('listening-indicator') as HTMLElement;
    this.breakModal = document.getElementById('break-modal') as HTMLElement;
    this.debugHeardEl = document.getElementById('debug-heard') as HTMLElement;
    this.acceptAnswerBtn = document.getElementById('accept-answer-btn') as HTMLButtonElement;
    this.recoveryBtn = document.getElementById('recovery-btn') as HTMLButtonElement;

    // Initialize audio level monitor
    this.audioLevelMonitor = new AudioLevelMonitor();

    // Listen for visibility changes to re-acquire wake lock when returning to app
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.setupEventListeners();
    this.initializeSpeechRecognition();
  }

  private setupEventListeners(): void {
    this.startBtn.addEventListener('click', () => this.toggleSession());

    // Accept My Answer button
    this.acceptAnswerBtn?.addEventListener('click', () => this.handleAcceptAnswer());

    // Recovery/Restart button
    this.recoveryBtn?.addEventListener('click', () => this.handleRecovery());

    // Break modal dismiss
    const dismissBtn = document.getElementById('dismiss-break');
    dismissBtn?.addEventListener('click', () => {
      this.breakModal.classList.add('hidden');
      store.updateSession({ lastBreakReminder: Date.now() });
    });

    // Subscribe to session changes
    store.subscribe('session', (session) => {
      if (session.isRunning) {
        this.startBtn.textContent = 'Pause';
        this.startBtn.classList.add('running');
        // Show recovery button when session is running
        this.recoveryBtn?.classList.remove('hidden');
      } else {
        this.startBtn.textContent = 'Start';
        this.startBtn.classList.remove('running');
        this.listeningIndicator.classList.add('hidden');
        // Hide accept button when session stops
        this.hideAcceptButton();
        // Hide recovery button when session stops
        this.recoveryBtn?.classList.add('hidden');
      }
    });
  }

  private showAcceptButton(): void {
    this.acceptAnswerBtn?.classList.remove('hidden');
  }

  private hideAcceptButton(): void {
    this.acceptAnswerBtn?.classList.add('hidden');
    this.lastWrongAnswer = null;
  }

  // Wake lock management - keeps screen awake during practice
  private async acquireWakeLock(): Promise<void> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        // Wake lock request failed (e.g., low battery mode)
      }
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  private handleVisibilityChange = async (): Promise<void> => {
    // Re-acquire wake lock when returning to the app (wake locks are released when backgrounded)
    if (document.visibilityState === 'visible' && store.getSession().isRunning) {
      await this.acquireWakeLock();
    }
  };

  // Handle recovery button - undo last attempt and restart session
  // Uses the exact same stop/start flow as the pause/start buttons
  private handleRecovery(): void {
    const session = store.getSession();
    if (!session.isRunning) return;

    console.log('Recovery triggered - will stop then restart session');

    // Revert the last attempt if there was one
    if (this.lastAttempt) {
      const { type, chars, wasCorrect, previousWMAs } = this.lastAttempt;

      if (type === 'character' && chars.length === 1) {
        const prev = previousWMAs[chars[0]];
        if (prev) {
          store.revertCharacterAttempt(chars[0], wasCorrect, prev.wma, prev.mostRecent);
        }
      } else if (type === 'word') {
        store.revertWordCharacterAttempts(chars, wasCorrect, previousWMAs);
      } else if (type === 'callsign') {
        store.revertCallsignCharacterAttempts(chars, wasCorrect, previousWMAs);
      }

      // Decrement session total
      const currentTotal = store.getSession().totalCharsThisSession;
      if (currentTotal > 0) {
        store.updateSession({ totalCharsThisSession: currentTotal - 1 });
      }

      console.log('Last attempt reverted');
      this.lastAttempt = null;
    }

    // Do exactly what the Pause button does
    this.stop();
    this.feedbackTextEl.textContent = 'Restarting in 3 seconds...';

    // After 3 seconds, do exactly what the Start button does
    setTimeout(async () => {
      // Make sure we weren't manually stopped
      if (store.getSession().isRunning) {
        // Session is still marked as running from somewhere else, stop it first
        return;
      }

      this.feedbackTextEl.textContent = 'Restarting...';
      await this.start();
    }, 3000);
  }

  // Get words that sound similar (for alias sharing)
  // Words that differ only in vowels often sound alike when spoken quickly
  private getSimilarSoundingWords(word: string): string[] {
    const upper = word.toUpperCase();

    // Define groups of similar-sounding words
    const similarGroups: string[][] = [
      ['TEN', 'TAN', 'TIN', 'TON', 'TUN'],
      ['PEN', 'PAN', 'PIN', 'PUN'],
      ['BET', 'BAT', 'BIT', 'BUT', 'BOT'],
      ['SET', 'SAT', 'SIT'],
      ['MEN', 'MAN', 'MIN'],
      ['NET', 'NAT', 'NIT', 'NUT', 'NOT'],
      ['PET', 'PAT', 'PIT', 'PUT', 'POT'],
      ['BED', 'BAD', 'BID', 'BUD'],
      ['RED', 'RAD', 'RID', 'ROD'],
      ['LED', 'LAD', 'LID'],
      ['WET', 'WAT', 'WIT'],
      ['HEN', 'HAN'],
      ['DEN', 'DAN', 'DIN', 'DON', 'DUN'],
      ['RUN', 'RAN'],
      ['SUN', 'SON'],
      ['WON', 'ONE', 'WIN'],
      ['FUN', 'FAN', 'FIN'],
      ['GUN', 'GAN'],
      ['CAN', 'CON', 'KIN'],
      ['CAP', 'COP', 'CUP'],
      ['MAP', 'MOP', 'MIP'],
      ['TAP', 'TIP', 'TOP'],
      ['RAP', 'RIP', 'REP'],
      ['LAP', 'LIP', 'LOP'],
      ['SAP', 'SIP', 'SUP', 'SOP'],
      ['HAP', 'HIP', 'HOP'],
      ['DAM', 'DIM', 'DUM'],
      ['HAM', 'HIM', 'HUM'],
      ['JAM', 'JIM'],
      ['RAM', 'RIM', 'RUM'],
      ['CAT', 'COT', 'CUT'],
      ['HAT', 'HIT', 'HOT', 'HUT'],
      ['RAT', 'RUT', 'ROT'],
      ['MAT', 'MIT', 'MUT'],
      ['FOR', 'FUR', 'FAR'],
      ['BAR', 'BUR'],
      ['CAR', 'CUR'],
      ['TAR', 'TOR'],
    ];

    // Find the group containing this word
    for (const group of similarGroups) {
      if (group.includes(upper)) {
        return group;
      }
    }

    // No similar words found, return just the original
    return [upper];
  }

  private handleAcceptAnswer(): void {
    if (!this.lastWrongAnswer) return;

    const { expected, heard, responseTime, isWordMode } = this.lastWrongAnswer;

    // For word mode, add the alias to all similar-sounding words
    if (isWordMode) {
      const similarWords = this.getSimilarSoundingWords(expected);
      for (const word of similarWords) {
        store.addPronunciationAlias(word, heard, true);
      }
      // Show which words were updated
      const savedCount = similarWords.length;
      this.feedbackTextEl.textContent = savedCount > 1
        ? `Saved! "${heard}" accepted for ${savedCount} similar words`
        : `Saved! "${heard}" now accepted for "${expected}"`;
    } else {
      // Character mode - just save for the single character
      store.addPronunciationAlias(expected, heard, false);
      this.feedbackTextEl.textContent = `Saved! "${heard}" now accepted for "${expected}"`;
    }

    // Update display to show it was saved
    this.acceptAnswerBtn.classList.add('saving');
    this.currentCharEl.className = 'current-char correct';

    // Play success tone
    const settings = store.getSettings();
    playCorrectTone(settings.volume * 0.6);

    // Re-score as correct - update the appropriate history
    if (isWordMode) {
      // Update word character history for each character in the word
      // Split the response time by number of characters
      const perCharTime = responseTime / expected.length;
      for (const char of expected.toUpperCase()) {
        const charHistory = store.getWordCharacterHistory(char);
        const newWMA = calculateWMA(charHistory.wma, perCharTime, true);

        store.updateWordCharacterHistory(char, {
          wma: newWMA,
          mostRecent: perCharTime,
          totalAttempts: charHistory.totalAttempts, // Don't increment again
          correctAttempts: charHistory.correctAttempts + 1, // But do credit the correct
          lastPracticed: Date.now(),
        });
      }
    } else {
      // Update character history
      const charHistory = store.getCharacterHistory(expected);
      const newWMA = calculateWMA(charHistory.wma, responseTime, true);

      store.updateCharacterHistory(expected, {
        wma: newWMA,
        mostRecent: responseTime,
        totalAttempts: charHistory.totalAttempts, // Don't increment again
        correctAttempts: charHistory.correctAttempts + 1, // But do credit the correct
        lastPracticed: Date.now(),
      });
    }

    // Clear the last wrong answer
    this.lastWrongAnswer = null;

    // Hide the button after a short delay
    setTimeout(() => {
      this.acceptAnswerBtn.classList.remove('saving');
      this.hideAcceptButton();
    }, 500);
  }

  // Helper: Pause recognition during audio playback
  private pauseRecognition(): void {
    if (!this.recognizer) return;
    if (this.useContinuousMode) {
      this.recognizer.ignoreResults();
    } else {
      this.recognizer.stop();
    }
  }

  private initializeSpeechRecognition(): void {
    // Note: We tried Whisper for Android to avoid the Chrome speech recognition chime,
    // but it's too slow (3-8 seconds) and hallucinates words from background noise.
    // Sticking with Web Speech API - the chime is annoying but at least it works.

    if (!isSpeechRecognitionSupported()) {
      this.feedbackTextEl.textContent = 'Speech recognition not supported';
      this.startBtn.disabled = true;
      return;
    }

    const recognizer = new SpeechRecognizer();

    // On iOS Safari and Android Chrome, use continuous mode to avoid the jingle on each start/stop
    // On Android, this also prevents recognition from timing out during morse playback
    if (isIOS() || isAndroid()) {
      this.useContinuousMode = true;
      recognizer.setContinuousMode(true);
      console.log('Mobile detected: using continuous speech recognition mode');
    }

    this.recognizer = recognizer;
    this.setupRecognizerCallbacks();
  }

  private setupRecognizerCallbacks(): void {
    if (!this.recognizer) return;

    this.recognizer.onResult((result) => {
      this.handleRecognitionResult(result.transcript, result.rawTranscript, result.timestamp);
    });

    // Show ALL raw transcripts in debug (even unrecognized ones)
    this.recognizer.onRaw((rawTranscript, normalized) => {
      if (this.debugHeardEl) {
        if (normalized) {
          this.debugHeardEl.textContent = `Heard: "${rawTranscript}" → ${normalized}`;
          this.debugHeardEl.style.color = '#00d26a'; // green
        } else {
          this.debugHeardEl.textContent = `Heard: "${rawTranscript}" → (not recognized)`;
          this.debugHeardEl.style.color = '#ff4757'; // red
        }
      }
    });

    this.recognizer.onError((error) => {
      // Handle critical errors only
      if (error === 'not-allowed') {
        this.feedbackTextEl.textContent = 'Microphone access denied. Please allow microphone access.';
        this.stop();
      } else if (error === 'network') {
        this.feedbackTextEl.textContent = 'Network error. Check your connection.';
      }
    });

    // Handle unexpected recognition end (e.g., no-speech timeout)
    // Only SpeechRecognizer has onEnd, not WhisperRecognizer
    // On Android, do NOT auto-restart - it causes annoying chime loops
    if ('onEnd' in this.recognizer && !isAndroid()) {
      (this.recognizer as SpeechRecognizer).onEnd(() => {
        // If session is still running and we're supposed to be listening, restart
        const session = store.getSession();
        if (session.isRunning && !this.isPlayingChar) {
          console.log('Recognition ended unexpectedly, restarting...');
          // Small delay before restarting to avoid rapid restart loops
          setTimeout(() => {
            if (store.getSession().isRunning && this.recognizer && !this.isPlayingChar) {
              // Re-enable callsign mode if we're in callsign mode
              const wordModeSettings = store.getWordModeSettings();
              if (wordModeSettings.practiceMode === 'callsign' && this.currentCallsign) {
                if (this.recognizer instanceof SpeechRecognizer) {
                  this.recognizer.setCallsignMode(true, this.currentCallsign.length);
                }
              }
              this.recognizer.start();
            }
          }, 100);
        }
      });
    }
  }

  private async toggleSession(): Promise<void> {
    const session = store.getSession();

    if (session.isRunning) {
      this.stop();
    } else {
      await this.start();
    }
  }

  async start(): Promise<void> {
    // Ensure audio context is resumed (required after user gesture)
    await resumeAudioContext();

    // Keep screen awake during practice
    await this.acquireWakeLock();

    // Start audio level monitor for visual feedback
    // EXCEPT on Android - getUserMedia blocks Web Speech API from accessing mic
    if (!isAndroid()) {
      await this.audioLevelMonitor.start();
    }

    // Clear any previous attempt tracking
    this.lastAttempt = null;

    store.startSession();

    // Start break check interval
    this.breakCheckInterval = window.setInterval(() => {
      this.checkBreakReminder();
    }, 60000);

    // In continuous mode (iOS/Android), start recognition once at session start
    // It will keep running and we'll use acceptResults/ignoreResults to control
    if (this.useContinuousMode && this.recognizer && this.recognizer instanceof SpeechRecognizer) {
      console.log('Starting continuous recognition for session');
      this.recognizer.start();
      this.recognizer.ignoreResults(); // Start ignoring until we're ready

      // Wait for the speech recognition chime to finish
      // Android Chrome: chime plays, recognition restarts a few times, need longer delay
      // iOS Safari: simpler jingle, ~3 seconds
      const chimeDelay = isAndroid() ? 3500 : 3000;
      this.feedbackTextEl.textContent = 'Starting microphone...';
      await new Promise(resolve => setTimeout(resolve, chimeDelay));

      // Check if session was stopped during the delay
      if (!store.getSession().isRunning) return;
    }

    // Play first character
    this.playNextCharacter();
  }

  stop(): void {
    store.stopSession();

    // Release screen wake lock
    this.releaseWakeLock();

    // Stop any playing audio
    stopAllAudio();
    this.isPlayingChar = false;

    // Cancel any pending next character
    if (this.nextCharTimeout) {
      clearTimeout(this.nextCharTimeout);
      this.nextCharTimeout = null;
    }

    if (this.recognizer) {
      this.recognizer.stop();
    }

    if (this.breakCheckInterval) {
      clearInterval(this.breakCheckInterval);
      this.breakCheckInterval = null;
    }

    // Stop audio level monitor
    this.audioLevelMonitor.stop();

    // Clear attempt tracking
    this.lastAttempt = null;

    this.listeningIndicator.classList.add('hidden');
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Press Start to begin';
  }

  private async playNextCharacter(): Promise<void> {
    const session = store.getSession();
    if (!session.isRunning) return;

    // Prevent overlapping character plays
    if (this.isPlayingChar) return;
    this.isPlayingChar = true;

    const activeChars = store.getActiveCharacters();
    if (activeChars.length === 0) {
      this.feedbackTextEl.textContent = 'No characters selected';
      this.isPlayingChar = false;
      this.stop();
      return;
    }

    const settings = store.getSettings();
    const wordModeSettings = store.getWordModeSettings();

    // Check if we're in word mode
    if (wordModeSettings.practiceMode === 'word') {
      await this.playNextWord();
      return;
    }

    // Check if we're in callsign mode
    if (wordModeSettings.practiceMode === 'callsign') {
      await this.playNextCallsign();
      return;
    }

    // Character mode logic
    const history = store.getHistory();

    // Select next character
    const char = selectNextCharacter(
      activeChars,
      history,
      settings.adaptiveGain,
      this.previousChar
    );

    store.updateSession({ currentChar: char });
    this.previousChar = char;
    this.currentWord = null; // Clear any word state
    this.repeatAttempts = 0; // Reset repeat attempts for new character

    // Reset display
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Listen...';
    this.listeningIndicator.classList.add('hidden');

    // Set the expected character for flexible mode validation
    if (this.recognizer) {
      this.recognizer.setExpectedChar(char);
    }

    // On Android (non-continuous mode), we need to start recognition BEFORE playing morse
    // so the chime has time to finish before the morse audio plays
    if (isAndroid() && !this.useContinuousMode && this.recognizer) {
      console.log('Android: starting recognition before morse (chime will play)');
      this.recognizer.start();
      // Wait for the Android Chrome chime to finish (~2 seconds)
      this.feedbackTextEl.textContent = 'Starting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if session was stopped during the delay
      if (!store.getSession().isRunning) {
        this.isPlayingChar = false;
        return;
      }
      this.feedbackTextEl.textContent = 'Listen...';
    } else {
      // iOS continuous mode or desktop: pause recognition during audio
      this.pauseRecognition();
    }

    // Play morse audio
    const completed = await playMorseCharacter(
      char,
      settings.characterSpeed,
      settings.toneFrequency,
      settings.volume
    );

    // Check if session was stopped during playback
    if (!store.getSession().isRunning || !completed) {
      this.isPlayingChar = false;
      return;
    }

    // Record when audio finished
    this.audioPlayedAt = performance.now();
    this.isPlayingChar = false;

    // Start listening
    this.feedbackTextEl.textContent = 'Speak the character';
    this.listeningIndicator.classList.remove('hidden');

    // Handle post-audio recognition setup
    if (this.recognizer) {
      if (this.useContinuousMode) {
        // After a restart, WebKit needs extra time before it's ready to process speech
        // Normal operation just needs a small delay to flush buffered results
        const delay = this.justRestartedRecognition ? 2000 : 100;
        if (this.justRestartedRecognition) {
          console.log('Post-restart: waiting extra time for WebKit to be ready');
          this.justRestartedRecognition = false;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        // Update audioPlayedAt after the delay for accurate timing
        this.audioPlayedAt = performance.now();
        this.recognizer.acceptResults();
      } else if (!isAndroid()) {
        // Desktop (non-continuous): start recognition now
        this.recognizer.start();
      }
      // Android: recognition was already started before morse audio
    }
  }

  private async playNextWord(): Promise<void> {
    const session = store.getSession();
    if (!session.isRunning) return;

    const activeChars = store.getActiveCharacters();
    const settings = store.getSettings();
    const wordModeSettings = store.getWordModeSettings();
    const wordHistory = store.getWordHistory();
    const wordLength = wordModeSettings.wordLength as WordLength;

    // Check if word mode is available with current character set
    if (!isWordModeAvailable(wordLength, activeChars)) {
      this.feedbackTextEl.textContent = 'No words available with current character set';
      this.isPlayingChar = false;
      this.stop();
      return;
    }

    // Select next word
    const word = selectNextWord(
      wordLength,
      wordHistory,
      activeChars,
      settings.adaptiveGain,
      this.previousWord
    );

    this.currentWord = word;
    this.previousWord = word;
    store.updateSession({ currentChar: word }); // Store word in currentChar for display
    this.repeatAttempts = 0; // Reset repeat attempts for new word

    // Reset display
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Listen...';
    this.listeningIndicator.classList.add('hidden');

    // Set expected to null for word mode - we'll handle validation differently
    if (this.recognizer) {
      this.recognizer.setExpectedChar(null);
    }

    // On Android (non-continuous mode), start recognition BEFORE playing morse
    // so the chime has time to finish before the morse audio plays
    if (isAndroid() && !this.useContinuousMode && this.recognizer) {
      console.log('Android: starting recognition before morse word (chime will play)');
      this.recognizer.start();
      this.feedbackTextEl.textContent = 'Starting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!store.getSession().isRunning) {
        this.isPlayingChar = false;
        return;
      }
      this.feedbackTextEl.textContent = 'Listen...';
    } else if (this.recognizer) {
      // iOS continuous mode or desktop: pause recognition during audio
      if (this.useContinuousMode) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }

    // Play morse word audio
    const completed = await playMorseWord(
      word,
      settings.characterSpeed,
      settings.toneFrequency,
      settings.volume
    );

    // Check if session was stopped during playback
    if (!store.getSession().isRunning || !completed) {
      this.isPlayingChar = false;
      return;
    }

    // Record when audio finished
    this.audioPlayedAt = performance.now();
    this.isPlayingChar = false;

    // Start listening
    this.feedbackTextEl.textContent = 'Speak the word';
    this.listeningIndicator.classList.remove('hidden');

    // Handle post-audio recognition setup
    if (this.recognizer) {
      if (this.useContinuousMode) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.audioPlayedAt = performance.now();
        this.recognizer.acceptResults();
      } else if (!isAndroid()) {
        // Desktop (non-continuous): start recognition now
        this.recognizer.start();
      }
      // Android: recognition was already started before morse audio
    }
  }

  // Replay the current character (used in repeat-until-correct mode)
  private async replayCurrentCharacter(): Promise<void> {
    const session = store.getSession();
    if (!session.isRunning || !session.currentChar) return;

    // Prevent overlapping character plays
    if (this.isPlayingChar) return;
    this.isPlayingChar = true;

    const settings = store.getSettings();

    // Reset display for replay
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Listen...';
    this.listeningIndicator.classList.add('hidden');

    // Set the expected character for flexible mode validation
    if (this.recognizer) {
      this.recognizer.setExpectedChar(session.currentChar);
    }

    // On Android (non-continuous mode), start recognition BEFORE playing morse
    if (isAndroid() && !this.useContinuousMode && this.recognizer) {
      console.log('Android: starting recognition before morse replay (chime will play)');
      this.recognizer.start();
      this.feedbackTextEl.textContent = 'Starting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!store.getSession().isRunning) {
        this.isPlayingChar = false;
        return;
      }
      this.feedbackTextEl.textContent = 'Listen...';
    } else if (this.recognizer) {
      // iOS continuous mode or desktop: pause recognition during audio
      if (this.useContinuousMode) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }

    // Play morse audio for the same character
    const completed = await playMorseCharacter(
      session.currentChar,
      settings.characterSpeed,
      settings.toneFrequency,
      settings.volume
    );

    // Check if session was stopped during playback
    if (!store.getSession().isRunning || !completed) {
      this.isPlayingChar = false;
      return;
    }

    // Record when audio finished
    this.audioPlayedAt = performance.now();
    this.isPlayingChar = false;

    // Start listening
    this.feedbackTextEl.textContent = 'Speak the character';
    this.listeningIndicator.classList.remove('hidden');

    // Handle post-audio recognition setup
    if (this.recognizer) {
      if (this.useContinuousMode) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.audioPlayedAt = performance.now();
        this.recognizer.acceptResults();
      } else if (!isAndroid()) {
        // Desktop (non-continuous): start recognition now
        this.recognizer.start();
      }
      // Android: recognition was already started before morse audio
    }
  }

  private handleRecognitionResult(recognized: string, rawTranscript: string, timestamp: number): void {
    const session = store.getSession();
    if (!session.isRunning || !session.currentChar) return;

    const wordModeSettings = store.getWordModeSettings();

    // Check if we're in word mode
    if (wordModeSettings.practiceMode === 'word' && this.currentWord) {
      this.handleWordRecognitionResult(rawTranscript, timestamp);
      return;
    }

    // Check if we're in callsign mode
    if (wordModeSettings.practiceMode === 'callsign' && this.currentCallsign) {
      this.handleCallsignRecognitionResult(rawTranscript, timestamp);
      return;
    }

    // Stop accepting results (in continuous mode, recognition keeps running)
    if (this.recognizer) {
      if (this.useContinuousMode && this.recognizer instanceof SpeechRecognizer) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }
    this.listeningIndicator.classList.add('hidden');
    this.hideAcceptButton(); // Hide any previous accept button

    // Calculate response time (compensate for Web Speech API latency)
    const rawResponseTime = timestamp - this.audioPlayedAt;
    const responseTime = Math.max(100, rawResponseTime - SPEECH_API_LATENCY);

    // Check if correct - either direct match OR matches a pronunciation alias
    const directMatch = recognized.toUpperCase() === session.currentChar.toUpperCase();
    const aliasMatch = store.matchesAlias(session.currentChar, rawTranscript, false);
    const isCorrect = directMatch || aliasMatch;

    // Update display
    const displayChar = getCharDisplayName(session.currentChar);
    this.currentCharEl.textContent = displayChar;
    this.currentCharEl.className = `current-char ${isCorrect ? 'correct' : 'incorrect'}`;

    // Play feedback tone
    const settings = store.getSettings();
    if (isCorrect) {
      playCorrectTone(settings.volume * 0.6);
    } else {
      playIncorrectTone(settings.volume * 0.6);
    }

    if (isCorrect) {
      this.feedbackTextEl.textContent = `Correct! ${Math.round(responseTime)}ms`;
      // Show raw timing in debug for calibration
      if (this.debugHeardEl) {
        const aliasNote = aliasMatch && !directMatch ? ' (alias)' : '';
        this.debugHeardEl.textContent = `Heard: "${rawTranscript}"${aliasNote} | adjusted: ${Math.round(responseTime)}ms | raw: ${Math.round(rawResponseTime)}ms`;
        this.debugHeardEl.style.color = '#00d26a';
      }
    } else {
      // Check if this was an unrecognized word (special marker from speech recognition)
      const isUnrecognized = recognized.startsWith('[unrecognized:');

      // Track repeat attempts for max tries feature
      this.repeatAttempts++;
      const maxTries = settings.maxRepeatTries;
      const reachedMax = maxTries < 6 && this.repeatAttempts >= maxTries;

      if (settings.repeatUntilCorrect && !reachedMax) {
        // Don't reveal the answer in repeat mode - they need to figure it out
        this.feedbackTextEl.textContent = 'Incorrect - try again';
        this.currentCharEl.textContent = '—';
        this.currentCharEl.className = 'current-char incorrect';
      } else {
        // Show the answer (either not in repeat mode, or max tries reached)
        if (reachedMax) {
          this.feedbackTextEl.textContent = `Max tries reached - was "${displayChar}"`;
        } else if (isUnrecognized) {
          // Show the raw transcript they said
          this.feedbackTextEl.textContent = `"${rawTranscript}" not recognized - was "${displayChar}"`;
        } else {
          // Normal behavior: show what they said and the correct answer
          const recognizedDisplay = getCharDisplayName(recognized);
          this.feedbackTextEl.textContent = `You said "${recognizedDisplay}" - was "${displayChar}"`;
        }
      }

      // Accept My Answer feature is only for word mode - not character mode
    }

    // Store previous state for recovery
    const charHistory = store.getCharacterHistory(session.currentChar);
    this.lastAttempt = {
      type: 'character',
      value: session.currentChar,
      chars: [session.currentChar],
      wasCorrect: isCorrect,
      previousWMAs: {
        [session.currentChar]: { wma: charHistory.wma, mostRecent: charHistory.mostRecent }
      }
    };

    // Update history
    const newWMA = calculateWMA(charHistory.wma, responseTime, isCorrect);

    store.updateCharacterHistory(session.currentChar, {
      wma: newWMA,
      mostRecent: isCorrect ? responseTime : calculatePenaltyTime(charHistory.wma),
      totalAttempts: charHistory.totalAttempts + 1,
      correctAttempts: charHistory.correctAttempts + (isCorrect ? 1 : 0),
      lastPracticed: Date.now(),
    });

    // Update session stats
    store.updateSession({
      totalCharsThisSession: session.totalCharsThisSession + 1,
    });

    // Schedule next character (cancel any previous pending)
    if (this.nextCharTimeout) {
      clearTimeout(this.nextCharTimeout);
    }

    // Check if we should repeat (repeat mode enabled AND haven't reached max tries)
    const maxTries = settings.maxRepeatTries;
    const shouldRepeat = !isCorrect && settings.repeatUntilCorrect &&
                         (maxTries >= 6 || this.repeatAttempts < maxTries);

    if (shouldRepeat) {
      // Repeat mode: short delay then replay (no Accept My Answer in character mode)
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.replayCurrentCharacter();
        }
      }, NEXT_CHAR_DELAY);
    } else if (!isCorrect) {
      // Wrong answer (not in repeat mode or max tries reached): short delay then next character
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.playNextCharacter();
        }
      }, NEXT_CHAR_DELAY);
    } else {
      // Correct answer: move to next quickly
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.playNextCharacter();
        }
      }, NEXT_CHAR_DELAY);
    }
  }

  private handleWordRecognitionResult(rawTranscript: string, timestamp: number): void {
    const session = store.getSession();
    if (!session.isRunning || !this.currentWord) return;

    // Stop accepting results
    if (this.recognizer) {
      if (this.useContinuousMode && this.recognizer instanceof SpeechRecognizer) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }
    this.listeningIndicator.classList.add('hidden');
    this.hideAcceptButton(); // Hide any previous accept button

    // Calculate response time
    const rawResponseTime = timestamp - this.audioPlayedAt;
    const responseTime = Math.max(100, rawResponseTime - SPEECH_API_LATENCY);

    // Normalize the raw transcript for comparison
    // First try letters only, but if that results in empty string, keep original for alias matching
    const lettersOnly = rawTranscript.toUpperCase().trim().replace(/[^A-Z]/g, '');
    const spokenWord = lettersOnly || rawTranscript.toUpperCase().trim();
    const expectedWord = this.currentWord.toUpperCase();

    // Map numbers to possible word equivalents
    // This handles cases like "ten" being recognized as "10"
    const soundToWords: Record<string, string[]> = {
      '1': ['ONE', 'WON'],
      '2': ['TWO', 'TOO'],
      '4': ['FOUR', 'FOR'],
      '8': ['ATE'],
      '10': ['TEN', 'TAN', 'TIN', 'TON', 'TUN'],
    };
    const possibleWords = soundToWords[spokenWord] || [spokenWord];

    // Check if correct - either direct match OR number sounds like expected word OR matches alias
    const directMatch = spokenWord === expectedWord || possibleWords.includes(expectedWord);
    const aliasMatch = store.matchesAlias(expectedWord, rawTranscript, true);
    const isCorrect = directMatch || aliasMatch;

    // Update display
    this.currentCharEl.textContent = expectedWord;
    this.currentCharEl.className = `current-char ${isCorrect ? 'correct' : 'incorrect'}`;

    // Play feedback tone
    const settings = store.getSettings();
    if (isCorrect) {
      playCorrectTone(settings.volume * 0.6);
    } else {
      playIncorrectTone(settings.volume * 0.6);
    }

    if (isCorrect) {
      this.feedbackTextEl.textContent = `Correct! ${Math.round(responseTime)}ms`;
      if (this.debugHeardEl) {
        const wasNumberConversion = possibleWords.includes(expectedWord) && spokenWord !== expectedWord;
        const aliasNote = aliasMatch && !directMatch ? ' (alias)' : wasNumberConversion ? ' (number)' : '';
        this.debugHeardEl.textContent = `Heard: "${rawTranscript}"${aliasNote} | adjusted: ${Math.round(responseTime)}ms`;
        this.debugHeardEl.style.color = '#00d26a';
      }
    } else {
      // Track repeat attempts for max tries feature
      this.repeatAttempts++;
      const maxTries = settings.maxRepeatTries;
      const reachedMax = maxTries < 6 && this.repeatAttempts >= maxTries;

      if (settings.repeatUntilCorrect && !reachedMax) {
        // Don't reveal the answer in repeat mode
        this.feedbackTextEl.textContent = 'Incorrect - try again';
        this.currentCharEl.textContent = '—';
        this.currentCharEl.className = 'current-char incorrect';
      } else {
        // Show the answer (either not in repeat mode, or max tries reached)
        if (reachedMax) {
          this.feedbackTextEl.textContent = `Max tries reached - was "${expectedWord}"`;
        } else {
          this.feedbackTextEl.textContent = `You said "${rawTranscript}" - was "${expectedWord}"`;
        }
      }

      // Always store wrong answer info and show accept button (even in repeat mode)
      this.lastWrongAnswer = {
        expected: expectedWord,
        heard: rawTranscript,
        responseTime,
        isWordMode: true,
      };
      this.showAcceptButton();
    }

    // Store previous state for recovery before updating history
    const wordChars = expectedWord.split('');
    const previousWMAs: Record<string, { wma: number; mostRecent: number }> = {};
    for (const char of wordChars) {
      const charHistory = store.getWordCharacterHistory(char);
      previousWMAs[char] = { wma: charHistory.wma, mostRecent: charHistory.mostRecent };
    }
    this.lastAttempt = {
      type: 'word',
      value: expectedWord,
      chars: wordChars,
      wasCorrect: isCorrect,
      previousWMAs
    };

    // Update word character history for EACH character in the word
    // Split the response time by number of characters
    const perCharTime = responseTime / expectedWord.length;
    for (const char of expectedWord) {
      const charHistory = store.getWordCharacterHistory(char);
      const newWMA = calculateWMA(charHistory.wma, perCharTime, isCorrect);

      store.updateWordCharacterHistory(char, {
        wma: newWMA,
        mostRecent: isCorrect ? perCharTime : calculatePenaltyTime(charHistory.wma),
        totalAttempts: charHistory.totalAttempts + 1,
        correctAttempts: charHistory.correctAttempts + (isCorrect ? 1 : 0),
        lastPracticed: Date.now(),
      });
    }

    // Update session stats
    store.updateSession({
      totalCharsThisSession: session.totalCharsThisSession + 1,
    });

    // Schedule next word (cancel any previous pending)
    if (this.nextCharTimeout) {
      clearTimeout(this.nextCharTimeout);
    }

    // Check if we should repeat (repeat mode enabled AND haven't reached max tries)
    const maxTries = settings.maxRepeatTries;
    const shouldRepeat = !isCorrect && settings.repeatUntilCorrect &&
                         (maxTries >= 6 || this.repeatAttempts < maxTries);

    if (shouldRepeat) {
      // Repeat mode: wait longer to give time for "Accept My Answer", then replay
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        this.hideAcceptButton();
        if (store.getSession().isRunning) {
          this.replayCurrentWord();
        }
      }, WRONG_ANSWER_DELAY);
    } else if (!isCorrect) {
      // Wrong answer (not in repeat mode or max tries reached): wait longer to give time for "Accept My Answer"
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        this.hideAcceptButton();
        if (store.getSession().isRunning) {
          this.playNextCharacter(); // This will delegate to playNextWord in word mode
        }
      }, WRONG_ANSWER_DELAY);
    } else {
      // Correct answer: move to next quickly
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.playNextCharacter(); // This will delegate to playNextWord in word mode
        }
      }, NEXT_CHAR_DELAY);
    }
  }

  private async replayCurrentWord(): Promise<void> {
    const session = store.getSession();
    if (!session.isRunning || !this.currentWord) return;

    if (this.isPlayingChar) return;
    this.isPlayingChar = true;

    const settings = store.getSettings();

    // Reset display
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Listen...';
    this.listeningIndicator.classList.add('hidden');

    // Set expected to null for word mode
    if (this.recognizer) {
      this.recognizer.setExpectedChar(null);
    }

    // On Android (non-continuous mode), start recognition BEFORE playing morse
    if (isAndroid() && !this.useContinuousMode && this.recognizer) {
      console.log('Android: starting recognition before morse word replay (chime will play)');
      this.recognizer.start();
      this.feedbackTextEl.textContent = 'Starting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!store.getSession().isRunning) {
        this.isPlayingChar = false;
        return;
      }
      this.feedbackTextEl.textContent = 'Listen...';
    } else if (this.recognizer) {
      if (this.useContinuousMode) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }

    // Play the same word again
    const completed = await playMorseWord(
      this.currentWord,
      settings.characterSpeed,
      settings.toneFrequency,
      settings.volume
    );

    if (!store.getSession().isRunning || !completed) {
      this.isPlayingChar = false;
      return;
    }

    this.audioPlayedAt = performance.now();
    this.isPlayingChar = false;

    this.feedbackTextEl.textContent = 'Speak the word';
    this.listeningIndicator.classList.remove('hidden');

    // Handle post-audio recognition setup
    if (this.recognizer) {
      if (this.useContinuousMode) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.audioPlayedAt = performance.now();
        this.recognizer.acceptResults();
      } else if (!isAndroid()) {
        this.recognizer.start();
      }
      // Android: recognition was already started before morse audio
    }
  }

  // ==================== CALLSIGN MODE ====================

  private async playNextCallsign(): Promise<void> {
    const session = store.getSession();
    if (!session.isRunning) return;

    const activeChars = store.getActiveCharacters();
    const settings = store.getSettings();
    const callsignSettings = store.getCallsignModeSettings();
    const callsignHistory = store.getCallsignHistory();

    // Check if any formats are enabled
    if (callsignSettings.enabledFormats.length === 0) {
      this.feedbackTextEl.textContent = 'No callsign formats selected';
      this.isPlayingChar = false;
      this.stop();
      return;
    }

    // Generate next callsign
    const callsign = generateRandomCallsign(
      callsignSettings.enabledFormats,
      callsignHistory,
      activeChars,
      settings.adaptiveGain,
      this.previousCallsign
    );

    this.currentCallsign = callsign;
    this.previousCallsign = callsign;
    this.currentWord = null; // Clear word state
    store.updateSession({ currentChar: callsign });
    this.repeatAttempts = 0; // Reset repeat attempts for new callsign

    // Reset display
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Listen...';
    this.listeningIndicator.classList.add('hidden');

    // Set expected to null and enable callsign mode
    if (this.recognizer) {
      this.recognizer.setExpectedChar(null);
      if (this.recognizer instanceof SpeechRecognizer) {
        this.recognizer.setCallsignMode(true, callsign.length);
      }
    }

    // On Android (non-continuous mode), start recognition BEFORE playing morse
    if (isAndroid() && !this.useContinuousMode && this.recognizer) {
      console.log('Android: starting recognition before morse callsign (chime will play)');
      this.recognizer.start();
      this.feedbackTextEl.textContent = 'Starting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!store.getSession().isRunning) {
        this.isPlayingChar = false;
        return;
      }
      this.feedbackTextEl.textContent = 'Listen...';
    } else if (this.recognizer) {
      if (this.useContinuousMode) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }

    // Play morse callsign (reuse playMorseWord since it handles multi-character)
    const completed = await playMorseWord(
      callsign,
      settings.characterSpeed,
      settings.toneFrequency,
      settings.volume
    );

    // Check if session was stopped during playback
    if (!store.getSession().isRunning || !completed) {
      this.isPlayingChar = false;
      return;
    }

    // Record when audio finished
    this.audioPlayedAt = performance.now();
    this.isPlayingChar = false;

    // Start listening
    this.feedbackTextEl.textContent = 'Speak the callsign (use phonetics)';
    this.listeningIndicator.classList.remove('hidden');

    // Handle post-audio recognition setup
    if (this.recognizer) {
      if (this.useContinuousMode) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.audioPlayedAt = performance.now();
        this.recognizer.acceptResults();
      } else if (!isAndroid()) {
        this.recognizer.start();
      }
      // Android: recognition was already started before morse audio
    }
  }

  private handleCallsignRecognitionResult(rawTranscript: string, timestamp: number): void {
    const session = store.getSession();
    if (!session.isRunning || !this.currentCallsign) return;

    // Stop accepting results and disable callsign mode
    if (this.recognizer) {
      if (this.recognizer instanceof SpeechRecognizer) {
        this.recognizer.setCallsignMode(false);
      }
      if (this.useContinuousMode && this.recognizer instanceof SpeechRecognizer) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }
    this.listeningIndicator.classList.add('hidden');
    this.hideAcceptButton();

    // Calculate response time
    const rawResponseTime = timestamp - this.audioPlayedAt;
    const responseTime = Math.max(100, rawResponseTime - SPEECH_API_LATENCY);

    // Validate the callsign using flexible word matching
    const result = validateCallsign(this.currentCallsign, rawTranscript);
    const isCorrect = result.isCorrect;

    // Update display
    this.currentCharEl.textContent = this.currentCallsign;
    this.currentCharEl.className = `current-char ${isCorrect ? 'correct' : 'incorrect'}`;

    // Play feedback tone
    const settings = store.getSettings();
    if (isCorrect) {
      playCorrectTone(settings.volume * 0.6);
    } else {
      playIncorrectTone(settings.volume * 0.6);
    }

    if (isCorrect) {
      this.feedbackTextEl.textContent = `Correct! ${Math.round(responseTime)}ms`;
      if (this.debugHeardEl) {
        this.debugHeardEl.textContent = `Heard: "${rawTranscript}" → ${result.parsed} | ${Math.round(responseTime)}ms`;
        this.debugHeardEl.style.color = '#00d26a';
      }
    } else {
      // Track repeat attempts for max tries feature
      this.repeatAttempts++;
      const maxTries = settings.maxRepeatTries;
      const reachedMax = maxTries < 6 && this.repeatAttempts >= maxTries;

      const errorDesc = getErrorDescription(result);
      if (settings.repeatUntilCorrect && !reachedMax) {
        this.feedbackTextEl.textContent = `Incorrect - ${errorDesc}`;
        this.currentCharEl.textContent = '—';
        this.currentCharEl.className = 'current-char incorrect';
      } else {
        // Show the answer (either not in repeat mode, or max tries reached)
        if (reachedMax) {
          this.feedbackTextEl.textContent = `Max tries reached - was "${this.currentCallsign}"`;
        } else {
          this.feedbackTextEl.textContent = `${errorDesc} - was "${this.currentCallsign}"`;
        }
      }

      if (this.debugHeardEl) {
        this.debugHeardEl.textContent = `Heard: "${rawTranscript}" → ${result.parsed || '(nothing)'}`;
        this.debugHeardEl.style.color = '#ff4757';
      }
    }

    // Store previous state for recovery before updating history
    const callsignChars = this.currentCallsign.split('');
    const previousWMAs: Record<string, { wma: number; mostRecent: number }> = {};
    for (const char of callsignChars) {
      const charHistory = store.getCallsignCharacterHistory(char);
      previousWMAs[char] = { wma: charHistory.wma, mostRecent: charHistory.mostRecent };
    }
    this.lastAttempt = {
      type: 'callsign',
      value: this.currentCallsign,
      chars: callsignChars,
      wasCorrect: isCorrect,
      previousWMAs
    };

    // Update callsign character history for EACH character in the callsign
    const perCharTime = responseTime / this.currentCallsign.length;
    for (const char of this.currentCallsign) {
      const charHistory = store.getCallsignCharacterHistory(char);
      const newWMA = calculateWMA(charHistory.wma, perCharTime, isCorrect);

      store.updateCallsignCharacterHistory(char, {
        wma: newWMA,
        mostRecent: isCorrect ? perCharTime : calculatePenaltyTime(charHistory.wma),
        totalAttempts: charHistory.totalAttempts + 1,
        correctAttempts: charHistory.correctAttempts + (isCorrect ? 1 : 0),
        lastPracticed: Date.now(),
      });
    }

    // Update session stats
    store.updateSession({
      totalCharsThisSession: session.totalCharsThisSession + 1,
    });

    // Schedule next callsign
    if (this.nextCharTimeout) {
      clearTimeout(this.nextCharTimeout);
    }

    // Check if we should repeat (repeat mode enabled AND haven't reached max tries)
    const maxTries = settings.maxRepeatTries;
    const shouldRepeat = !isCorrect && settings.repeatUntilCorrect &&
                         (maxTries >= 6 || this.repeatAttempts < maxTries);

    if (shouldRepeat) {
      // Repeat mode: replay the same callsign after longer delay
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.replayCurrentCallsign();
        }
      }, CALLSIGN_WRONG_DELAY);
    } else if (!isCorrect) {
      // Wrong answer (not in repeat mode or max tries reached): longer delay to review the answer
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.playNextCharacter(); // Will route to callsign mode
        }
      }, CALLSIGN_WRONG_DELAY);
    } else {
      // Correct answer: move to next quickly
      this.nextCharTimeout = window.setTimeout(() => {
        this.nextCharTimeout = null;
        if (store.getSession().isRunning) {
          this.playNextCharacter(); // Will route to callsign mode
        }
      }, NEXT_CHAR_DELAY);
    }
  }

  private async replayCurrentCallsign(): Promise<void> {
    const session = store.getSession();
    if (!session.isRunning || !this.currentCallsign) return;

    if (this.isPlayingChar) return;
    this.isPlayingChar = true;

    const settings = store.getSettings();

    // Reset display
    this.currentCharEl.textContent = '—';
    this.currentCharEl.className = 'current-char';
    this.feedbackTextEl.textContent = 'Listen...';
    this.listeningIndicator.classList.add('hidden');

    // Set expected to null and enable callsign mode
    if (this.recognizer) {
      this.recognizer.setExpectedChar(null);
      if (this.recognizer instanceof SpeechRecognizer) {
        this.recognizer.setCallsignMode(true, this.currentCallsign.length);
      }
    }

    // On Android (non-continuous mode), start recognition BEFORE playing morse
    if (isAndroid() && !this.useContinuousMode && this.recognizer) {
      console.log('Android: starting recognition before morse callsign replay (chime will play)');
      this.recognizer.start();
      this.feedbackTextEl.textContent = 'Starting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!store.getSession().isRunning) {
        this.isPlayingChar = false;
        return;
      }
      this.feedbackTextEl.textContent = 'Listen...';
    } else if (this.recognizer) {
      if (this.useContinuousMode) {
        this.recognizer.ignoreResults();
      } else {
        this.recognizer.stop();
      }
    }

    // Replay the same callsign
    const completed = await playMorseWord(
      this.currentCallsign,
      settings.characterSpeed,
      settings.toneFrequency,
      settings.volume
    );

    if (!store.getSession().isRunning || !completed) {
      this.isPlayingChar = false;
      return;
    }

    this.audioPlayedAt = performance.now();
    this.isPlayingChar = false;

    this.feedbackTextEl.textContent = 'Speak the callsign (use phonetics)';
    this.listeningIndicator.classList.remove('hidden');

    // Handle post-audio recognition setup
    if (this.recognizer) {
      if (this.useContinuousMode) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.audioPlayedAt = performance.now();
        this.recognizer.acceptResults();
      } else if (!isAndroid()) {
        this.recognizer.start();
      }
      // Android: recognition was already started before morse audio
    }
  }

  // ==================== END CALLSIGN MODE ====================

  private checkBreakReminder(): void {
    const session = store.getSession();
    if (!session.isRunning) return;

    const timeSinceBreak = Date.now() - session.lastBreakReminder;
    if (timeSinceBreak >= BREAK_REMINDER_INTERVAL) {
      this.breakModal.classList.remove('hidden');
    }
  }

}
