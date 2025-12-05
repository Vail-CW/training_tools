// Vail Training Tools - Free Practice
// Freeform morse sending with real-time decoding and MP3 recording

document.addEventListener('DOMContentLoaded', () => {
	console.log('Free Practice module loading...');

	//==========================================
	// MORSE INPUT SYSTEM (Shared with Send Practice)
	//==========================================

	let morseSounder = null;
	let morseDecoder = null;  // MorseProAdapter for Free Practice
	let morseKeyer = null;
	let morseInputHandler = null;

	/**
	 * Initialize the morse input system
	 */
	function initMorseInput() {
		console.log('Initializing morse input system for Free Practice...');

		// Get settings from UI
		const volumeSlider = document.getElementById('masterGain');
		const toneSlider = document.getElementById('tone-freq');
		const volume = volumeSlider ? parseInt(volumeSlider.value) / 100 : 0.5;
		const frequency = toneSlider ? parseInt(toneSlider.value) : 600;

		// Create sounder (sidetone generator)
		morseSounder = new MorseSounder(frequency, volume);

		// Create decoder (MorseProAdapter for prosign support and adaptive timing)
		morseDecoder = new MorseProAdapter(
			// Character callback
			(char) => {
				onFreePracticeCharacter(char);
			},
			// Word callback (optional)
			() => {
				// Word gap detected
			}
		);

		// Get WPM from slider
		const wpmSlider = document.getElementById('free-wpm');
		const wpm = wpmSlider ? parseInt(wpmSlider.value) : 20;

		// Create keyer with initial WPM
		morseKeyer = new MorseKeyer(morseSounder, morseDecoder, wpm);

		// Set initial keyer mode from selector
		const keyerModeSelect = document.getElementById('free-keyer-mode');
		if (keyerModeSelect) {
			morseKeyer.setMode(parseInt(keyerModeSelect.value));
		}

		// Create input handler - always active for Free Practice
		morseInputHandler = new MorseInputHandler(morseKeyer, () => true);

		// Set initial WPM on MIDI adapter
		const ditDuration = Math.round(60000 / (wpm * 50));
		morseInputHandler.setDitDuration(ditDuration);

		// Set initial keyer mode on MIDI adapter
		if (keyerModeSelect) {
			morseInputHandler.setKeyerMode(parseInt(keyerModeSelect.value));
		}

		// Update MIDI status display
		updateMidiStatus();

		// Listen for volume changes
		if (volumeSlider) {
			volumeSlider.addEventListener('input', (e) => {
				const vol = parseInt(e.target.value) / 100;
				if (morseSounder) {
					morseSounder.setVolume(vol);
				}
			});
		}

		// Listen for tone frequency changes
		if (toneSlider) {
			toneSlider.addEventListener('input', (e) => {
				const freq = parseInt(e.target.value);
				if (morseSounder) {
					morseSounder.setFrequency(freq);
				}
			});
		}

		console.log('Morse input system initialized for Free Practice');
	}

	/**
	 * Update MIDI status display
	 */
	function updateMidiStatus() {
		const midiStatus = document.getElementById('free-midi-status');
		if (!midiStatus) return;

		// Check periodically for MIDI connection
		const checkMidi = () => {
			if (morseInputHandler && morseInputHandler.midiConnected) {
				midiStatus.textContent = 'Connected';
				midiStatus.classList.remove('is-danger');
				midiStatus.classList.add('is-success');
			} else {
				midiStatus.textContent = 'Not Detected';
				midiStatus.classList.remove('is-success');
				midiStatus.classList.add('is-danger');
			}
		};

		// Check immediately and then periodically
		checkMidi();
		setInterval(checkMidi, 2000);
	}

	//==========================================
	// FREE PRACTICE MODULE
	//==========================================

	let freePracticeState = {
		isRecording: false,
		audioRecorder: null,
		recordedBlob: null,
		outputText: '',
		characterCount: 0,
		wordCount: 0
	};

	// Free Practice Elements
	const freeKeyerModeSelect = document.getElementById('free-keyer-mode');
	const freeWpmSlider = document.getElementById('free-wpm');
	const freeWpmOutput = document.querySelector('output[for="free-wpm"]');
	const freePracticeOutput = document.getElementById('free-practice-output');
	const clearOutputBtn = document.getElementById('clear-output-btn');
	const copyOutputBtn = document.getElementById('copy-output-btn');
	const startRecordingBtn = document.getElementById('start-recording-btn');
	const stopRecordingBtn = document.getElementById('stop-recording-btn');
	const downloadRecordingBtn = document.getElementById('download-recording-btn');
	const discardRecordingBtn = document.getElementById('discard-recording-btn');
	const playbackPreviewArea = document.getElementById('playback-preview-area');
	const playbackAudio = document.getElementById('playback-audio');
	const freeLamp = document.querySelector('.free-lamp');
	const freeMidiStatus = document.getElementById('free-midi-status');
	const recordingStatus = document.getElementById('recording-status');
	const recordingTime = document.getElementById('recording-time');
	const recordingTimeDisplay = document.getElementById('recording-time-display');
	const recordingDurationDisplay = document.getElementById('recording-duration-display');
	const charCountDisplay = document.getElementById('char-count-display');
	const wordCountDisplay = document.getElementById('word-count-display');
	const speedIndicator = document.getElementById('speed-indicator');
	const statCharacters = document.getElementById('stat-characters');
	const statWords = document.getElementById('stat-words');
	const statSpeed = document.getElementById('stat-speed');

	/**
	 * Initialize Free Practice module
	 */
	function initFreePractice() {
		console.log('Initializing Free Practice...');

		// Initialize morse input system
		initMorseInput();

		// Load saved WPM or use default from slider
		const savedWpm = localStorage.getItem('vailTrainingFreeWpm');
		if (savedWpm) {
			freeWpmSlider.value = savedWpm;
			if (freeWpmOutput) freeWpmOutput.textContent = savedWpm;
			console.log('Loaded Free Practice WPM from localStorage:', savedWpm);
		} else if (freeWpmOutput) {
			freeWpmOutput.textContent = freeWpmSlider.value;
		}

		// Always set the WPM to Free Practice's value (whether saved or default)
		const wpm = parseInt(freeWpmSlider.value);
		if (morseKeyer) {
			morseKeyer.setWpm(wpm);
			console.log('Free Practice: Set keyer WPM to', wpm);
		}

		// Update decoder adapter with current WPM
		if (morseDecoder) {
			const ditDuration = Math.round(60000 / (wpm * 50));
			morseDecoder.setUnit(ditDuration);
			console.log('Free Practice: Set decoder dit duration to', ditDuration, 'ms');
		}

		// Update MIDI adapter with current WPM
		if (morseInputHandler) {
			const ditDuration = Math.round(60000 / (wpm * 50));
			morseInputHandler.setDitDuration(ditDuration);
			console.log('Free Practice: Set MIDI adapter dit duration to', ditDuration, 'ms');
		}

		// Load saved keyer mode
		const savedKeyerMode = localStorage.getItem('vailTrainingFreeKeyerMode');
		if (savedKeyerMode) {
			freeKeyerModeSelect.value = savedKeyerMode;
			// Apply to shared keyer
			const mode = parseInt(savedKeyerMode);
			if (morseKeyer) {
				morseKeyer.setMode(mode);
			}
			if (morseInputHandler) {
				morseInputHandler.setKeyerMode(mode);
			}
		}

		// Set initial WPM slider visibility and straight key notice based on keyer mode
		const initialMode = parseInt(freeKeyerModeSelect.value);
		const wpmColumn = freeWpmSlider.closest('.column');
		const straightKeyNotice = document.getElementById('straight-key-notice');
		if (initialMode === 1) {
			// Straight key mode - hide WPM slider, show notice
			wpmColumn.style.display = 'none';
			if (straightKeyNotice) straightKeyNotice.style.display = 'block';
		} else {
			// Iambic/Ultimatic modes - show WPM slider, hide notice
			wpmColumn.style.display = 'block';
			if (straightKeyNotice) straightKeyNotice.style.display = 'none';
		}

		console.log('Free Practice initialized (always active)');

		// WPM slider
		freeWpmSlider.addEventListener('input', (e) => {
			const wpm = parseInt(e.target.value);
			if (freeWpmOutput) freeWpmOutput.textContent = wpm;

			// Update shared keyer
			if (morseKeyer) {
				morseKeyer.setWpm(wpm);
				console.log('Free Practice WPM updated to:', wpm);
			}

			// Update decoder adapter (MorseProAdapter)
			if (morseDecoder) {
				const ditDuration = Math.round(60000 / (wpm * 50));
				morseDecoder.setUnit(ditDuration);
				console.log('Free Practice decoder dit duration updated to:', ditDuration, 'ms');
			}

			// Update MIDI adapter dit duration
			if (morseInputHandler) {
				const ditDuration = Math.round(60000 / (wpm * 50));
				morseInputHandler.setDitDuration(ditDuration);
				console.log('Free Practice MIDI dit duration updated to:', ditDuration, 'ms');
			}

			// Save to localStorage
			localStorage.setItem('vailTrainingFreeWpm', wpm);
		});

		// Keyer mode selector
		freeKeyerModeSelect.addEventListener('change', (e) => {
			const mode = parseInt(e.target.value);

			// Update shared keyer
			if (morseKeyer) {
				morseKeyer.setMode(mode);
				console.log('Free Practice keyer mode changed to:', mode);
			}

			// Update MIDI adapter keyer mode
			if (morseInputHandler) {
				morseInputHandler.setKeyerMode(mode);
				console.log('Free Practice MIDI keyer mode updated to:', mode);
			}

			// Update WPM slider visibility and straight key notice
			const wpmColumn = freeWpmSlider.closest('.column');
			const straightKeyNotice = document.getElementById('straight-key-notice');
			if (mode === 1) {
				// Straight key mode - hide WPM slider, show notice (decoder will adapt automatically)
				wpmColumn.style.display = 'none';
				if (straightKeyNotice) straightKeyNotice.style.display = 'block';
			} else {
				// Iambic/Ultimatic modes - show WPM slider, hide notice
				wpmColumn.style.display = 'block';
				if (straightKeyNotice) straightKeyNotice.style.display = 'none';
			}

			// Save to localStorage
			localStorage.setItem('vailTrainingFreeKeyerMode', mode);
		});

		// Clear Output button
		clearOutputBtn.addEventListener('click', clearFreePracticeOutput);

		// Copy Output button
		copyOutputBtn.addEventListener('click', copyFreePracticeOutput);

		// Start Recording button
		startRecordingBtn.addEventListener('click', startFreePracticeRecording);

		// Stop Recording button
		stopRecordingBtn.addEventListener('click', stopFreePracticeRecording);

		// Download Recording button
		downloadRecordingBtn.addEventListener('click', downloadFreePracticeRecording);

		// Discard Recording button
		discardRecordingBtn.addEventListener('click', discardFreePracticeRecording);

		console.log('Free Practice initialized and always active');
	}

	/**
	 * Handle decoded character for Free Practice
	 */
	function onFreePracticeCharacter(char) {
		// Add character to output
		freePracticeState.outputText += char;
		freePracticeState.characterCount++;

		// Count words (split by spaces and filter empty strings)
		const words = freePracticeState.outputText.trim().split(/\s+/).filter(w => w.length > 0);
		freePracticeState.wordCount = words.length;

		// Update output textarea
		freePracticeOutput.value = freePracticeState.outputText;

		// Auto-scroll to bottom
		freePracticeOutput.scrollTop = freePracticeOutput.scrollHeight;

		// Update character count display
		charCountDisplay.textContent = `${freePracticeState.characterCount} chars`;

		// Update word count display
		wordCountDisplay.textContent = `${freePracticeState.wordCount} words`;

		// Update speed indicator from decoder
		if (morseDecoder) {
			const wpm = morseDecoder.getWPM();
			speedIndicator.textContent = `${wpm} WPM`;
		}

		// Update stats sidebar
		if (statCharacters) statCharacters.textContent = freePracticeState.characterCount;
		if (statWords) statWords.textContent = freePracticeState.wordCount;
		if (statSpeed && morseDecoder) {
			statSpeed.textContent = `${morseDecoder.getWPM()} WPM`;
		}

		// Flash lamp
		if (freeLamp) {
			freeLamp.classList.add('active');
			setTimeout(() => {
				freeLamp.classList.remove('active');
			}, 100);
		}

		console.log('Free Practice decoded character:', char);
	}

	/**
	 * Clear output textarea
	 */
	function clearFreePracticeOutput() {
		freePracticeState.outputText = '';
		freePracticeState.characterCount = 0;
		freePracticeState.wordCount = 0;

		freePracticeOutput.value = '';
		charCountDisplay.textContent = '0 chars';
		wordCountDisplay.textContent = '0 words';

		// Reset stats sidebar
		if (statCharacters) statCharacters.textContent = '0';
		if (statWords) statWords.textContent = '0';

		console.log('Free Practice output cleared');
	}

	/**
	 * Copy output to clipboard
	 */
	function copyFreePracticeOutput() {
		const text = freePracticeOutput.value;

		if (!text) {
			console.log('Nothing to copy');
			return;
		}

		navigator.clipboard.writeText(text).then(() => {
			// Show success feedback
			copyOutputBtn.classList.add('is-success');
			const originalHTML = copyOutputBtn.innerHTML;
			copyOutputBtn.innerHTML = '<span class="icon"><i class="mdi mdi-check"></i></span><span>Copied!</span>';

			setTimeout(() => {
				copyOutputBtn.classList.remove('is-success');
				copyOutputBtn.innerHTML = originalHTML;
			}, 2000);

			console.log('Copied to clipboard:', text.length, 'characters');
		}).catch(err => {
			console.error('Failed to copy:', err);
			alert('Failed to copy to clipboard');
		});
	}

	/**
	 * Start recording
	 */
	function startFreePracticeRecording() {
		// Initialize audio recorder if not already done
		if (!freePracticeState.audioRecorder) {
			// Make sure morse sounder has initialized audio context
			if (!morseSounder || !morseSounder.audioContext) {
				console.log('Initializing audio context for recording...');
				if (morseSounder) {
					morseSounder.initAudio();
				} else {
					console.error('Morse sounder not initialized');
					alert('Please send at least one character before recording to initialize audio.');
					return;
				}
			}

			// Create a dedicated gain node for recording that persists
			const recordingGainNode = morseSounder.audioContext.createGain();
			recordingGainNode.gain.value = 1.0;

			// Store the original sounder methods
			const originalOn = morseSounder.on.bind(morseSounder);
			const originalOff = morseSounder.off.bind(morseSounder);

			// Create audio recorder with dedicated gain node
			freePracticeState.audioRecorder = new AudioRecorder(
				recordingGainNode,
				morseSounder.audioContext
			);

			// Patch sounder to also output to recording gain node
			morseSounder.on = function() {
				originalOn();
				// Connect oscillator to recording gain node if recording
				if (freePracticeState.isRecording && this.oscillator) {
					this.oscillator.connect(recordingGainNode);
				}
			};

			morseSounder.off = function() {
				// Disconnect from recording gain before stopping
				if (this.oscillator && recordingGainNode) {
					try {
						this.oscillator.disconnect(recordingGainNode);
					} catch (e) {
						// Already disconnected
					}
				}
				originalOff();
			};

			console.log('Audio recorder initialized');
		}

		console.log('Starting recording...');

		freePracticeState.isRecording = true;

		// Start recorder
		freePracticeState.audioRecorder.start((duration) => {
			// Update time display
			recordingTime.textContent = AudioRecorder.formatDuration(duration);
		});

		// Update UI
		startRecordingBtn.style.display = 'none';
		stopRecordingBtn.style.display = 'inline-flex';
		stopRecordingBtn.disabled = false;
		recordingStatus.textContent = 'Recording';
		recordingStatus.classList.remove('is-light');
		recordingStatus.classList.add('recording');
		recordingTimeDisplay.style.display = 'block';

		console.log('Recording started');
	}

	/**
	 * Stop recording
	 */
	function stopFreePracticeRecording() {
		if (!freePracticeState.audioRecorder) {
			console.error('Audio recorder not initialized');
			return;
		}

		console.log('Stopping recording...');

		freePracticeState.isRecording = false;

		// Stop recorder
		freePracticeState.audioRecorder.stop();

		// Update UI
		startRecordingBtn.style.display = 'inline-flex';
		stopRecordingBtn.style.display = 'none';
		recordingStatus.textContent = 'Processing...';
		recordingStatus.classList.remove('recording');
		recordingStatus.classList.add('is-warning');

		// Encode to MP3 (this may take a moment)
		setTimeout(() => {
			try {
				freePracticeState.recordedBlob = freePracticeState.audioRecorder.encodeToMP3();

				// Show playback preview
				const audioURL = freePracticeState.audioRecorder.createAudioURL(freePracticeState.recordedBlob);
				playbackAudio.src = audioURL;
				playbackPreviewArea.style.display = 'block';

				// Update duration display
				const duration = freePracticeState.audioRecorder.recordingDuration;
				recordingDurationDisplay.textContent = `Duration: ${AudioRecorder.formatDuration(duration)}`;

				// Update status
				recordingStatus.textContent = 'Ready';
				recordingStatus.classList.remove('is-warning');
				recordingStatus.classList.add('is-success');

				console.log('Recording ready for preview');
			} catch (err) {
				console.error('Failed to encode MP3:', err);
				alert('Failed to encode recording to MP3: ' + err.message);

				recordingStatus.textContent = 'Error';
				recordingStatus.classList.remove('is-warning');
				recordingStatus.classList.add('is-danger');
			}
		}, 100);
	}

	/**
	 * Download recording as MP3
	 */
	function downloadFreePracticeRecording() {
		if (!freePracticeState.recordedBlob) {
			console.error('No recording to download');
			return;
		}

		console.log('Downloading recording...');

		freePracticeState.audioRecorder.downloadMP3(freePracticeState.recordedBlob);

		// Hide preview
		playbackPreviewArea.style.display = 'none';
		freePracticeState.recordedBlob = null;

		// Reset recorder
		freePracticeState.audioRecorder.reset();

		// Update UI
		recordingStatus.textContent = 'Idle';
		recordingStatus.classList.remove('is-success');
		recordingStatus.classList.add('is-light');
		recordingTimeDisplay.style.display = 'none';
		recordingTime.textContent = '0:00';

		console.log('Recording downloaded');
	}

	/**
	 * Discard recording
	 */
	function discardFreePracticeRecording() {
		console.log('Discarding recording...');

		// Hide preview
		playbackPreviewArea.style.display = 'none';
		freePracticeState.recordedBlob = null;

		// Reset recorder
		freePracticeState.audioRecorder.reset();

		// Update UI
		recordingStatus.textContent = 'Idle';
		recordingStatus.classList.remove('is-success');
		recordingStatus.classList.add('is-light');
		recordingTimeDisplay.style.display = 'none';
		recordingTime.textContent = '0:00';

		console.log('Recording discarded');
	}

	// Initialize Free Practice on page load
	initFreePractice();
});
