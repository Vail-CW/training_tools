// Vail Training Tools - Send Practice Module
// Morse code sending practice with USB CW key and MIDI support

document.addEventListener('DOMContentLoaded', () => {
	console.log('Send Practice module loaded');

	// State
	let sendPracticing = false;
	let targetChar = '';
	let sentChars = '';
	let lastTargetChar = '';
	let morseKeyer = null;
	let morseDecoder = null;
	let morseSounder = null;
	let morseInputHandler = null;

	// Stats
	let sendStats = {
		attempts: 0,
		correct: 0
	};

	// UI Elements
	const startSendBtn = document.getElementById('start-send-btn');
	const stopSendBtn = document.getElementById('stop-send-btn');
	const nextCharBtn = document.getElementById('next-char-btn');
	const targetCharDisplay = document.getElementById('target-character');
	const sentOutput = document.getElementById('sent-output');
	const sendModeSelect = document.getElementById('send-mode');
	const keyerModeSelect = document.getElementById('keyer-mode');

	/**
	 * Initialize morse input system
	 */
	function initMorseInput() {
		if (!morseDecoder) {
			// Initialize MorseProAdapter (enhanced decoder)
			morseDecoder = new MorseProAdapter(
				(letter) => {
					handleDecodedCharacter(letter);
				},
				(word) => {
					// Word completed - ignore for Send Practice
				}
			);

			// Initialize sounder
			morseSounder = new MorseSounder();

			// Initialize keyer
			morseKeyer = new MorseKeyer(morseSounder, morseDecoder);

			// Initialize unified input handler (MIDI + Keyboard)
			morseInputHandler = new MorseInputHandler(morseKeyer, () => {
				return sendPracticing;
			});

			// Set initial settings
			const toneSlider = document.getElementById('tone-freq');
			const tone = toneSlider ? parseFloat(toneSlider.value) : 600;
			morseKeyer.setTone(tone);

			// Get current WPM from slider
			const sendWpmSlider = document.getElementById('send-wpm');
			const wpm = sendWpmSlider ? parseInt(sendWpmSlider.value) : 20;
			morseKeyer.setWpm(wpm);

			// Set keyer mode
			const mode = keyerModeSelect ? parseInt(keyerModeSelect.value) : 7;
			morseKeyer.setMode(mode);
			morseInputHandler.setKeyerMode(mode);

			// Update dit duration for MIDI adapter
			const ditDuration = Math.round(60000 / (wpm * 50));
			morseInputHandler.setDitDuration(ditDuration);

			console.log('Morse input initialized with WPM:', wpm, 'Mode:', mode);
		}
	}

	/**
	 * Handle decoded characters from morse input
	 */
	function handleDecodedCharacter(char) {
		if (!sendPracticing) return;

		console.log('Decoded character:', char);

		// Strip out spaces
		if (char !== ' ') {
			sentChars += char;
			if (sentOutput) {
				sentOutput.value = sentChars;
			}

			// Flash the send lamp
			const sendLamp = document.querySelector('.send-lamp');
			if (sendLamp) {
				sendLamp.classList.add('active');
				setTimeout(() => {
					sendLamp.classList.remove('active');
				}, 200);
			}
		}

		// Check if sent characters match target
		const targetUpper = targetChar.toUpperCase();
		const sentUpper = sentChars.toUpperCase();

		if (sentUpper === targetUpper) {
			// Correct!
			console.log('Correct! Sent:', sentUpper, 'Target:', targetUpper);
			sendStats.attempts++;
			sendStats.correct++;
			updateSendStats();

			// Show big green "CORRECT!" message
			if (targetCharDisplay) {
				targetCharDisplay.innerHTML = '<span style="color: #48c774; font-size: 4rem; font-weight: bold;">✓ CORRECT!</span>';
				targetCharDisplay.style.backgroundColor = 'rgba(72, 199, 116, 0.1)';

				// Clear sent field
				sentChars = '';
				if (sentOutput) {
					sentOutput.value = '';
				}

				// Reset and show new target after delay
				setTimeout(() => {
					targetCharDisplay.style.backgroundColor = '';
					generateNewTarget();
				}, 1000);
			} else {
				// Fallback
				sentChars = '';
				if (sentOutput) sentOutput.value = '';
				setTimeout(() => generateNewTarget(), 500);
			}
		} else if (sentUpper.length >= targetChar.length) {
			// Wrong - sent enough characters but doesn't match
			console.log('Wrong! Sent:', sentUpper, 'Target:', targetUpper);
			sendStats.attempts++;
			updateSendStats();

			// Show visual feedback
			if (sentOutput) {
				sentOutput.style.borderColor = '#ff3860';
				setTimeout(() => {
					sentOutput.style.borderColor = '';
				}, 500);
			}

			// Clear sent field after brief delay
			setTimeout(() => {
				sentChars = '';
				if (sentOutput) sentOutput.value = '';
			}, 800);
		} else if (!targetUpper.startsWith(sentUpper)) {
			// Wrong character in sequence
			console.log('Wrong character! Sent:', sentUpper, 'Target:', targetUpper);
			sendStats.attempts++;
			updateSendStats();

			// Show visual feedback
			if (sentOutput) {
				sentOutput.style.borderColor = '#ff3860';
				setTimeout(() => {
					sentOutput.style.borderColor = '';
				}, 500);
			}

			// Clear sent field
			setTimeout(() => {
				sentChars = '';
				if (sentOutput) sentOutput.value = '';
			}, 500);
		}
	}

	/**
	 * Update send practice stats display
	 */
	function updateSendStats() {
		const attemptsEl = document.getElementById('stat-attempts');
		const correctEl = document.getElementById('stat-correct');
		const accuracyEl = document.getElementById('stat-accuracy');

		if (attemptsEl) attemptsEl.textContent = sendStats.attempts;
		if (correctEl) correctEl.textContent = sendStats.correct;
		if (accuracyEl) {
			const accuracy = sendStats.attempts > 0
				? Math.round((sendStats.correct / sendStats.attempts) * 100)
				: 0;
			accuracyEl.textContent = `${accuracy}%`;
		}
	}

	/**
	 * Generate new target character
	 */
	function generateNewTarget() {
		if (!sendPracticing) return;

		const mode = sendModeSelect ? sendModeSelect.value : 'letters';
		let characters = '';
		let newTarget = '';

		switch (mode) {
			case 'letters':
				characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
				break;
			case 'numbers':
				characters = '0123456789';
				break;
			case 'mixed':
				characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
				break;
			case 'words':
				// For words mode, pick a random word (avoid duplicates)
				let wordPool = commonWords.filter(w => w !== lastTargetChar);
				if (wordPool.length === 0) wordPool = commonWords;
				newTarget = wordPool[Math.floor(Math.random() * wordPool.length)];
				targetChar = newTarget;
				lastTargetChar = newTarget;
				if (targetCharDisplay) {
					targetCharDisplay.innerHTML = targetChar;
				}
				return;
		}

		// Pick random character (avoid duplicates)
		if (characters.length > 1) {
			let charPool = characters.split('').filter(c => c !== lastTargetChar).join('');
			if (charPool.length === 0) charPool = characters;
			newTarget = charPool.charAt(Math.floor(Math.random() * charPool.length));
		} else {
			newTarget = characters;
		}

		targetChar = newTarget;
		lastTargetChar = newTarget;
		if (targetCharDisplay) {
			targetCharDisplay.innerHTML = targetChar;
		}
	}

	/**
	 * Start send practice
	 */
	function startSendPractice() {
		console.log('Starting send practice...');
		sendPracticing = true;
		sentChars = '';
		lastTargetChar = '';

		// Reset stats
		sendStats.attempts = 0;
		sendStats.correct = 0;
		updateSendStats();

		// Update UI
		if (startSendBtn) startSendBtn.disabled = true;
		if (stopSendBtn) stopSendBtn.disabled = false;
		if (nextCharBtn) nextCharBtn.disabled = false;
		if (sentOutput) sentOutput.value = '';

		// Generate first target
		generateNewTarget();
	}

	/**
	 * Stop send practice
	 */
	function stopSendPractice() {
		console.log('Stopping send practice...');
		sendPracticing = false;

		// Update UI
		if (startSendBtn) startSendBtn.disabled = false;
		if (stopSendBtn) stopSendBtn.disabled = true;
		if (nextCharBtn) nextCharBtn.disabled = true;
		if (targetCharDisplay) {
			targetCharDisplay.innerHTML = '<span class="has-text-grey-light" style="font-size: 1.5rem;">Press Start to begin...</span>';
		}
	}

	// Event listeners
	if (startSendBtn) {
		startSendBtn.addEventListener('click', startSendPractice);
	}

	if (stopSendBtn) {
		stopSendBtn.addEventListener('click', stopSendPractice);
	}

	if (nextCharBtn) {
		nextCharBtn.addEventListener('click', () => {
			if (sendPracticing) {
				generateNewTarget();
			}
		});
	}

	// Keyer mode selector
	if (keyerModeSelect) {
		// Load saved keyer mode
		const savedKeyerMode = localStorage.getItem('vailTrainingKeyerMode');
		if (savedKeyerMode !== null) {
			keyerModeSelect.value = savedKeyerMode;
			const mode = parseInt(savedKeyerMode);
			if (morseKeyer) morseKeyer.setMode(mode);
			if (morseInputHandler) morseInputHandler.setKeyerMode(mode);
			console.log('Loaded keyer mode from localStorage:', mode);
		}

		keyerModeSelect.addEventListener('change', (e) => {
			const mode = parseInt(e.target.value);
			if (morseKeyer) {
				morseKeyer.setMode(mode);
				console.log('Keyer mode changed to:', mode);
			}
			if (morseInputHandler) {
				morseInputHandler.setKeyerMode(mode);
			}
			localStorage.setItem('vailTrainingKeyerMode', mode);
		});
	}

	// WPM slider
	const sendWpmSlider = document.getElementById('send-wpm');
	if (sendWpmSlider) {
		const sendWpmOutput = document.querySelector('output[for="send-wpm"]');

		// Load saved WPM
		const savedWpm = localStorage.getItem('vailTrainingSendWpm');
		if (savedWpm !== null) {
			sendWpmSlider.value = savedWpm;
			sendWpmOutput.textContent = savedWpm;
			const wpm = parseInt(savedWpm);

			const sendSpeedDisplay = document.getElementById('send-speed-display');
			if (sendSpeedDisplay) {
				sendSpeedDisplay.textContent = `${wpm} WPM`;
			}

			if (morseKeyer) morseKeyer.setWpm(wpm);
			if (morseInputHandler) {
				const ditDuration = Math.round(60000 / (wpm * 50));
				morseInputHandler.setDitDuration(ditDuration);
			}
		}

		sendWpmSlider.addEventListener('input', (e) => {
			const wpm = parseInt(e.target.value);
			sendWpmOutput.textContent = wpm;

			const sendSpeedDisplay = document.getElementById('send-speed-display');
			if (sendSpeedDisplay) {
				sendSpeedDisplay.textContent = `${wpm} WPM`;
			}

			if (morseKeyer) morseKeyer.setWpm(wpm);
			if (morseInputHandler) {
				const ditDuration = Math.round(60000 / (wpm * 50));
				morseInputHandler.setDitDuration(ditDuration);
			}

			localStorage.setItem('vailTrainingSendWpm', wpm);
		});
	}

	// Initialize morse input system
	initMorseInput();
});
