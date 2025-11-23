/**
 * Morse Pro Adapter - Enhanced decoder for Free Practice
 *
 * This adapter matches the Vail repeater decoder architecture:
 * - Buffer-based timing system (not timeout-based)
 * - Prosign detection (AR, BT, SK, BK, etc.)
 * - Adaptive timing with weighted averaging
 * - Word/character counting
 * - Speed calculation (WPM)
 *
 * @author Vail Training Tools
 * @license MIT
 */

class MorseProAdapter {
	constructor(onCharacterCallback, onWordCallback) {
		this.onCharacterCallback = onCharacterCallback || function() {};
		this.onWordCallback = onWordCallback || function() {};

		// Enhanced morse code mappings including prosigns
		this.morseToChar = {
			'.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
			'..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
			'-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
			'.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
			'..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
			'--..': 'Z',
			'-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
			'.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
			'.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'", '-.-.--': '!',
			'-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&', '---...': ':',
			'-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_',
			'.-..-.': '"', '...-..-': '$', '.--.-.': '@',
			// Prosigns (special sequences sent as single characters)
			'.-.-': '<AR>',     // End of message
			'-...-': '<BT>',    // Break / pause (same as = but treated as prosign)
			'...-.-': '<SK>',   // End of contact
			'-...-.-': '<BK>',  // Break-in
			'...-.': '<SN>',    // Understood
			'.--.-': '<AA>',    // New line
			'.-...': '<AS>',    // Wait
			'-.-.-': '<CT>',    // Start copying
			'....-.': '<HH>',   // Error
			'...-...': '<SOS>', // Distress signal
			'...---...': '<SOS>' // Alternative SOS
		};

		// Buffer-based timing (Vail decoder architecture)
		this.lastKeyDownTime = null;
		this.lastKeyUpTime = null;
		this.unusedTimes = [];  // Buffer of timings waiting to be decoded
		this.noiseThreshold = 1;  // Durations <= 1ms are noise
		this.pendingWordGap = false;  // Flag for word gap detection
		this.autoFlushTimeout = null;  // Timeout for auto-flushing pending characters

		// Adaptive timing (matches Vail decoder)
		this.ditLengths = [];
		this.dahLengths = [];
		this.bufferSize = 30;
		this._ditLen = 120;  // Default 10 WPM
		this._fditLen = 120;  // Farnsworth dit (same as regular for now)

		// Thresholds (updated when dit length changes)
		this._ditDahThreshold = 0;
		this._dahSpaceThreshold = 0;
		this.updateThresholds();

		// Statistics
		this.totalCharacters = 0;
		this.totalWords = 0;
		this.sessionStartTime = null;
		this.lastCharacterTime = null;
		this.lastCharOutput = '';  // Track last character output (for space detection)
	}

	/**
	 * Update thresholds based on current dit length (Vail decoder line 64-67)
	 */
	updateThresholds() {
		// Dit/dah threshold: midpoint between 1× dit and 3× dit = 2× dit
		this._ditDahThreshold = ((1 * this._ditLen) + (3 * this._ditLen)) / 2;
		// Space threshold: midpoint between 3× dit and 7× dit = 5× dit
		this._dahSpaceThreshold = ((3 * this._fditLen) + (7 * this._fditLen)) / 2;
	}

	/**
	 * Record a key-down event (compatible with MorseKeyer interface)
	 */
	keyOn() {
		this.lastKeyDownTime = Date.now();

		// If we have a previous key-up, calculate the silence duration
		if (this.lastKeyUpTime !== null) {
			const silenceDuration = -(this.lastKeyDownTime - this.lastKeyUpTime);
			this.addTiming(silenceDuration);
		}
	}

	/**
	 * Record a key-up event and decode the element (dit or dah)
	 * (compatible with MorseKeyer interface)
	 */
	keyOff() {
		if (!this.lastKeyDownTime) return;

		const duration = Date.now() - this.lastKeyDownTime;
		this.lastKeyUpTime = Date.now();

		// Add the tone duration (positive = tone)
		this.addTiming(duration);

		// Set auto-flush timeout to force decode after 2 seconds of inactivity
		if (this.autoFlushTimeout) {
			clearTimeout(this.autoFlushTimeout);
		}
		this.autoFlushTimeout = setTimeout(() => {
			// Force flush by adding a long silence
			if (this.lastKeyUpTime) {
				const silenceDuration = -(Date.now() - this.lastKeyUpTime);
				this.addTiming(silenceDuration);
			}
		}, 2000);
	}

	/**
	 * Add a timing to the buffer (Vail decoder line 160-185)
	 * Positive durations = tone (dit/dah)
	 * Negative durations = silence (gap)
	 */
	addTiming(duration) {
		if (duration === 0) return;

		// Combine consecutive same-sign durations or filter noise
		if (this.unusedTimes.length > 0) {
			const last = this.unusedTimes[this.unusedTimes.length - 1];

			if (duration * last > 0) {
				// Same sign - combine them
				this.unusedTimes.pop();
				duration = last + duration;
			} else if (Math.abs(duration) <= this.noiseThreshold) {
				// Very short duration - assume noise and merge with previous
				this.unusedTimes.pop();
				duration = last - duration;  // Take care of sign change
			}
		}

		this.unusedTimes.push(duration);

		// If we just received a character gap or longer, flush (Vail decoder line 181)
		if (-duration >= this._ditDahThreshold) {
			this.flush();
		}
	}

	/**
	 * Process the buffer of unused timings (Vail decoder line 192-228)
	 * Converts timings to morse code and then to characters
	 */
	flush() {
		// Make sure there is something to decode
		if (this.unusedTimes.length === 0) {
			return;
		}

		// If the last character output was a space, ignore any leading quiet
		// (Vail decoder line 195-200)
		if (this.lastCharOutput === ' ') {
			if (this.unusedTimes[0] < 0) {
				this.unusedTimes.shift();
			}
		}

		// Make sure there is (still) something to decode
		if (this.unusedTimes.length === 0) {
			return;
		}

		// If last element is quiet but not enough for a space, pop it off temporarily
		const last = this.unusedTimes[this.unusedTimes.length - 1];
		if ((last < 0) && (-last < this._dahSpaceThreshold)) {
			this.unusedTimes.pop();
		}

		// Convert timings to morse code (dots and dashes)
		this.pendingWordGap = false;  // Reset before conversion
		const morse = this.timings2morse(this.unusedTimes);

		// Decode morse to text (only process actual morse, not empty strings)
		if (morse && morse.length > 0) {
			const char = this.morseToChar[morse] || '#';

			// Update statistics
			if (!this.sessionStartTime) {
				this.sessionStartTime = Date.now();
			}
			this.lastCharacterTime = Date.now();
			this.totalCharacters++;

			// If there was a word gap BEFORE this character, output space first
			if (this.pendingWordGap) {
				this.onCharacterCallback(' ');
				this.totalWords++;
				this.lastCharOutput = ' ';
			}

			// Then notify callback with the character
			this.onCharacterCallback(char);
			this.lastCharOutput = char;
		}

		// Put the silence back on the buffer in case more quiet is coming
		if (last < 0) {
			this.unusedTimes = [last];
		} else {
			this.unusedTimes = [];
		}
	}

	/**
	 * Convert timings to morse code dots and dashes (Vail decoder line 236-263)
	 * Returns just the morse pattern (dots/dashes), silences are handled separately
	 */
	timings2morse(times) {
		let ditdah = '';
		let hasWordGap = false;

		console.log('timings2morse: processing', times.length, 'timings:', times);

		for (let i = 0; i < times.length; i++) {
			let d = times[i];
			let c = '';

			if (d > 0) {
				// Tone - dit or dah
				if (d < this._ditDahThreshold) {
					c = '.';
					this.addDecode(d, '.');
				} else {
					c = '-';
					this.addDecode(d, '-');
				}
				ditdah += c;  // Only add dots and dashes to the morse string
			} else {
				// Silence - inter-element gap, letter gap, or word gap
				d = -d;
				console.log('  Silence:', d, 'ms (index', i, '). Thresholds: dit/dah=', this._ditDahThreshold.toFixed(1), 'space=', this._dahSpaceThreshold.toFixed(1));

				const isFirstElement = (i === 0);
				const isLastElement = (i === times.length - 1);
				const isWordGapSilence = (d >= this._dahSpaceThreshold);

				// Skip leading silence if it's a word gap - but mark that we found one
				// This silence is leftover from the PREVIOUS character's trailing gap
				if (isFirstElement && isWordGapSilence) {
					console.log('    -> Leading word gap detected! Setting hasWordGap=true');
					hasWordGap = true;
					this.addDecode(d, '/');
					continue;
				}

				// Skip trailing silence - it will be re-evaluated when next character comes
				// (The flush() already popped it off if it was < 5× dit)
				if (isLastElement) {
					console.log('    -> Skipping trailing silence (will be re-evaluated)');
					if (isWordGapSilence) {
						this.addDecode(d, '/');
					} else if (d >= this._ditDahThreshold) {
						this.addDecode(d, ' ');
					} else {
						this.addDecode(d, '');
					}
					continue;
				}

				// Only check interior silences for word gaps
				if (d < this._ditDahThreshold) {
					// Inter-element gap (within character)
					console.log('    -> Inter-element gap');
					this.addDecode(d, '');
				} else if (d < this._dahSpaceThreshold) {
					// Letter gap (between characters)
					console.log('    -> Letter gap');
					this.addDecode(d, ' ');
				} else {
					// Word gap BETWEEN tones in this character
					console.log('    -> Interior WORD GAP! Setting pendingWordGap=true');
					hasWordGap = true;
					this.addDecode(d, '/');
				}
			}
		}

		console.log('  Result morse:', ditdah, 'hasWordGap:', hasWordGap);

		// Store if we detected a word gap (will be used after decoding)
		this.pendingWordGap = hasWordGap;

		return ditdah;
	}

	/**
	 * Store timing and decoded character element for adaptive learning (Vail decoder line 271-274)
	 */
	addDecode(duration, character) {
		// Adapt timing based on decoded elements
		let dit;

		switch (character) {
			case '.':
				dit = duration;
				break;
			case '-':
				dit = duration / 3;
				break;
			case '':
				dit = duration;
				break;
		}

		if (dit) {
			this.ditLengths.push(dit);
			this.ditLengths = this.ditLengths.slice(-this.bufferSize);

			// Update average dit length with weighted averaging (Vail decoder line 84-112)
			let sum = 0;
			let denom = 0;

			for (let i = 0; i < this.bufferSize; i++) {
				const weight = i + 1;  // Linear weighting (more recent = higher weight)
				if (this.ditLengths[i] !== undefined) {
					sum += this.ditLengths[i] * weight;
					denom += weight;
				}
			}

			if (denom) {
				this._ditLen = sum / denom;
				this._fditLen = this._ditLen;  // For now, no Farnsworth
				this.updateThresholds();
			}
		}
	}

	/**
	 * Calculate current Words Per Minute (WPM)
	 * PARIS method: 50 dit units per word
	 */
	getWPM() {
		if (this._ditLen === 0) return 0;
		return Math.round(60000 / (this._ditLen * 50));
	}

	/**
	 * Get session statistics
	 */
	getStatistics() {
		const sessionDuration = this.sessionStartTime
			? (Date.now() - this.sessionStartTime) / 1000
			: 0;

		return {
			totalCharacters: this.totalCharacters,
			totalWords: this.totalWords,
			sessionDuration: sessionDuration,
			currentWPM: this.getWPM(),
			averageDitDuration: Math.round(this._ditLen)
		};
	}

	/**
	 * Reset the decoder
	 */
	reset() {
		this.unusedTimes = [];
		this.ditLengths = [];
		this.dahLengths = [];
		this.totalCharacters = 0;
		this.totalWords = 0;
		this.sessionStartTime = null;
		this.lastCharacterTime = null;
		this.lastKeyDownTime = null;
		this.lastKeyUpTime = null;
		this.pendingWordGap = false;
		this.lastCharOutput = '';
	}

	/**
	 * Set WPM manually (for synchronization with UI)
	 */
	setWPM(wpm) {
		this._ditLen = 60000 / (wpm * 50);
		this._fditLen = this._ditLen;
		this.updateThresholds();
	}

	/**
	 * Set unit duration (for compatibility with MorseKeyer)
	 * @param {number} unit - Dit duration in milliseconds
	 */
	setUnit(unit) {
		this._ditLen = unit;
		this._fditLen = unit;
		this.updateThresholds();
		console.log('MorseProAdapter: setUnit called with', unit, 'ms. Dit/dah threshold:', this._ditDahThreshold.toFixed(1), 'ms, Space threshold:', this._dahSpaceThreshold.toFixed(1), 'ms');
	}

	/**
	 * Check if a character is a prosign
	 */
	isProsign(char) {
		return char && char.startsWith('<') && char.endsWith('>');
	}
}

// Make available globally
if (typeof window !== 'undefined') {
	window.MorseProAdapter = MorseProAdapter;
}
