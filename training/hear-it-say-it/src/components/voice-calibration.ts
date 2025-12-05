import { store } from '../state/store';
import { SpeechRecognizer } from '../core/speech-recognition';
import { CHARACTER_SETS } from '../data/character-sets';

// All characters that can be calibrated
const ALL_CALIBRATION_CHARS = CHARACTER_SETS['Standard'].split('');

export class VoiceCalibration {
  private modal!: HTMLElement;
  private currentCharEl!: HTMLElement;
  private heardListEl!: HTMLElement;
  private progressEl!: HTMLElement;
  private progressTextEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private nextBtn!: HTMLElement;
  private skipBtn!: HTMLElement;
  private finishBtn!: HTMLElement;
  private cancelBtn!: HTMLElement;

  private recognizer: SpeechRecognizer;
  private currentIndex = 0;
  private chars: string[] = [];
  private isListening = false;
  private heardTranscripts: string[] = [];

  constructor() {
    this.createModal();
    this.recognizer = new SpeechRecognizer();
    this.setupRecognizer();
  }

  private createModal(): void {
    // Create modal HTML
    const modalHtml = `
      <div id="calibration-modal" class="modal hidden">
        <div class="modal-content glass-card calibration-modal">
          <h2>Voice Calibration</h2>
          <p class="calibration-instructions">
            Say each character clearly. We'll record how your voice sounds for better recognition.
            You can say the letter multiple ways (e.g., "E", "Echo", or however you naturally say it).
          </p>

          <div class="calibration-progress">
            <div class="progress-bar">
              <div id="calibration-progress-fill" class="progress-fill"></div>
            </div>
            <span id="calibration-progress-text">0 / 0</span>
          </div>

          <div class="calibration-char-display">
            <span class="label">Say this character:</span>
            <span id="calibration-current-char" class="big-char">A</span>
          </div>

          <div id="calibration-status" class="calibration-status">
            Press "Start Recording" to begin
          </div>

          <div class="calibration-heard">
            <span class="label">Heard patterns:</span>
            <div id="calibration-heard-list" class="heard-list"></div>
          </div>

          <div class="calibration-controls">
            <button id="calibration-record-btn" class="primary-btn">Start Recording</button>
            <button id="calibration-next-btn" class="secondary-btn" disabled>Next Character</button>
            <button id="calibration-skip-btn" class="secondary-btn">Skip</button>
          </div>

          <div class="calibration-actions">
            <button id="calibration-cancel-btn" class="danger-btn">Cancel</button>
            <button id="calibration-finish-btn" class="primary-btn" disabled>Finish Calibration</button>
          </div>
        </div>
      </div>
    `;

    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get references
    this.modal = document.getElementById('calibration-modal')!;
    this.currentCharEl = document.getElementById('calibration-current-char')!;
    this.heardListEl = document.getElementById('calibration-heard-list')!;
    this.progressEl = document.getElementById('calibration-progress-fill')!;
    this.progressTextEl = document.getElementById('calibration-progress-text')!;
    this.statusEl = document.getElementById('calibration-status')!;
    this.nextBtn = document.getElementById('calibration-next-btn')!;
    this.skipBtn = document.getElementById('calibration-skip-btn')!;
    this.finishBtn = document.getElementById('calibration-finish-btn')!;
    this.cancelBtn = document.getElementById('calibration-cancel-btn')!;

    const recordBtn = document.getElementById('calibration-record-btn')!;

    // Event listeners
    recordBtn.addEventListener('click', () => this.toggleRecording(recordBtn));
    this.nextBtn.addEventListener('click', () => this.nextCharacter());
    this.skipBtn.addEventListener('click', () => this.skipCharacter());
    this.finishBtn.addEventListener('click', () => this.finishCalibration());
    this.cancelBtn.addEventListener('click', () => this.close());
  }

  private setupRecognizer(): void {
    // Listen to ALL transcripts during calibration
    this.recognizer.onRaw((rawTranscript, _normalized) => {
      if (!this.isListening) return;

      const transcript = rawTranscript.toLowerCase().trim();
      if (transcript && !this.heardTranscripts.includes(transcript)) {
        this.heardTranscripts.push(transcript);
        this.updateHeardList();

        // Save to store immediately
        const currentChar = this.chars[this.currentIndex];
        store.addCalibrationEntry(currentChar, transcript);

        // Enable next button after at least one recording
        this.nextBtn.removeAttribute('disabled');
      }
    });
  }

  private toggleRecording(btn: HTMLElement): void {
    if (this.isListening) {
      this.stopRecording(btn);
    } else {
      this.startRecording(btn);
    }
  }

  private startRecording(btn: HTMLElement): void {
    this.isListening = true;
    this.recognizer.start();
    btn.textContent = 'Stop Recording';
    btn.classList.add('recording');
    this.statusEl.textContent = 'Listening... Say the character!';
    this.statusEl.classList.add('listening');
  }

  private stopRecording(btn: HTMLElement): void {
    this.isListening = false;
    this.recognizer.stop();
    btn.textContent = 'Start Recording';
    btn.classList.remove('recording');
    this.statusEl.textContent = this.heardTranscripts.length > 0
      ? `Recorded ${this.heardTranscripts.length} pattern(s). Click Next or record more.`
      : 'No patterns recorded. Try again or skip.';
    this.statusEl.classList.remove('listening');
  }

  private updateHeardList(): void {
    this.heardListEl.innerHTML = this.heardTranscripts
      .map(t => `<span class="heard-tag">${t}</span>`)
      .join('');
  }

  private nextCharacter(): void {
    // Stop any active recording
    const recordBtn = document.getElementById('calibration-record-btn')!;
    if (this.isListening) {
      this.stopRecording(recordBtn);
    }

    this.currentIndex++;
    if (this.currentIndex >= this.chars.length) {
      // All done
      this.finishBtn.removeAttribute('disabled');
      this.statusEl.textContent = 'All characters calibrated! Click Finish to save.';
      return;
    }

    this.showCurrentChar();
  }

  private skipCharacter(): void {
    // Stop any active recording
    const recordBtn = document.getElementById('calibration-record-btn')!;
    if (this.isListening) {
      this.stopRecording(recordBtn);
    }

    this.currentIndex++;
    if (this.currentIndex >= this.chars.length) {
      this.finishBtn.removeAttribute('disabled');
      this.statusEl.textContent = 'Calibration complete! Click Finish to save.';
      return;
    }

    this.showCurrentChar();
  }

  private showCurrentChar(): void {
    const char = this.chars[this.currentIndex];
    this.currentCharEl.textContent = char;

    // Reset heard list for this character
    this.heardTranscripts = [...store.getCalibrationForChar(char)];
    this.updateHeardList();

    // Update progress
    const progress = ((this.currentIndex) / this.chars.length) * 100;
    this.progressEl.style.width = `${progress}%`;
    this.progressTextEl.textContent = `${this.currentIndex} / ${this.chars.length}`;

    // Reset buttons
    this.nextBtn.setAttribute('disabled', 'true');
    if (this.heardTranscripts.length > 0) {
      this.nextBtn.removeAttribute('disabled');
    }

    this.statusEl.textContent = 'Press "Start Recording" to begin';
    this.statusEl.classList.remove('listening');
  }

  private finishCalibration(): void {
    store.completeCalibration();
    this.close();
  }

  open(chars?: string[]): void {
    // Use provided chars or default to all
    this.chars = chars || [...ALL_CALIBRATION_CHARS];
    this.currentIndex = 0;
    this.heardTranscripts = [];

    // Reset finish button
    this.finishBtn.setAttribute('disabled', 'true');

    // Show first character
    this.showCurrentChar();

    // Show modal
    this.modal.classList.remove('hidden');
  }

  close(): void {
    // Stop recording if active
    const recordBtn = document.getElementById('calibration-record-btn')!;
    if (this.isListening) {
      this.stopRecording(recordBtn);
    }

    this.modal.classList.add('hidden');
  }
}
