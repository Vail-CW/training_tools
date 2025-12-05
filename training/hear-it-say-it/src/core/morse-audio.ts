import { MORSE_CODES } from '../data/morse-codes';

// Singleton AudioContext
let audioContext: AudioContext | null = null;

// Track active oscillators so we can cancel them
let activeOscillators: OscillatorNode[] = [];
let playbackAborted = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Stop all currently playing audio
export function stopAllAudio(): void {
  playbackAborted = true;
  for (const osc of activeOscillators) {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // Already stopped
    }
  }
  activeOscillators = [];
}

// Resume audio context (required after user gesture on mobile)
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

// Calculate morse timing based on WPM
// PARIS standard: "PARIS " = 50 units, at 1 WPM takes 1 minute
// Therefore: 1 unit = 60000ms / (50 * WPM) = 1200 / WPM ms
function getMorseTiming(wpm: number) {
  const ditDuration = 1200 / wpm;
  return {
    dit: ditDuration,
    dah: ditDuration * 3,
    intraCharGap: ditDuration, // gap between elements within a character
    interCharGap: ditDuration * 3, // gap between characters (not used for single char)
  };
}

// Play a single tone
function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  startTime: number,
  volume: number
): OscillatorNode {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // Envelope to avoid clicks
  const attackTime = 0.005;
  const releaseTime = 0.005;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + attackTime);
  gainNode.gain.setValueAtTime(volume, startTime + duration - releaseTime);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);

  // Track for cleanup
  activeOscillators.push(oscillator);
  oscillator.onended = () => {
    activeOscillators = activeOscillators.filter((o) => o !== oscillator);
  };

  return oscillator;
}

// Play morse code for a character
export async function playMorseCharacter(
  char: string,
  wpm: number = 25,
  frequency: number = 700,
  volume: number = 0.5
): Promise<boolean> {
  // Stop any currently playing audio first
  stopAllAudio();
  playbackAborted = false;

  const code = MORSE_CODES[char.toUpperCase()];
  if (!code) {
    console.warn(`No morse code found for character: ${char}`);
    return false;
  }

  const ctx = getAudioContext();
  await resumeAudioContext();

  const timing = getMorseTiming(wpm);
  let currentTime = ctx.currentTime + 0.05; // Small delay to ensure scheduling works

  // Calculate total duration for the promise
  let totalDuration = 0;

  for (let i = 0; i < code.length; i++) {
    const element = code[i];
    const elementDuration = element === '.' ? timing.dit : timing.dah;

    playTone(ctx, frequency, elementDuration / 1000, currentTime, volume);

    currentTime += elementDuration / 1000;
    totalDuration += elementDuration;

    // Add gap between elements (except after the last one)
    if (i < code.length - 1) {
      currentTime += timing.intraCharGap / 1000;
      totalDuration += timing.intraCharGap;
    }
  }

  // Return a promise that resolves when playback is complete
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return true if completed, false if aborted
      resolve(!playbackAborted);
    }, totalDuration + 50);
  });
}

// Play morse code for a complete word with proper inter-character gaps
export async function playMorseWord(
  word: string,
  wpm: number = 25,
  frequency: number = 700,
  volume: number = 0.5
): Promise<boolean> {
  // Stop any currently playing audio first
  stopAllAudio();
  playbackAborted = false;

  const ctx = getAudioContext();
  await resumeAudioContext();

  const timing = getMorseTiming(wpm);
  let currentTime = ctx.currentTime + 0.05; // Small delay to ensure scheduling works
  let totalDuration = 0;

  const chars = word.toUpperCase().split('');

  for (let charIndex = 0; charIndex < chars.length; charIndex++) {
    const char = chars[charIndex];
    const code = MORSE_CODES[char];

    if (!code) {
      console.warn(`No morse code found for character: ${char}`);
      continue;
    }

    // Play each element of the character
    for (let i = 0; i < code.length; i++) {
      const element = code[i];
      const elementDuration = element === '.' ? timing.dit : timing.dah;

      playTone(ctx, frequency, elementDuration / 1000, currentTime, volume);

      currentTime += elementDuration / 1000;
      totalDuration += elementDuration;

      // Intra-character gap (between elements within a character)
      if (i < code.length - 1) {
        currentTime += timing.intraCharGap / 1000;
        totalDuration += timing.intraCharGap;
      }
    }

    // Inter-character gap (between characters in the word)
    if (charIndex < chars.length - 1) {
      currentTime += timing.interCharGap / 1000;
      totalDuration += timing.interCharGap;
    }
  }

  // Return a promise that resolves when playback is complete
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return true if completed, false if aborted
      resolve(!playbackAborted);
    }, totalDuration + 50);
  });
}

// Play a test tone (for audio calibration)
export async function playTestTone(
  frequency: number = 700,
  duration: number = 500,
  volume: number = 0.5
): Promise<void> {
  const ctx = getAudioContext();
  await resumeAudioContext();

  playTone(ctx, frequency, duration / 1000, ctx.currentTime, volume);

  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

// Play ascending tone for correct response
export async function playCorrectTone(volume: number = 0.3): Promise<void> {
  const ctx = getAudioContext();
  await resumeAudioContext();

  const duration = 0.1; // 100ms per note
  const now = ctx.currentTime;

  // Ascending: C5 (523Hz) → E5 (659Hz)
  playTone(ctx, 523, duration, now, volume);
  playTone(ctx, 659, duration, now + duration, volume);
}

// Play descending tone for incorrect response
export async function playIncorrectTone(volume: number = 0.3): Promise<void> {
  const ctx = getAudioContext();
  await resumeAudioContext();

  const duration = 0.1; // 100ms per note
  const now = ctx.currentTime;

  // Descending: E5 (659Hz) → C5 (523Hz)
  playTone(ctx, 659, duration, now, volume);
  playTone(ctx, 523, duration, now + duration, volume);
}

// Get the morse code pattern for a character (for display)
export function getMorsePattern(char: string): string {
  return MORSE_CODES[char.toUpperCase()] || '';
}
