import './styles/main.css';
import { ProgressChart } from './components/progress-chart';
import { SettingsPanel } from './components/settings-panel';
import { MicTest } from './components/mic-test';
import { ModeSelector } from './components/mode-selector';
import { PracticeSession } from './services/practice-session';
import { isAndroid, isMobile, isSpeechRecognitionSupported } from './core/speech-recognition';
import { checkMicrophonePermission, requestMicrophonePermission, getDeniedInstructions } from './services/permission-check';

// Check if Android and show unsupported banner
function checkAndroidAndShowBanner(): boolean {
  if (isAndroid()) {
    console.log('Android detected - showing unsupported banner');
    const androidBanner = document.getElementById('android-banner');
    const micTestArea = document.getElementById('mic-test-area');
    const practiceArea = document.getElementById('practice-area');
    const chartSection = document.getElementById('chart-section');

    // Show the Android banner
    if (androidBanner) {
      androidBanner.classList.remove('hidden');
    }

    // Hide the practice functionality
    if (micTestArea) {
      micTestArea.classList.add('hidden');
    }
    if (practiceArea) {
      practiceArea.classList.add('hidden');
    }
    if (chartSection) {
      chartSection.classList.add('hidden');
    }

    return true; // Android detected, don't proceed with app initialization
  }
  return false;
}

// Initialize the main app components
function initializeApp() {
  console.log('Morse ICR Trainer initializing...');

  // Check for Android first - if detected, show banner and don't initialize
  if (checkAndroidAndShowBanner()) {
    console.log('Android device - app disabled');
    return;
  }

  // Log platform detection
  if (isMobile()) {
    console.log('Mobile detected - using continuous speech recognition mode');
    // Hide mic test section on mobile (not needed with continuous mode)
    const micTestArea = document.getElementById('mic-test-area');
    if (micTestArea) {
      micTestArea.style.display = 'none';
    }
  }

  if (!isSpeechRecognitionSupported()) {
    console.warn('Speech recognition not supported in this browser');
  }

  // Initialize components (they handle their own iOS/browser detection)
  // Skip MicTest on mobile since it's hidden
  if (!isMobile()) {
    new MicTest();
  }

  // Initialize progress chart
  const progressChart = new ProgressChart('progress-chart');

  // Initialize mode selector and practice session
  const modeSelector = new ModeSelector();
  const practiceSession = new PracticeSession();

  // Wire up chart toggle buttons
  const charChartBtn = document.getElementById('char-chart-btn') as HTMLButtonElement;
  const wordChartBtn = document.getElementById('word-chart-btn') as HTMLButtonElement;
  const callsignChartBtn = document.getElementById('callsign-chart-btn') as HTMLButtonElement;

  const setChartMode = (mode: 'character' | 'word' | 'callsign') => {
    charChartBtn?.classList.remove('active');
    wordChartBtn?.classList.remove('active');
    callsignChartBtn?.classList.remove('active');

    if (mode === 'word') {
      wordChartBtn?.classList.add('active');
      progressChart.setDataSource('word');
    } else if (mode === 'callsign') {
      callsignChartBtn?.classList.add('active');
      progressChart.setDataSource('callsign');
    } else {
      charChartBtn?.classList.add('active');
      progressChart.setDataSource('individual');
    }
  };

  charChartBtn?.addEventListener('click', () => setChartMode('character'));
  wordChartBtn?.addEventListener('click', () => setChartMode('word'));
  callsignChartBtn?.addEventListener('click', () => setChartMode('callsign'));

  // Wire up mode changes to stop session and sync chart
  modeSelector.setOnModeChange(() => {
    practiceSession.stop();
  });

  modeSelector.setOnChartToggle((mode) => {
    // Sync chart with practice mode
    setChartMode(mode);
  });

  new SettingsPanel();

  console.log('Morse ICR Trainer ready!');
}

// Check microphone permission and show gate if needed
async function initWithPermissionCheck() {
  // Check for Android first - if detected, show banner and don't proceed
  if (checkAndroidAndShowBanner()) {
    console.log('Android device - skipping permission check');
    return;
  }

  const gate = document.getElementById('permission-gate')!;
  const btn = document.getElementById('grant-permission-btn') as HTMLButtonElement;
  const errorEl = document.getElementById('permission-error')!;

  const state = await checkMicrophonePermission();

  if (state === 'granted') {
    // Already have permission - proceed silently (Option B)
    initializeApp();
    return;
  }

  // Show permission gate
  gate.classList.remove('hidden');

  if (state === 'denied') {
    errorEl.innerHTML = `<span class="error">Microphone access was denied.</span><br><small>${getDeniedInstructions()}</small>`;
    errorEl.classList.remove('hidden');
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Requesting...';

    const granted = await requestMicrophonePermission();
    if (granted) {
      gate.classList.add('hidden');
      initializeApp();
    } else {
      btn.disabled = false;
      btn.textContent = 'Enable Microphone';
      errorEl.innerHTML = `<span class="error">Microphone access was denied.</span><br><small>${getDeniedInstructions()}</small>`;
      errorEl.classList.remove('hidden');
    }
  });
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initWithPermissionCheck();
});

// Register service worker for PWA (if available)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service worker registration failed:', err);
    });
  });
}
