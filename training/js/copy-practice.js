// Vail Training Tools - Copy Practice Module
// Morse code receiving/copying practice

document.addEventListener('DOMContentLoaded', () => {
	console.log('Copy Practice module loaded');

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

	// Update WPM display
	const wpmSlider = document.getElementById('practice-wpm');
	if (wpmSlider) {
		const wpmOutput = document.querySelector('output[for="practice-wpm"]');
		wpmSlider.addEventListener('input', (e) => {
			const wpm = parseInt(e.target.value);
			currentSpeed = wpm;
			wpmOutput.textContent = wpm;
			document.getElementById('stat-speed').textContent = `${wpm} WPM`;
		});
		wpmOutput.textContent = wpmSlider.value;
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
	if (letterSelector) {
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
	}

	// Generate number buttons
	const numbers = '0123456789';
	if (numberSelector) {
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
		startBtn.addEventListener('click', () => {
			console.log('Start button clicked!');
			startPractice();
		});
	}

	// Repeat button
	if (repeatBtn) {
		repeatBtn.addEventListener('click', () => {
			playCurrentMorse();
			answerInput.focus();
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

		// Spacebar to repeat morse when input is empty
		answerInput.addEventListener('keydown', (e) => {
			if (e.code === 'Space' && answerInput.value === '' && !repeatBtn.disabled) {
				e.preventDefault();
				playCurrentMorse();
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
				// Generate a random callsign
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
		const charCountSliderVal = document.getElementById('char-count');
		const length = charCountSliderVal ? parseInt(charCountSliderVal.value) : 1;
		currentAnswer = '';
		for (let i = 0; i < length; i++) {
			currentAnswer += characters.charAt(Math.floor(Math.random() * characters.length));
		}

		console.log('Generated answer:', currentAnswer);
		displayMorse(currentAnswer);
		playCurrentMorse();
	}

	function displayMorse(text, show = false) {
		// Never show morse code visually - it creates bad practice habits
		morseVisual.innerHTML = '<span class="has-text-grey-light">Listen carefully...</span>';
	}

	function playCurrentMorse() {
		if (!currentAnswer) return;
		const wpm = parseInt(document.getElementById('practice-wpm').value) || 12;
		playMorseSequence(currentAnswer, wpm, '.recv-lamp');
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
});
