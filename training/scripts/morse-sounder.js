// Morse Sounder - Generates sidetone audio for morse key input
// Simplified version for training tools (no ES6 modules)

class MorseSounder {
  constructor() {
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
    this.tone = 600;
    this.isOn = false;
  }

  initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  setTone(frequency) {
    this.tone = frequency;
  }

  on() {
    if (this.isOn) return;

    const ctx = this.initAudio();

    // Create new oscillator and gain node
    this.oscillator = ctx.createOscillator();
    this.gainNode = ctx.createGain();

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);

    this.oscillator.frequency.value = this.tone;
    this.oscillator.type = 'sine';

    // Get volume from settings
    const volumeSlider = document.getElementById('masterGain');
    const volume = volumeSlider ? (volumeSlider.value / 100) * 0.3 : 0.3;

    // Envelope to avoid clicks (5ms attack)
    const attackTime = 0.005;
    const now = ctx.currentTime;

    this.gainNode.gain.setValueAtTime(0, now);
    this.gainNode.gain.linearRampToValueAtTime(volume, now + attackTime);

    this.oscillator.start(now);
    this.isOn = true;
  }

  off() {
    if (!this.isOn || !this.oscillator) return;

    const ctx = this.audioContext;
    const releaseTime = 0.005;
    const now = ctx.currentTime;

    // Envelope to avoid clicks (5ms release)
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

    // Stop oscillator after release
    this.oscillator.stop(now + releaseTime);

    this.isOn = false;
    this.oscillator = null;
    this.gainNode = null;
  }
}
