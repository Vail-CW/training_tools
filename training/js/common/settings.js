// Vail Training Tools - Shared Settings
// Volume, tone frequency, localStorage persistence, navbar

document.addEventListener('DOMContentLoaded', () => {
	// Volume slider
	const volumeSlider = document.getElementById('masterGain');
	if (volumeSlider) {
		const volumeOutput = document.querySelector('output[for="masterGain"]');

		// Load saved volume from localStorage
		const savedVolume = localStorage.getItem('vailTrainingVolume');
		if (savedVolume !== null) {
			volumeSlider.value = savedVolume;
			if (volumeOutput) volumeOutput.textContent = savedVolume;
			console.log('Loaded volume from localStorage:', savedVolume);
		} else if (volumeOutput) {
			volumeOutput.textContent = volumeSlider.value;
		}

		volumeSlider.addEventListener('input', (e) => {
			const volume = e.target.value;
			if (volumeOutput) volumeOutput.textContent = volume;
			localStorage.setItem('vailTrainingVolume', volume);
		});
	}

	// Tone frequency slider
	const toneSlider = document.getElementById('tone-freq');
	if (toneSlider) {
		const toneOutput = document.querySelector('output[for="tone-freq"]');

		// Load saved tone from localStorage
		const savedTone = localStorage.getItem('vailTrainingTone');
		if (savedTone !== null) {
			toneSlider.value = savedTone;
			if (toneOutput) toneOutput.textContent = savedTone;
			console.log('Loaded tone from localStorage:', savedTone);
		} else if (toneOutput) {
			toneOutput.textContent = toneSlider.value;
		}

		toneSlider.addEventListener('input', (e) => {
			const tone = e.target.value;
			if (toneOutput) toneOutput.textContent = tone;
			localStorage.setItem('vailTrainingTone', tone);
		});
	}

	// Settings dropdown toggle
	const settingsToggle = document.getElementById('settings-toggle');
	const settingsDropdown = document.getElementById('settings-dropdown');

	if (settingsToggle && settingsDropdown) {
		settingsToggle.addEventListener('click', (e) => {
			e.preventDefault();
			settingsDropdown.classList.toggle('is-active');
		});

		// Close dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!settingsDropdown.contains(e.target)) {
				settingsDropdown.classList.remove('is-active');
			}
		});
	}

	// Reset button
	const resetBtn = document.getElementById('reset');
	if (resetBtn) {
		resetBtn.addEventListener('click', () => {
			// Clear all Vail Training localStorage items
			localStorage.removeItem('vailTrainingVolume');
			localStorage.removeItem('vailTrainingTone');
			localStorage.removeItem('vailTrainingSendWpm');
			localStorage.removeItem('vailTrainingFreeWpm');
			localStorage.removeItem('vailTrainingKeyerMode');
			localStorage.removeItem('vailTrainingFreeKeyerMode');

			// Reload page to apply defaults
			location.reload();
		});
	}

	// Navbar burger toggle for mobile
	const burger = document.getElementById('navbar-burger');
	const menu = document.getElementById('navbar-menu');
	if (burger && menu) {
		burger.addEventListener('click', () => {
			burger.classList.toggle('is-active');
			menu.classList.toggle('is-active');
		});
	}
});
