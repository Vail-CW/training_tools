// Vail Training Tools JavaScript
// This will handle the Morse code practice functionality

document.addEventListener('DOMContentLoaded', () => {
	console.log('Training.js module loaded');

	// Get UI elements
	const startBtn = document.getElementById('start-btn');
	const repeatBtn = document.getElementById('repeat-btn');
	const checkBtn = document.getElementById('check-btn');
	const showAnswerBtn = document.getElementById('show-answer-btn');
	const continueBtn = document.getElementById('continue-btn');
	const stopBtn = document.getElementById('stop-btn');
	const answerInput = document.getElementById('answer-input');
	const morseVisual = document.getElementById('morse-visual');
	const resultArea = document.getElementById('result-area');
	const resultText = document.getElementById('result-text');
	const correctAnswer = document.getElementById('correct-answer');

	console.log('UI Elements check:', {
		startBtn: !!startBtn,
		repeatBtn: !!repeatBtn,
		checkBtn: !!checkBtn,
		stopBtn: !!stopBtn,
		answerInput: !!answerInput,
		morseVisual: !!morseVisual,
		resultArea: !!resultArea,
		resultText: !!resultText,
		correctAnswer: !!correctAnswer
	});

	// Statistics
	let stats = {
		attempts: 0,
		correct: 0,
		accuracy: 0
	};

	// Practice state
	let isPracticing = false;
	let currentAnswer = '';
	let currentSpeed = 12;
	let customCharacters = new Set();

	// Morse code map
	const morseCode = {
		'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
		'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
		'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
		'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
		'Y': '-.--', 'Z': '--..',
		'0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
		'5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
		// Prosigns
		'AR': '.-.-.', 'BT': '-...-', 'BK': '-...-.-', 'SK': '...-.-'
	};

	// Common words for practice (mix of ham radio terms and common English words)
	const commonWords = [
		// Ham radio specific terms
		'THE', 'AND', 'TO', 'OF', 'A', 'IN', 'IS', 'IT', 'YOU', 'THAT',
		'HE', 'WAS', 'FOR', 'ON', 'ARE', 'WITH', 'AS', 'I', 'HIS', 'THEY',
		'BE', 'AT', 'ONE', 'HAVE', 'THIS', 'FROM', 'OR', 'HAD', 'BY', 'BUT',
		'NOT', 'WHAT', 'ALL', 'WERE', 'WE', 'WHEN', 'YOUR', 'CAN', 'SAID', 'THERE',
		'UP', 'OUT', 'IF', 'ABOUT', 'WHO', 'GET', 'WHICH', 'GO', 'ME', 'WHEN',
		// Ham radio terms
		'HAM', 'RADIO', 'ANTENNA', 'RIG', 'QSO', 'QSL', 'QTH', 'NAME', 'HERE',
		'CALL', 'SIGNAL', 'FREQ', 'BAND', 'CW', 'POWER', 'WX', 'TEMP', 'CLEAR',
		'GOOD', 'BAD', 'WEAK', 'STRONG', 'COPY', 'ROGER', 'OVER', 'OUT', 'BREAK',
		// Numbers as words
		'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
		// Useful short words
		'YES', 'NO', 'NOW', 'NEW', 'OLD', 'DAY', 'WAY', 'MAY', 'BIG', 'USE',
		'HER', 'SHE', 'HIM', 'HOW', 'MAN', 'BOY', 'DID', 'ITS', 'LET', 'PUT',
		'SAY', 'SEE', 'TRY', 'WHY', 'MY', 'SO', 'DO', 'GO', 'HI', 'AM'
	];

	// CW Academy Beginner Course Sessions (cumulative character sets)
	// Each session includes all characters and prosigns from current and previous sessions
	const cwAcademySessions = {
		1: { chars: 'AENT', prosigns: [], numbers: '' },
		2: { chars: 'AENTSIO', prosigns: [], numbers: '14' },
		3: { chars: 'AENTSIOHDLR', prosigns: [], numbers: '1425' },
		4: { chars: 'AENTSIOHDLRCU', prosigns: [], numbers: '1425' },
		5: { chars: 'AENTSIOHDLRCUMW', prosigns: [], numbers: '142536' },
		6: { chars: 'AENTSIOHDLRCUMWFY', prosigns: [], numbers: '142536' },
		7: { chars: 'AENTSIOHDLRCUMWFYGPQ', prosigns: [], numbers: '14253679' },
		8: { chars: 'AENTSIOHDLRCUMWFYGPQBV', prosigns: ['AR'], numbers: '14253679' },
		9: { chars: 'AENTSIOHDLRCUMWFYGPQBVJK', prosigns: ['AR', 'BT'], numbers: '0145236789' },
		10: { chars: 'AENTSIOHDLRCUMWFYGPQBVJKXZ', prosigns: ['AR', 'BT', 'BK', 'SK'], numbers: '0123456789' }
	};

	// Web Audio API setup
	let audioContext = null;
	let isPlaying = false;

	function initAudioContext() {
		if (!audioContext) {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
		}
		return audioContext;
	}

	// Calculate timing based on WPM
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

	// Play a tone using Web Audio API
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

	// Update WPM display
	const wpmSlider = document.getElementById('practice-wpm');
	if (wpmSlider) {
		const wpmOutput = document.querySelector('output[for="practice-wpm"]');
		wpmSlider.addEventListener('input', (e) => {
			currentSpeed = e.target.value;
			wpmOutput.textContent = e.target.value;
			document.getElementById('stat-speed').textContent = `${e.target.value} WPM`;
		});
		wpmOutput.textContent = wpmSlider.value;
	}

	// Update volume display
	const volumeSlider = document.getElementById('masterGain');
	if (volumeSlider) {
		const volumeOutput = document.querySelector('output[for="masterGain"]');
		volumeSlider.addEventListener('input', (e) => {
			volumeOutput.textContent = e.target.value;
		});
		volumeOutput.textContent = volumeSlider.value;
	}

	// Update tone frequency display
	const toneSlider = document.getElementById('tone-freq');
	if (toneSlider) {
		const toneOutput = document.querySelector('output[for="tone-freq"]');
		toneSlider.addEventListener('input', (e) => {
			toneOutput.textContent = e.target.value;
		});
		toneOutput.textContent = toneSlider.value;
	}

	// Update character count display
	const charCountSlider = document.getElementById('char-count');
	if (charCountSlider) {
		const charCountOutput = document.querySelector('output[for="char-count"]');
		charCountSlider.addEventListener('input', (e) => {
			charCountOutput.textContent = e.target.value;
		});
		charCountOutput.textContent = charCountSlider.value;
	}

	// Custom character selection
	const practiceMode = document.getElementById('practice-mode');
	const customSelection = document.getElementById('custom-selection');
	const letterSelector = document.getElementById('letter-selector');
	const numberSelector = document.getElementById('number-selector');

	// Generate letter buttons
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	for (let letter of letters) {
		const btn = document.createElement('button');
		btn.className = 'button is-small';
		btn.textContent = letter;
		btn.dataset.char = letter;
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			toggleCharacter(letter, btn);
		});
		letterSelector.appendChild(btn);
	}

	// Generate number buttons
	const numbers = '0123456789';
	for (let number of numbers) {
		const btn = document.createElement('button');
		btn.className = 'button is-small';
		btn.textContent = number;
		btn.dataset.char = number;
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			toggleCharacter(number, btn);
		});
		numberSelector.appendChild(btn);
	}

	function toggleCharacter(char, button) {
		if (customCharacters.has(char)) {
			customCharacters.delete(char);
			button.classList.remove('is-primary');
		} else {
			customCharacters.add(char);
			button.classList.add('is-primary');
		}
		console.log('Custom characters:', Array.from(customCharacters).join(''));
	}

	// Show/hide custom selection and character count based on mode
	const charCountContainer = document.getElementById('char-count-container');
	const cwaSessionContainer = document.getElementById('cwa-session-container');
	if (practiceMode) {
		practiceMode.addEventListener('change', (e) => {
			const mode = e.target.value;

			// Show custom selection for custom mode
			if (mode === 'custom') {
				customSelection.style.display = 'block';
			} else {
				customSelection.style.display = 'none';
			}

			// Show CW Academy session selector for cwacademy mode
			if (mode === 'cwacademy') {
				cwaSessionContainer.style.display = 'block';
			} else {
				cwaSessionContainer.style.display = 'none';
			}

			// Show character count for letters, numbers, mixed, custom, and cwacademy
			// Hide for words, callsigns, and qcodes
			if (['letters', 'numbers', 'mixed', 'custom', 'cwacademy'].includes(mode)) {
				charCountContainer.style.display = 'block';
			} else {
				charCountContainer.style.display = 'none';
			}
		});
	}

	// Start practice button
	if (startBtn) {
		console.log('Start button found, attaching event listener');
		startBtn.addEventListener('click', () => {
			console.log('Start button clicked!');
			try {
				startPractice();
			} catch (error) {
				console.error('Error starting practice:', error);
			}
		});
	} else {
		console.error('Start button not found!');
	}

	// Repeat button
	if (repeatBtn) {
		repeatBtn.addEventListener('click', () => {
			playCurrentMorse();
		});
	}

	// Check answer button
	if (checkBtn) {
		checkBtn.addEventListener('click', () => {
			checkAnswer();
		});
	}

	// Show answer button
	if (showAnswerBtn) {
		showAnswerBtn.addEventListener('click', () => {
			showAnswerAndContinue();
		});
	}

	// Continue button
	if (continueBtn) {
		continueBtn.addEventListener('click', () => {
			continueToNext();
		});
	}

	// Stop button
	if (stopBtn) {
		stopBtn.addEventListener('click', () => {
			stopPractice();
		});
	}

	// Auto-capitalize answer input
	if (answerInput) {
		answerInput.addEventListener('input', (e) => {
			const start = e.target.selectionStart;
			const end = e.target.selectionEnd;
			e.target.value = e.target.value.toUpperCase();
			e.target.setSelectionRange(start, end);

			// Re-enable check button if user starts typing after getting it wrong
			if (isPracticing && checkBtn.disabled && e.target.value.length > 0) {
				checkBtn.disabled = false;
				showAnswerBtn.disabled = true;
				showAnswerBtn.style.display = 'none';
			}
		});
	}

	// Enter key to check answer
	if (answerInput) {
		answerInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter' && !checkBtn.disabled) {
				checkAnswer();
			}
		});
	}

	function startPractice() {
		console.log('Starting practice...');
		isPracticing = true;
		startBtn.disabled = true;
		stopBtn.disabled = false;
		repeatBtn.disabled = false;
		checkBtn.disabled = false;
		showAnswerBtn.disabled = true;
		showAnswerBtn.style.display = 'none';
		continueBtn.disabled = true;
		continueBtn.style.display = 'none';
		answerInput.disabled = false;
		answerInput.value = '';
		answerInput.focus();
		resultArea.style.display = 'none';

		console.log('Generating new problem...');
		generateNewProblem();
	}

	function stopPractice() {
		isPracticing = false;
		startBtn.disabled = false;
		stopBtn.disabled = true;
		repeatBtn.disabled = true;
		checkBtn.disabled = true;
		answerInput.disabled = true;
		morseVisual.innerHTML = '<span class="has-text-grey-light">Press Start to begin...</span>';
	}

	function generateNewProblem() {
		console.log('generateNewProblem called');
		const mode = document.getElementById('practice-mode').value;
		let characters = '';

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
			case 'custom':
				// Use custom selected characters
				if (customCharacters.size === 0) {
					alert('Please select at least one character to practice!');
					stopPractice();
					return;
				}
				characters = Array.from(customCharacters).join('');
				break;
			case 'words':
				// Generate a random word from the common words list
				currentAnswer = commonWords[Math.floor(Math.random() * commonWords.length)];
				console.log('Generated word:', currentAnswer);
				displayMorse(currentAnswer);
				playCurrentMorse();
				return;
			case 'callsigns':
				// Generate a random callsign pattern (e.g., W1ABC)
				currentAnswer = generateCallsign();
				console.log('Generated callsign:', currentAnswer);
				displayMorse(currentAnswer);
				playCurrentMorse();
				return;
			case 'qcodes':
				// Generate Q code
				currentAnswer = generateQCode();
				console.log('Generated Q code:', currentAnswer);
				displayMorse(currentAnswer);
				playCurrentMorse();
				return;
			case 'cwacademy':
				// Generate characters from CW Academy session
				const sessionNum = parseInt(document.getElementById('cwa-session').value);
				const session = cwAcademySessions[sessionNum];
				const charCountSliderElement = document.getElementById('char-count');
				const charCount = charCountSliderElement ? parseInt(charCountSliderElement.value) : 1;

				// Combine all available characters (letters and numbers)
				const allChars = session.chars + session.numbers;

				// Check if we have both characters and prosigns available
				const hasProsigns = session.prosigns && session.prosigns.length > 0;
				const hasChars = allChars.length > 0;

				if (!hasChars && !hasProsigns) {
					alert('No characters or prosigns available for this session!');
					stopPractice();
					return;
				}

				// Decide whether to pick a prosign or regular characters
				// If prosigns are available, 20% chance of picking a prosign
				const pickProsign = hasProsigns && Math.random() < 0.2;

				if (pickProsign) {
					// Pick exactly ONE prosign
					currentAnswer = session.prosigns[Math.floor(Math.random() * session.prosigns.length)];
					console.log('Generated CW Academy prosign:', currentAnswer, 'from session', sessionNum);
				} else {
					// Pick N random characters based on character count slider
					if (!hasChars) {
						// Fallback to prosign if no chars available
						currentAnswer = session.prosigns[Math.floor(Math.random() * session.prosigns.length)];
						console.log('Generated CW Academy prosign (fallback):', currentAnswer, 'from session', sessionNum);
					} else {
						currentAnswer = '';
						for (let i = 0; i < charCount; i++) {
							currentAnswer += allChars.charAt(Math.floor(Math.random() * allChars.length));
						}
						console.log('Generated CW Academy characters:', currentAnswer, 'from session', sessionNum);
					}
				}

				displayMorse(currentAnswer);
				playCurrentMorse();
				return;
			default:
				characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		}

		// Generate random string using character count from slider
		const charCountSlider = document.getElementById('char-count');
		const length = charCountSlider ? parseInt(charCountSlider.value) : 1;
		currentAnswer = '';
		for (let i = 0; i < length; i++) {
			currentAnswer += characters.charAt(Math.floor(Math.random() * characters.length));
		}

		console.log('Generated answer:', currentAnswer);
		displayMorse(currentAnswer);
		playCurrentMorse();
	}

	function generateQCode() {
		// Common Q codes used in amateur radio CW
		const qCodes = [
			'QRL',  // frequency in use
			'QRM',  // interference
			'QRN',  // static/noise
			'QRO',  // increase power
			'QRP',  // reduce power/low power
			'QRQ',  // send faster
			'QRS',  // send slower
			'QRT',  // stop sending
			'QRU',  // nothing for you
			'QRV',  // ready to receive
			'QRX',  // stand by
			'QRZ',  // who is calling me
			'QSB',  // fading
			'QSL',  // acknowledge/confirm
			'QSO',  // contact
			'QSP',  // relay
			'QSY',  // change frequency
			'QTH',  // location
			'QTC',  // message for you
			'QTR'   // time
		];

		return qCodes[Math.floor(Math.random() * qCodes.length)];
	}

	function generateCallsign() {
		// US Callsign format: [Prefix][0-9][Suffix]
		// Prefix: 1-2 letters (A, K, N, W for single letter, or AA-AL, KA-KZ, NA-NZ, WA-WZ for two letters)
		// District: 0-9
		// Suffix: 1-3 letters

		// Single letter prefixes (most common)
		const singlePrefixes = ['W', 'K', 'N', 'A'];

		// Two letter prefixes
		const twoLetterPrefixes = [];
		// AA-AL series
		for (let i = 0; i < 12; i++) {
			twoLetterPrefixes.push('A' + String.fromCharCode(65 + i));
		}
		// KA-KZ series
		for (let i = 0; i < 26; i++) {
			twoLetterPrefixes.push('K' + String.fromCharCode(65 + i));
		}
		// NA-NZ series
		for (let i = 0; i < 26; i++) {
			twoLetterPrefixes.push('N' + String.fromCharCode(65 + i));
		}
		// WA-WZ series
		for (let i = 0; i < 26; i++) {
			twoLetterPrefixes.push('W' + String.fromCharCode(65 + i));
		}

		// Choose prefix (70% single letter, 30% two letter for realistic distribution)
		const useSingleLetter = Math.random() < 0.7;
		const prefix = useSingleLetter
			? singlePrefixes[Math.floor(Math.random() * singlePrefixes.length)]
			: twoLetterPrefixes[Math.floor(Math.random() * twoLetterPrefixes.length)];

		// District number (0-9)
		const number = Math.floor(Math.random() * 10);

		// Suffix length (1-3 letters)
		// Extra class typically 1-2 letters, General/Tech 2-3 letters
		// Weight toward 2-3 letter suffixes as they're more common
		const rand = Math.random();
		let suffixLength;
		if (rand < 0.2) suffixLength = 1;      // 20% - Extra class (1x1, 2x1)
		else if (rand < 0.6) suffixLength = 2; // 40% - General/Extra (1x2, 2x2)
		else suffixLength = 3;                 // 40% - General/Tech (1x3, 2x3)

		let suffix = '';
		for (let i = 0; i < suffixLength; i++) {
			suffix += String.fromCharCode(65 + Math.floor(Math.random() * 26));
		}

		return prefix + number + suffix;
	}

	function displayMorse(text, show = false) {
		// Never show morse code visually - it creates bad practice habits
		morseVisual.innerHTML = '<span class="has-text-grey-light">Listen carefully...</span>';
	}

	function textToMorse(text) {
		// Check if the entire text is a prosign
		if (morseCode[text]) {
			return morseCode[text];
		}
		// Otherwise, split into individual characters
		return text.split('').map(char => morseCode[char] || '').join(' ');
	}

	// Play Morse code sequence
	async function playMorseSequence(text, wpm) {
		console.log('playMorseSequence called with:', text, 'at', wpm, 'WPM');
		if (isPlaying) {
			console.log('Already playing, skipping...');
			return;
		}
		isPlaying = true;

		const ctx = initAudioContext();
		console.log('Audio context initialized:', ctx.state);
		const timing = getTimingFromWPM(wpm);
		console.log('Timing:', timing);
		let currentTime = ctx.currentTime;

		const recvLamp = document.querySelector('.recv-lamp');
		if (recvLamp) recvLamp.classList.add('active');

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
			if (recvLamp) recvLamp.classList.remove('active');
		}, totalDuration);

		return totalDuration;
	}

	function playCurrentMorse() {
		if (!currentAnswer) return;
		const wpm = parseInt(document.getElementById('practice-wpm').value) || 12;
		playMorseSequence(currentAnswer, wpm);
	}

	function checkAnswer() {
		const userAnswer = answerInput.value.toUpperCase().trim();
		stats.attempts++;

		const notification = resultArea.querySelector('.notification');

		if (userAnswer === currentAnswer) {
			stats.correct++;
			resultText.textContent = 'Correct!';
			correctAnswer.textContent = `Answer: ${currentAnswer}`;
			if (notification) {
				notification.classList.remove('is-danger');
				notification.classList.add('is-success');
			}

			stats.accuracy = Math.round((stats.correct / stats.attempts) * 100);

			// Update stats display
			document.getElementById('stat-attempts').textContent = stats.attempts;
			document.getElementById('stat-correct').textContent = stats.correct;
			document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';

			resultArea.style.display = 'block';

			// Generate new problem after a delay
			setTimeout(() => {
				if (isPracticing) {
					answerInput.value = '';
					resultArea.style.display = 'none';
					generateNewProblem();
				}
			}, 2000);
		} else {
			// Wrong answer - show visual feedback, then replay after 1 second
			stats.accuracy = Math.round((stats.correct / stats.attempts) * 100);

			// Update stats display
			document.getElementById('stat-attempts').textContent = stats.attempts;
			document.getElementById('stat-correct').textContent = stats.correct;
			document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';

			// Show brief "Try again" message
			resultText.textContent = 'Try again...';
			correctAnswer.textContent = '';
			if (notification) {
				notification.classList.remove('is-success', 'is-info');
				notification.classList.add('is-warning');
			}
			resultArea.style.display = 'block';

			// Disable check button and show the show answer button
			checkBtn.disabled = true;
			showAnswerBtn.disabled = false;
			showAnswerBtn.style.display = 'inline-flex';

			// Clear the input
			answerInput.value = '';

			// Hide the "Try again" message and replay after 1 second
			setTimeout(() => {
				if (isPracticing) {
					resultArea.style.display = 'none';
					playCurrentMorse();
				}
			}, 1000);
		}
	}

	function showAnswerAndContinue() {
		// Show the correct answer
		const notification = resultArea.querySelector('.notification');
		resultText.textContent = 'The answer was:';
		correctAnswer.textContent = currentAnswer;
		if (notification) {
			notification.classList.remove('is-success', 'is-warning');
			notification.classList.add('is-info');
		}
		resultArea.style.display = 'block';

		// Hide show answer button, show continue button
		showAnswerBtn.disabled = true;
		showAnswerBtn.style.display = 'none';
		continueBtn.disabled = false;
		continueBtn.style.display = 'inline-flex';
	}

	function continueToNext() {
		// Hide continue button and result area
		continueBtn.disabled = true;
		continueBtn.style.display = 'none';
		resultArea.style.display = 'none';

		// Re-enable check button
		checkBtn.disabled = false;

		// Clear input and generate new problem
		answerInput.value = '';
		answerInput.focus();

		if (isPracticing) {
			generateNewProblem();
		}
	}

	// Key buttons for sending practice
	const keyButtons = document.querySelectorAll('.key');
	keyButtons.forEach(button => {
		button.addEventListener('mousedown', () => {
			button.style.opacity = '0.7';
			// TODO: Implement key down audio/visual
		});

		button.addEventListener('mouseup', () => {
			button.style.opacity = '1';
			// TODO: Implement key up audio/visual
		});

		button.addEventListener('mouseleave', () => {
			button.style.opacity = '1';
		});
	});

	// Keyboard shortcuts for keys
	document.addEventListener('keydown', (e) => {
		if (e.key === '.' || e.key === 'x') {
			const key0 = document.querySelector('.key[data-key="0"]');
			if (key0) key0.style.opacity = '0.7';
		}
		if (e.key === '/' || e.key === 'z') {
			const key1 = document.querySelector('.key[data-key="1"]');
			if (key1) key1.style.opacity = '0.7';
		}
	});

	document.addEventListener('keyup', (e) => {
		if (e.key === '.' || e.key === 'x') {
			const key0 = document.querySelector('.key[data-key="0"]');
			if (key0) key0.style.opacity = '1';
		}
		if (e.key === '/' || e.key === 'z') {
			const key1 = document.querySelector('.key[data-key="1"]');
			if (key1) key1.style.opacity = '1';
		}
	});

	// ========================================
	// Send Practice Module
	// ========================================

	let sendPracticing = false;
	let targetChar = '';
	let sentChars = '';
	let morseKeyer = null;
	let morseDecoder = null;
	let morseSounder = null;

	const startSendBtn = document.getElementById('start-send-btn');
	const stopSendBtn = document.getElementById('stop-send-btn');
	const nextCharBtn = document.getElementById('next-char-btn');
	const targetCharDisplay = document.getElementById('target-character');
	const sentOutput = document.getElementById('sent-output');
	const sendModeSelect = document.getElementById('send-mode');
	const keyerModeSelect = document.getElementById('keyer-mode');

	// Initialize morse input system
	function initMorseInput() {
		if (!morseDecoder) {
			// Initialize decoder with callback
			morseDecoder = new MorseDecoder((letter) => {
				handleDecodedCharacter(letter);
			});

			// Initialize sounder
			morseSounder = new MorseSounder();

			// Initialize keyer
			morseKeyer = new MorseKeyer(morseSounder, morseDecoder);

			// Set initial settings
			const toneSlider = document.getElementById('tone-freq');
			const tone = toneSlider ? parseFloat(toneSlider.value) : 600;
			morseKeyer.setTone(tone);
			morseKeyer.setWpm(20);

			// Set keyer mode
			const mode = keyerModeSelect ? keyerModeSelect.value : '2';
			morseKeyer.setMode(mode);

			console.log('Morse input system initialized');
		}
	}

	// Handle decoded characters from morse input
	function handleDecodedCharacter(char) {
		if (!sendPracticing) return;

		console.log('Decoded character:', char);
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

		// Check if character matches target
		if (char.toUpperCase() === targetChar.toUpperCase()) {
			// Correct! Generate new target after a brief delay
			setTimeout(() => {
				generateNewTarget();
			}, 500);
		}
	}

	// Generate new target character
	function generateNewTarget() {
		if (!sendPracticing) return;

		const mode = sendModeSelect ? sendModeSelect.value : 'letters';
		let characters = '';

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
				// For words mode, pick a random word
				targetChar = commonWords[Math.floor(Math.random() * commonWords.length)];
				if (targetCharDisplay) {
					targetCharDisplay.innerHTML = targetChar;
				}
				return;
		}

		// Pick random character
		targetChar = characters.charAt(Math.floor(Math.random() * characters.length));
		if (targetCharDisplay) {
			targetCharDisplay.innerHTML = targetChar;
		}
	}

	// Start send practice
	function startSendPractice() {
		console.log('Starting send practice...');
		sendPracticing = true;
		sentChars = '';

		// Initialize morse input if needed
		initMorseInput();

		// Update UI
		if (startSendBtn) startSendBtn.disabled = true;
		if (stopSendBtn) stopSendBtn.disabled = false;
		if (nextCharBtn) nextCharBtn.disabled = false;
		if (sentOutput) sentOutput.value = '';

		// Generate first target
		generateNewTarget();
	}

	// Stop send practice
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

	// Event listeners for send practice
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

	// Update keyer mode when changed
	if (keyerModeSelect) {
		keyerModeSelect.addEventListener('change', (e) => {
			if (morseKeyer) {
				morseKeyer.setMode(e.target.value);
				console.log('Keyer mode changed to:', e.target.value);
			}
		});
	}

	// Global keyboard event handlers for morse input
	window.addEventListener('keydown', (e) => {
		if (!sendPracticing || !morseKeyer) return;

		// Prevent default for our control keys
		if (['ControlLeft', 'ControlRight', 'BracketLeft', 'BracketRight'].includes(e.code)) {
			e.preventDefault();
		}

		morseKeyer.press(e, true);
	});

	window.addEventListener('keyup', (e) => {
		if (!sendPracticing || !morseKeyer) return;

		// Prevent default for our control keys
		if (['ControlLeft', 'ControlRight', 'BracketLeft', 'BracketRight'].includes(e.code)) {
			e.preventDefault();
		}

		morseKeyer.press(e, false);
	});
});
