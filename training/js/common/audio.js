// Vail Training Tools - Shared Audio System
// Web Audio API initialization, playTone, playMorseSequence

let audioContext = null;
let isPlaying = false;

/**
 * Initialize or get the Web Audio API context
 * @returns {AudioContext} The audio context
 */
function initAudioContext() {
	if (!audioContext) {
		audioContext = new (window.AudioContext || window.webkitAudioContext)();
	}
	return audioContext;
}

/**
 * Calculate timing based on WPM (PARIS method)
 * @param {number} wpm - Words per minute
 * @returns {Object} Timing values in milliseconds
 */
function getTimingFromWPM(wpm) {
	// Standard: PARIS method - dit duration in milliseconds
	// 1 WPM = 50 dit units per minute
	const ditDuration = 1200 / wpm; // milliseconds
	return {
		dit: ditDuration,
		dah: ditDuration * 3,
		elementGap: ditDuration,      // gap between dits/dahs in same letter
		letterGap: ditDuration * 3,   // gap between letters
		wordGap: ditDuration * 7      // gap between words
	};
}

/**
 * Play a tone using Web Audio API
 * @param {number} frequency - Tone frequency (may be overridden by settings)
 * @param {number} duration - Duration in milliseconds
 * @param {number} startTime - When to start the tone (audio context time)
 * @returns {OscillatorNode} The oscillator node
 */
function playTone(frequency, duration, startTime) {
	const ctx = initAudioContext();
	const oscillator = ctx.createOscillator();
	const gainNode = ctx.createGain();

	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);

	// Get volume from settings (0-100, convert to 0-1)
	const volumeSlider = document.getElementById('masterGain');
	const volume = volumeSlider ? (volumeSlider.value / 100) * 0.3 : 0.3; // Max 0.3 to avoid clipping

	// Get frequency from settings
	const toneSlider = document.getElementById('tone-freq');
	const toneFreq = toneSlider ? parseFloat(toneSlider.value) : frequency;

	oscillator.frequency.value = toneFreq;
	oscillator.type = 'sine';

	// Envelope to avoid clicks (5ms attack/release)
	const attackTime = 0.005;
	const releaseTime = 0.005;
	const now = startTime || ctx.currentTime;

	gainNode.gain.setValueAtTime(0, now);
	gainNode.gain.linearRampToValueAtTime(volume, now + attackTime);
	gainNode.gain.setValueAtTime(volume, now + (duration / 1000) - releaseTime);
	gainNode.gain.linearRampToValueAtTime(0, now + (duration / 1000));

	oscillator.start(now);
	oscillator.stop(now + (duration / 1000));

	return oscillator;
}

/**
 * Play Morse code sequence
 * @param {string} text - Text to play as morse code
 * @param {number} wpm - Speed in words per minute
 * @param {string} lampSelector - CSS selector for the lamp indicator (default: '.recv-lamp')
 * @returns {number} Total duration of the sequence in milliseconds
 */
async function playMorseSequence(text, wpm, lampSelector = '.recv-lamp') {
	if (isPlaying) {
		console.log('Already playing, skipping...');
		return 0;
	}
	isPlaying = true;

	const ctx = initAudioContext();
	const timing = getTimingFromWPM(wpm);
	let currentTime = ctx.currentTime;

	const lamp = document.querySelector(lampSelector);
	if (lamp) lamp.classList.add('active');

	// Convert text to morse and play
	for (let i = 0; i < text.length; i++) {
		const char = text[i].toUpperCase();

		if (char === ' ') {
			// Word space
			currentTime += timing.wordGap / 1000;
		} else if (morseCode[char]) {
			const morse = morseCode[char];

			// Play each dit/dah
			for (let j = 0; j < morse.length; j++) {
				const element = morse[j];
				const duration = element === '.' ? timing.dit : timing.dah;

				playTone(600, duration, currentTime);
				currentTime += duration / 1000;

				// Add element gap (except after last element)
				if (j < morse.length - 1) {
					currentTime += timing.elementGap / 1000;
				}
			}

			// Add letter gap (except after last letter)
			if (i < text.length - 1 && text[i + 1] !== ' ') {
				currentTime += timing.letterGap / 1000;
			}
		}
	}

	// Calculate total duration and turn off lamp when done
	const totalDuration = (currentTime - ctx.currentTime) * 1000;
	setTimeout(() => {
		isPlaying = false;
		if (lamp) lamp.classList.remove('active');
	}, totalDuration);

	return totalDuration;
}
