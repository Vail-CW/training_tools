import { store } from '../state/store';
import type { PracticeMode } from '../types';
import { getAvailableWordCount, isWordModeAvailable } from '../core/word-selector';
import type { WordLength } from '../data/word-lists';

export class ModeSelector {
  private charModeBtn: HTMLButtonElement;
  private wordModeBtn: HTMLButtonElement;
  private callsignModeBtn: HTMLButtonElement;
  private wordLengthControl: HTMLElement;
  private wordLengthSlider: HTMLInputElement;
  private wordLengthValue: HTMLElement;
  private wordCountInfo: HTMLElement;
  private callsignFormatControl: HTMLElement;
  private callsignFormatInfo: HTMLElement;
  private formatCheckboxes: NodeListOf<HTMLInputElement>;

  // Callback when mode or length changes (to stop active sessions)
  private onModeChange: ((mode: PracticeMode) => void) | null = null;
  // Callback to sync chart with mode
  private onChartToggle: ((mode: PracticeMode) => void) | null = null;

  constructor() {
    // Get DOM elements
    this.charModeBtn = document.getElementById('char-mode-btn') as HTMLButtonElement;
    this.wordModeBtn = document.getElementById('word-mode-btn') as HTMLButtonElement;
    this.callsignModeBtn = document.getElementById('callsign-mode-btn') as HTMLButtonElement;
    this.wordLengthControl = document.getElementById('word-length-control') as HTMLElement;
    this.wordLengthSlider = document.getElementById('word-length-slider') as HTMLInputElement;
    this.wordLengthValue = document.getElementById('word-length-value') as HTMLElement;
    this.wordCountInfo = document.getElementById('word-count-info') as HTMLElement;
    this.callsignFormatControl = document.getElementById('callsign-format-control') as HTMLElement;
    this.callsignFormatInfo = document.getElementById('callsign-format-info') as HTMLElement;
    this.formatCheckboxes = document.querySelectorAll('.format-checkbox input[type="checkbox"]');

    this.setupEventListeners();
    this.initializeFromState();
  }

  private setupEventListeners(): void {
    this.charModeBtn.addEventListener('click', () => this.setMode('character'));
    this.wordModeBtn.addEventListener('click', () => this.setMode('word'));
    this.callsignModeBtn.addEventListener('click', () => this.setMode('callsign'));

    this.wordLengthSlider.addEventListener('input', () => {
      const length = parseInt(this.wordLengthSlider.value) as WordLength;
      this.wordLengthValue.textContent = length.toString();
      store.updateWordModeSettings({ wordLength: length });
      this.updateWordCountInfo(length);

      // Changing length should stop active session and trigger callback
      if (this.onModeChange) {
        this.onModeChange('word');
      }
    });

    // Callsign format checkboxes
    this.formatCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateCallsignFormats();
        // Changing formats should stop active session
        if (this.onModeChange) {
          this.onModeChange('callsign');
        }
      });
    });

    // Subscribe to character set changes to update word count
    store.subscribe('characterSet', () => {
      const settings = store.getWordModeSettings();
      if (settings.practiceMode === 'word') {
        this.updateWordCountInfo(settings.wordLength);
      }
    });
  }

  private initializeFromState(): void {
    const settings = store.getWordModeSettings();
    const callsignSettings = store.getCallsignModeSettings();

    // Initialize callsign format checkboxes from stored state
    this.formatCheckboxes.forEach(checkbox => {
      checkbox.checked = callsignSettings.enabledFormats.includes(checkbox.value);
    });

    this.updateUI(settings.practiceMode, settings.wordLength);
    this.updateCallsignFormatInfo();
  }

  private setMode(mode: PracticeMode): void {
    store.updateWordModeSettings({ practiceMode: mode });
    this.updateUI(mode, store.getWordModeSettings().wordLength);

    if (this.onModeChange) {
      this.onModeChange(mode);
    }

    // Sync chart with mode
    if (this.onChartToggle) {
      this.onChartToggle(mode);
    }
  }

  private updateUI(mode: PracticeMode, wordLength: WordLength): void {
    // Update button states
    this.charModeBtn.classList.toggle('active', mode === 'character');
    this.wordModeBtn.classList.toggle('active', mode === 'word');
    this.callsignModeBtn.classList.toggle('active', mode === 'callsign');

    // Show/hide word length control
    this.wordLengthControl.classList.toggle('hidden', mode !== 'word');

    // Show/hide callsign format control
    this.callsignFormatControl.classList.toggle('hidden', mode !== 'callsign');

    // Update slider
    this.wordLengthSlider.value = wordLength.toString();
    this.wordLengthValue.textContent = wordLength.toString();

    // Update word count info if in word mode
    if (mode === 'word') {
      this.updateWordCountInfo(wordLength);
    }

    // Update callsign format info if in callsign mode
    if (mode === 'callsign') {
      this.updateCallsignFormatInfo();
    }
  }

  private updateWordCountInfo(wordLength: WordLength): void {
    const activeChars = store.getActiveCharacters();
    const count = getAvailableWordCount(wordLength, activeChars);
    const available = isWordModeAvailable(wordLength, activeChars);

    if (!available) {
      this.wordCountInfo.textContent = 'No words available with current character set';
      this.wordCountInfo.classList.add('warning');
    } else {
      this.wordCountInfo.textContent = `${count} words available`;
      this.wordCountInfo.classList.remove('warning');
    }
  }

  private updateCallsignFormats(): void {
    const enabledFormats: string[] = [];
    this.formatCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        enabledFormats.push(checkbox.value);
      }
    });
    store.updateCallsignModeSettings({ enabledFormats });
    this.updateCallsignFormatInfo();
  }

  private updateCallsignFormatInfo(): void {
    const callsignSettings = store.getCallsignModeSettings();
    const enabledCount = callsignSettings.enabledFormats.length;

    if (enabledCount === 0) {
      this.callsignFormatInfo.textContent = 'Select at least one format';
      this.callsignFormatInfo.classList.add('warning');
    } else {
      // Show example callsign for the selected formats
      const examples: Record<string, string> = {
        '1x1': 'K1A',
        '1x2': 'W3AB',
        '2x1': 'KA5X',
        '2x2': 'WB2XY',
        '1x3': 'N7ABC',
        '2x3': 'KE9BOS',
      };
      const exampleList = callsignSettings.enabledFormats
        .slice(0, 3)
        .map(f => examples[f])
        .join(', ');
      const suffix = enabledCount > 3 ? '...' : '';
      this.callsignFormatInfo.textContent = `e.g., ${exampleList}${suffix}`;
      this.callsignFormatInfo.classList.remove('warning');
    }
  }

  setOnModeChange(callback: (mode: PracticeMode) => void): void {
    this.onModeChange = callback;
  }

  setOnChartToggle(callback: (mode: PracticeMode) => void): void {
    this.onChartToggle = callback;
  }

  getCurrentMode(): PracticeMode {
    return store.getWordModeSettings().practiceMode;
  }

  getCurrentWordLength(): WordLength {
    return store.getWordModeSettings().wordLength;
  }
}
