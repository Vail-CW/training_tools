import { store } from '../state/store';
import { SESSION_ORDER } from '../data/character-sets';
import { ALL_CHARACTERS, getCharDisplayName } from '../data/morse-codes';
import { exportHistory, importHistory, resetAllHistory } from '../state/persistence';
import { playTestTone } from '../core/morse-audio';
import { VoiceCalibration } from './voice-calibration';
import { isMobile } from '../core/speech-recognition';

export class SettingsPanel {
  private panel: HTMLElement;
  private settingsToggle: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;

  // Sliders
  private speedSlider: HTMLInputElement;
  private speedValue: HTMLElement;
  private gainSlider: HTMLInputElement;
  private gainValue: HTMLElement;
  private repeatToggle: HTMLInputElement;
  private maxTriesSlider: HTMLInputElement;
  private maxTriesValue: HTMLElement;
  private maxTriesGroup: HTMLElement;
  private strictNatoToggle: HTMLInputElement;
  private freqSlider: HTMLInputElement;
  private freqValue: HTMLElement;

  // Character selection
  private characterSetsEl: HTMLElement;
  private customCharsEl: HTMLElement;

  // History buttons
  private saveBtn: HTMLButtonElement;
  private loadBtn: HTMLButtonElement;
  private fileInput: HTMLInputElement;
  private resetBtn: HTMLButtonElement;

  // Voice calibration
  private voiceCalibration: VoiceCalibration;
  private calibrateBtn: HTMLButtonElement | null = null;
  private clearCalibrationBtn: HTMLButtonElement | null = null;
  private calibrationStatusEl: HTMLElement | null = null;

  constructor() {
    this.panel = document.getElementById('settings-panel') as HTMLElement;
    this.settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement;
    this.closeBtn = document.getElementById('close-settings') as HTMLButtonElement;

    this.speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
    this.speedValue = document.getElementById('speed-value') as HTMLElement;
    this.gainSlider = document.getElementById('gain-slider') as HTMLInputElement;
    this.gainValue = document.getElementById('gain-value') as HTMLElement;
    this.repeatToggle = document.getElementById('repeat-toggle') as HTMLInputElement;
    this.maxTriesSlider = document.getElementById('max-tries-slider') as HTMLInputElement;
    this.maxTriesValue = document.getElementById('max-tries-value') as HTMLElement;
    this.maxTriesGroup = document.getElementById('max-tries-group') as HTMLElement;
    this.strictNatoToggle = document.getElementById('strict-nato-toggle') as HTMLInputElement;
    this.freqSlider = document.getElementById('freq-slider') as HTMLInputElement;
    this.freqValue = document.getElementById('freq-value') as HTMLElement;

    this.characterSetsEl = document.getElementById('character-sets') as HTMLElement;
    this.customCharsEl = document.getElementById('custom-chars') as HTMLElement;

    this.saveBtn = document.getElementById('save-history') as HTMLButtonElement;
    this.loadBtn = document.getElementById('load-history') as HTMLButtonElement;
    this.fileInput = document.getElementById('history-file') as HTMLInputElement;
    this.resetBtn = document.getElementById('reset-history') as HTMLButtonElement;

    // Initialize voice calibration
    this.voiceCalibration = new VoiceCalibration();
    this.insertCalibrationSection();

    this.setupEventListeners();
    this.initializeValues();
    this.renderCharacterSets();
    this.renderCustomCharacters();
    this.updateCalibrationStatus();
  }

  private insertCalibrationSection(): void {
    // Skip calibration section on mobile (uses continuous recognition mode instead)
    if (isMobile()) return;

    // Find the actions section and insert calibration section before it
    const actionsSection = this.panel.querySelector('.setting-group.actions');
    if (!actionsSection) return;

    const calibrationSection = document.createElement('div');
    calibrationSection.className = 'setting-group';
    calibrationSection.innerHTML = `
      <h3>Voice Calibration</h3>
      <p class="calibration-info">Train the app to recognize your voice for better accuracy.</p>
      <div id="calibration-status" class="calibration-status-display"></div>
      <div class="calibration-buttons">
        <button id="calibrate-btn" class="secondary-btn">Calibrate Voice</button>
        <button id="clear-calibration-btn" class="secondary-btn" style="display: none;">Clear Calibration</button>
      </div>
    `;

    actionsSection.parentNode?.insertBefore(calibrationSection, actionsSection);

    // Get references
    this.calibrateBtn = document.getElementById('calibrate-btn') as HTMLButtonElement;
    this.clearCalibrationBtn = document.getElementById('clear-calibration-btn') as HTMLButtonElement;
    this.calibrationStatusEl = document.getElementById('calibration-status') as HTMLElement;

    // Event listeners
    this.calibrateBtn.addEventListener('click', () => {
      this.voiceCalibration.open();
    });

    this.clearCalibrationBtn.addEventListener('click', () => {
      if (confirm('Clear all voice calibration data?')) {
        store.clearCalibration();
        this.updateCalibrationStatus();
      }
    });

    // Subscribe to calibration changes
    store.subscribe('voiceCalibration', () => this.updateCalibrationStatus());
  }

  private updateCalibrationStatus(): void {
    if (!this.calibrationStatusEl || !this.clearCalibrationBtn) return;

    const calibration = store.getVoiceCalibration();
    const charCount = Object.keys(calibration.calibration).length;

    if (calibration.isCalibrated) {
      const date = new Date(calibration.calibratedAt).toLocaleDateString();
      this.calibrationStatusEl.innerHTML = `
        <span class="status-icon">✓</span>
        Calibrated on ${date} (${charCount} characters)
      `;
      this.calibrationStatusEl.className = 'calibration-status-display calibrated';
      this.clearCalibrationBtn.style.display = 'inline-block';
    } else if (charCount > 0) {
      this.calibrationStatusEl.innerHTML = `
        <span class="status-icon">⋯</span>
        Partial calibration (${charCount} characters)
      `;
      this.calibrationStatusEl.className = 'calibration-status-display partial';
      this.clearCalibrationBtn.style.display = 'inline-block';
    } else {
      this.calibrationStatusEl.innerHTML = `
        <span class="status-icon">○</span>
        Not calibrated
      `;
      this.calibrationStatusEl.className = 'calibration-status-display';
      this.clearCalibrationBtn.style.display = 'none';
    }
  }

  private setupEventListeners(): void {
    // Panel toggle
    this.settingsToggle.addEventListener('click', () => this.toggle());
    this.closeBtn.addEventListener('click', () => this.close());

    // Close on click outside (on overlay)
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.close();
    });

    // Sliders
    this.speedSlider.addEventListener('input', () => {
      const value = parseInt(this.speedSlider.value);
      this.speedValue.textContent = value.toString();
      store.updateSettings({ characterSpeed: value });
    });

    this.gainSlider.addEventListener('input', () => {
      const value = parseInt(this.gainSlider.value);
      this.gainValue.textContent = value.toString();
      store.updateSettings({ adaptiveGain: value });
    });

    this.repeatToggle.addEventListener('change', () => {
      store.updateSettings({ repeatUntilCorrect: this.repeatToggle.checked });
      this.updateMaxTriesVisibility();
    });

    this.maxTriesSlider.addEventListener('input', () => {
      const value = parseInt(this.maxTriesSlider.value);
      this.maxTriesValue.textContent = value === 6 ? 'Unlimited' : value.toString();
      store.updateSettings({ maxRepeatTries: value });
    });

    this.strictNatoToggle.addEventListener('change', () => {
      store.updateSettings({ strictNatoMode: this.strictNatoToggle.checked });
    });

    this.freqSlider.addEventListener('input', () => {
      const value = parseInt(this.freqSlider.value);
      this.freqValue.textContent = value.toString();
      store.updateSettings({ toneFrequency: value });
    });

    // Play test tone on frequency change end
    this.freqSlider.addEventListener('change', () => {
      const settings = store.getSettings();
      playTestTone(settings.toneFrequency, 200, settings.volume);
    });

    // History buttons
    this.saveBtn.addEventListener('click', () => exportHistory());

    this.loadBtn.addEventListener('click', () => this.fileInput.click());

    this.fileInput.addEventListener('change', async () => {
      const file = this.fileInput.files?.[0];
      if (file) {
        const success = await importHistory(file);
        if (success) {
          this.initializeValues();
          this.renderCharacterSets();
          this.renderCustomCharacters();
          alert('History loaded successfully!');
        } else {
          alert('Failed to load history file.');
        }
        this.fileInput.value = '';
      }
    });

    this.resetBtn.addEventListener('click', () => resetAllHistory());

    // Subscribe to state changes
    store.subscribe('settings', () => this.initializeValues());
    store.subscribe('characterSet', () => {
      this.renderCharacterSets();
      this.renderCustomCharacters();
    });
  }

  private initializeValues(): void {
    const settings = store.getSettings();

    this.speedSlider.value = settings.characterSpeed.toString();
    this.speedValue.textContent = settings.characterSpeed.toString();

    this.gainSlider.value = settings.adaptiveGain.toString();
    this.gainValue.textContent = settings.adaptiveGain.toString();

    this.repeatToggle.checked = settings.repeatUntilCorrect;

    this.maxTriesSlider.value = settings.maxRepeatTries.toString();
    this.maxTriesValue.textContent = settings.maxRepeatTries === 6 ? 'Unlimited' : settings.maxRepeatTries.toString();
    this.updateMaxTriesVisibility();

    this.strictNatoToggle.checked = settings.strictNatoMode;

    this.freqSlider.value = settings.toneFrequency.toString();
    this.freqValue.textContent = settings.toneFrequency.toString();
  }

  private updateMaxTriesVisibility(): void {
    const settings = store.getSettings();
    if (settings.repeatUntilCorrect) {
      this.maxTriesGroup.classList.remove('hidden');
    } else {
      this.maxTriesGroup.classList.add('hidden');
    }
  }

  private renderCharacterSets(): void {
    const config = store.getCharacterSet();
    const setNames = ['Standard', 'Letters Only', 'Numbers Only', ...SESSION_ORDER];

    this.characterSetsEl.innerHTML = '';

    for (const name of setNames) {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.className = config.selectedSets.includes(name) ? 'active' : '';

      btn.addEventListener('click', () => {
        const current = store.getCharacterSet();
        let newSets: string[];

        if (current.selectedSets.includes(name)) {
          // Remove if already selected
          newSets = current.selectedSets.filter((s) => s !== name);
        } else {
          // Add to selection
          newSets = [...current.selectedSets, name];
        }

        // Ensure at least one set is selected
        if (newSets.length === 0) {
          newSets = ['Standard'];
        }

        store.updateCharacterSet({ selectedSets: newSets });
      });

      this.characterSetsEl.appendChild(btn);
    }
  }

  private renderCustomCharacters(): void {
    const config = store.getCharacterSet();
    const activeChars = store.getActiveCharacters();

    this.customCharsEl.innerHTML = '';

    for (const char of ALL_CHARACTERS) {
      const btn = document.createElement('button');
      btn.textContent = getCharDisplayName(char);

      const isActive = activeChars.includes(char);
      const isExcluded = config.excluded.includes(char);

      if (isExcluded) {
        btn.className = 'excluded';
        btn.title = 'Excluded (click to include)';
      } else if (isActive) {
        btn.className = 'active';
        btn.title = 'Active (click to exclude)';
      } else {
        btn.title = 'Not in selected sets (click to include)';
      }

      btn.addEventListener('click', () => {
        const current = store.getCharacterSet();
        let newIncluded = [...current.included];
        let newExcluded = [...current.excluded];

        if (current.excluded.includes(char)) {
          // Was excluded -> make active
          newExcluded = newExcluded.filter((c) => c !== char);
        } else if (activeChars.includes(char)) {
          // Was active -> exclude
          newExcluded.push(char);
          newIncluded = newIncluded.filter((c) => c !== char);
        } else {
          // Was inactive -> include
          newIncluded.push(char);
        }

        store.updateCharacterSet({
          included: newIncluded,
          excluded: newExcluded,
        });
      });

      this.customCharsEl.appendChild(btn);
    }
  }

  toggle(): void {
    this.panel.classList.toggle('hidden');
    this.panel.classList.toggle('visible');
  }

  open(): void {
    this.panel.classList.remove('hidden');
    this.panel.classList.add('visible');
  }

  close(): void {
    this.panel.classList.add('hidden');
    this.panel.classList.remove('visible');
  }
}
