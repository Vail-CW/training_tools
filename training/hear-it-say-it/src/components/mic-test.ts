import { isSpeechRecognitionSupported, isIOS, normalizeRecognizedText } from '../core/speech-recognition';

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
  onaudiostart: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
}

export class MicTest {
  private testBtn: HTMLButtonElement;
  private levelContainer: HTMLElement;
  private levelBar: HTMLElement;
  private resultEl: HTMLElement;

  private recognition: SpeechRecognitionInstance | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationId: number | null = null;
  private isTesting = false;

  constructor() {
    this.testBtn = document.getElementById('mic-test-btn') as HTMLButtonElement;
    this.levelContainer = document.getElementById('mic-level-container') as HTMLElement;
    this.levelBar = document.getElementById('mic-level') as HTMLElement;
    this.resultEl = document.getElementById('mic-result') as HTMLElement;

    this.setupEventListeners();
    this.checkSupport();
  }

  private checkSupport(): void {
    if (!isSpeechRecognitionSupported()) {
      const iosMsg = isIOS()
        ? 'Speech recognition requires Safari on iOS. Also ensure Siri is enabled in Settings.'
        : 'Speech recognition not supported. Try Chrome, Edge, or Safari.';
      this.resultEl.innerHTML = `<span class="error">${iosMsg}</span>`;
      this.testBtn.disabled = true;
      return;
    }

    // Initialize speech recognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass() as SpeechRecognitionInstance;
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 5;
    this.recognition.lang = 'en-US';

    this.setupRecognitionHandlers();
  }

  private setupEventListeners(): void {
    this.testBtn.addEventListener('click', () => this.toggleTest());
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onaudiostart = () => {
      console.log('onaudiostart fired');
      this.resultEl.innerHTML = '<span class="listening">🎤 Listening... Say any letter (like "A", "B", "Alpha", etc.)</span>';
    };

    this.recognition.onstart = () => {
      console.log('onstart fired - recognition is active');
    };

    this.recognition.onspeechstart = () => {
      console.log('onspeechstart fired - speech detected');
    };

    this.recognition.onspeechend = () => {
      console.log('onspeechend fired - speech ended');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let bestTranscript = '';
      let bestNormalized: string | null = null;

      // Check all results and alternatives
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript;
          const normalized = normalizeRecognizedText(transcript);

          if (!bestTranscript) {
            bestTranscript = transcript;
          }
          if (normalized && !bestNormalized) {
            bestNormalized = normalized;
          }
        }

        if (result.isFinal) {
          this.stopTest();

          if (bestNormalized) {
            this.resultEl.innerHTML = `
              <span class="success">✓ Heard: "${bestTranscript}" → Recognized as: <strong>${bestNormalized}</strong></span>
              <br><small style="color: var(--text-muted);">Microphone is working! You can start practicing.</small>
            `;
          } else {
            this.resultEl.innerHTML = `
              <span class="error">✗ Heard: "${bestTranscript}" - Not recognized as a valid character.</span>
              <br><small style="color: var(--text-muted);">Try saying a single letter like "A", "B", or use NATO phonetic like "Alpha", "Bravo".</small>
            `;
          }
          return;
        }
      }

      // Show interim results
      if (bestTranscript) {
        this.resultEl.innerHTML = `<span class="listening">Hearing: "${bestTranscript}"...</span>`;
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('onerror fired:', event.error);

      if (event.error === 'not-allowed') {
        this.resultEl.innerHTML = `
          <span class="error">✗ Microphone access denied!</span>
          <br><small style="color: var(--text-muted);">Click the lock icon in your browser's address bar and allow microphone access, then refresh.</small>
        `;
        this.stopTest();
      } else if (event.error === 'no-speech') {
        this.resultEl.innerHTML = `
          <span class="error">✗ No speech detected.</span>
          <br><small style="color: var(--text-muted);">Make sure your microphone is working and speak clearly. Check your system audio settings.</small>
        `;
        this.stopTest();
      } else if (event.error === 'audio-capture') {
        this.resultEl.innerHTML = `
          <span class="error">✗ No microphone found!</span>
          <br><small style="color: var(--text-muted);">Please connect a microphone and refresh the page.</small>
        `;
        this.stopTest();
      }
    };

    this.recognition.onend = () => {
      console.log('onend fired - isTesting:', this.isTesting);
      if (this.isTesting) {
        // Timed out without result
        this.resultEl.innerHTML = `
          <span class="error">✗ No speech detected in time.</span>
          <br><small style="color: var(--text-muted);">Try again - speak clearly and loudly.</small>
        `;
        this.stopTest();
      }
    };
  }

  private async toggleTest(): Promise<void> {
    if (this.isTesting) {
      this.stopTest();
    } else {
      await this.startTest();
    }
  }

  private async startTest(): Promise<void> {
    this.isTesting = true;
    this.testBtn.textContent = 'Stop Test';
    this.testBtn.classList.add('testing');
    this.levelContainer.classList.remove('hidden');
    this.resultEl.innerHTML = '<span class="listening">Starting microphone...</span>';

    // iOS Safari quirk: recreate SpeechRecognition instance on each test
    // Some iOS versions require a fresh instance from a user gesture
    if (isSpeechRecognitionSupported()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass() as SpeechRecognitionInstance;
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 5;
      this.recognition.lang = 'en-US';
      this.setupRecognitionHandlers();
      console.log('Created fresh SpeechRecognition instance');
    }

    // Start audio level visualization
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      this.analyser.fftSize = 256;
      this.updateLevel();

      // Log which device is being used
      const tracks = this.mediaStream.getAudioTracks();
      if (tracks.length > 0) {
        console.log('Using microphone:', tracks[0].label);
        this.resultEl.innerHTML = `<span class="listening">Using: ${tracks[0].label || 'Default Microphone'}</span>`;
      }
    } catch (err) {
      console.error('Failed to get audio stream:', err);
      this.resultEl.innerHTML = `
        <span class="error">✗ Could not access microphone.</span>
        <br><small style="color: var(--text-muted);">Please allow microphone access when prompted.</small>
      `;
      this.stopTest();
      return;
    }

    // Start Web Speech API recognition
    if (this.recognition) {
      try {
        console.log('Calling recognition.start()...');
        this.recognition.start();
        console.log('recognition.start() called successfully');
      } catch (err) {
        console.error('Failed to start recognition:', err);
        this.resultEl.innerHTML = `
          <span class="error">✗ Failed to start speech recognition</span>
          <br><small style="color: var(--text-muted);">Error: ${err}</small>
        `;
      }
    }
  }

  private stopTest(): void {
    this.isTesting = false;
    this.testBtn.textContent = 'Test Microphone';
    this.testBtn.classList.remove('testing');
    this.levelContainer.classList.add('hidden');
    this.levelBar.style.width = '0%';

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }

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
  }

  private updateLevel(): void {
    if (!this.analyser || !this.isTesting) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);

    this.levelBar.style.width = `${level}%`;

    this.animationId = requestAnimationFrame(() => this.updateLevel());
  }
}
