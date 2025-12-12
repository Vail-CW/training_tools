// Import Bootstrap CSS (Vail dark theme)
import 'bootswatch/dist/darkly/bootstrap.min.css';

// Import custom styles
import '../css/style.css';

// Import Bootstrap JavaScript
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Import Font Awesome
import '@fortawesome/fontawesome-free/js/all.min.js';

import {
  audioContext,
  createMorsePlayer,
  getAudioLock,
  updateAudioLock,
  isBackgroundStaticPlaying,
  createBackgroundStatic,
  stopAllAudio,
} from './audio.js';
import { clearAllInvalidStates, getInputs } from './inputs.js';
import {
  compareStrings,
  respondWithAllStations,
  addStations,
  addTableRow,
  clearTable,
  updateActiveStations,
  printStation,
} from './util.js';
import { getYourStation, getCallingStation } from './stationGenerator.js';
import { updateStaticIntensity } from './audio.js';
import { modeLogicConfig, modeUIConfig } from './modes.js';
import { morseInput } from './morse-input/morse-input.js'; // Import morse input functionality
import {
  shouldDisplayTxText,
  isSendPracticeMode,
  isSendOnlyMode,
  prepareTxText,
  createHighlightCallback,
  clearHighlights,
  highlightChar,
  markCharCorrect,
  markCharIncorrect,
  getExpectedText,
  getCurrentProgressIndex
} from './txTextDisplay.js';

/**
 * Application state variables.
 *
 * - `currentMode`: Tracks the currently selected mode (e.g., single, multi-station).
 * - `inputs`: Stores the user-provided inputs retrieved from the form.
 * - `currentStations`: An array of stations currently active in multi-station mode.
 * - `currentStation`: The single active station in single mode.
 * - `activeStationIndex`: Tracks the index of the current active station in multi-station mode.
 * - `readyForTU`: Boolean indicating if the "TU" step is ready to proceed.
 * - `currentStationAttempts`: Counter for the number of attempts with the current station.
 * - `currentStationStartTime`: Timestamp for when the current station interaction started.
 * - `totalContacts`: Counter for the total number of completed contacts.
 * - `yourStation`: Stores the user's station configuration.
 * - `lastRespondingStations`: An array of stations that last responded to the user's call.
 * - `farnsworthLowerBy`: The amount to increase the Farnsworth spacing when using QRS.
 */
let currentMode;
let inputs = null;
let currentStations = [];
let currentStation = null;
let activeStationIndex = null;
let readyForTU = false; // This means that the last send was a perfect match
let currentStationAttempts = 0;
let currentStationStartTime = null;
let totalContacts = 0;
let yourStation = null;
let lastRespondingStations = null;
const farnsworthLowerBy = 6;

// Send practice mode state
let sendPracticeActive = false;
let sendPracticeExpectedText = '';
let sendPracticeCurrentIndex = 0;
let sendPracticePendingResponse = null; // Stores the pending response callback

// Send Only mode state
let sendOnlyPhase = 'idle'; // Phases: 'idle', 'cq', 'callsign', 'exchange', 'tu'
let sendOnlyDecodedText = ''; // Accumulated decoded text from user
let sendOnlyExpectedState = ''; // Expected state for TU phase

/**
 * Event listener setup.
 *
 * - Adds click and change event listeners to UI elements like buttons and checkboxes.
 * - Configures interactions for elements such as the CQ button, mode selection radios, and input fields.
 * - Includes special handling for QSB and Farnsworth UI components to dynamically enable/disable related inputs.
 */
document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const cqButton = document.getElementById('cqButton');
  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  const sendButton = document.getElementById('sendButton');
  const tuButton = document.getElementById('tuButton');
  const resetButton = document.getElementById('resetButton');
  const stopButton = document.getElementById('stopButton');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const yourCallsign = document.getElementById('yourCallsign');
  const yourName = document.getElementById('yourName');
  const yourSpeed = document.getElementById('yourSpeed');
  const yourSidetone = document.getElementById('yourSidetone');
  const yourVolume = document.getElementById('yourVolume');
  const keyerMode = document.getElementById('keyerMode');

  // Event Listeners
  cqButton.addEventListener('click', () => {
    // Initialize morse input when user starts using MorseWalker
    morseInput.initialize();

    // Set up 8 dits callback for clearing fields
    morseInput.setOnEightDitsCallback(() => {
      // Check send practice mode FIRST (higher priority than response field)
      if (sendPracticeActive) {
        const cqDecodedText = document.getElementById('cqDecodedText');
        const sendDecodedText = document.getElementById('sendDecodedText');
        const tuDecodedText = document.getElementById('tuDecodedText');

        if (cqDecodedText && cqDecodedText.style.display !== 'none') {
          cqDecodedText.textContent = '';
          return;
        } else if (sendDecodedText && sendDecodedText.style.display !== 'none') {
          sendDecodedText.textContent = '';
          return;
        } else if (tuDecodedText && tuDecodedText.style.display !== 'none') {
          tuDecodedText.textContent = '';
          return;
        }
      }

      // Clear response field if it's active (and not in send practice mode)
      const activeField = document.activeElement;
      if (activeField === responseField) {
        responseField.value = '';
        responseField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Set up Send Only mode handler if in that mode
    if (isSendOnlyMode()) {
      morseInput.setWordSpacing(true); // Enable word spacing for Send Only mode
      morseInput.setCustomDecodedLetterHandler(handleSendOnlyCharacter);
    }

    cq();
  });
  sendButton.addEventListener('click', send);
  tuButton.addEventListener('click', tu);
  resetButton.addEventListener('click', reset);
  stopButton.addEventListener('click', stop);
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', changeMode);
  });

  // QSB
  const qsbCheckbox = document.getElementById('qsb');
  const qsbPercentage = document.getElementById('qsbPercentage');
  // Initially set the slider state based on the checkbox
  qsbPercentage.disabled = !qsbCheckbox.checked;
  // Add event listener to update the slider state when checkbox changes
  qsbCheckbox.addEventListener('change', () => {
    qsbPercentage.disabled = !qsbCheckbox.checked;
  });

  // Farnsworth elements
  const enableFarnsworthCheckbox = document.getElementById('enableFarnsworth');
  const farnsworthSpeedInput = document.getElementById('farnsworthSpeed');
  // Set initial state based on whether Farnsworth is enabled
  farnsworthSpeedInput.disabled = !enableFarnsworthCheckbox.checked;
  // Toggle the Farnsworth speed input when the checkbox changes
  enableFarnsworthCheckbox.addEventListener('change', () => {
    farnsworthSpeedInput.disabled = !enableFarnsworthCheckbox.checked;
    if (enableFarnsworthCheckbox.checked) {
      morseInput.updateSettings({
        farnsworth: parseInt(farnsworthSpeedInput.value),
      });
    }
  });

  farnsworthSpeedInput.addEventListener('input', () => {
    if (enableFarnsworthCheckbox.checked) {
      morseInput.updateSettings({
        farnsworth: parseInt(farnsworthSpeedInput.value),
      });
    }
  });

  // Cut Number elements
  const enableCutNumbersCheckbox = document.getElementById('enableCutNumbers');
  const cutNumberIds = [
    'cutT',
    'cutA',
    'cutU',
    'cutV',
    'cutE',
    'cutG',
    'cutD',
    'cutN',
  ];

  // Set initial state based on whether Cut Numbers is enabled
  cutNumberIds.forEach((id) => {
    const checkbox = document.getElementById(id);
    checkbox.disabled = !enableCutNumbersCheckbox.checked;
  });

  // Toggle the cut-number checkboxes when "Enable Cut Numbers" changes
  enableCutNumbersCheckbox.addEventListener('change', () => {
    cutNumberIds.forEach((id) => {
      const checkbox = document.getElementById(id);
      checkbox.disabled = !enableCutNumbersCheckbox.checked;
    });
  });

  function updateResponsiveButtons() {
    const responsiveButtons = document.querySelectorAll('.btn-responsive');
    responsiveButtons.forEach((button) => {
      if (window.innerWidth < 576) {
        button.classList.add('btn-sm');
      } else {
        button.classList.remove('btn-sm');
      }
    });
  }

  // Run on initial load
  updateResponsiveButtons();
  // Run on every window resize
  window.addEventListener('resize', updateResponsiveButtons);

  // Add hotkey for CQ (Ctrl + Shift + C)
  // Add an event listener for keydown events
  document.addEventListener('keydown', (event) => {
    // Check if Ctrl and Shift are pressed and the key is 'C'
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      // Prevent default behavior to avoid browser conflicts
      event.preventDefault();

      // Call the CQ function
      cq();
    }
  });

  responseField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendButton.click();
    }
  });

  // Auto-send when question mark is typed
  responseField.addEventListener('input', (event) => {
    const value = responseField.value;
    if (value.includes('?')) {
      // Small delay to ensure the '?' is in the field before sending
      setTimeout(() => {
        sendButton.click();
      }, 50);
    }
  });

  infoField.addEventListener('keydown', (event) => {
    const tuButtonContainer = document.getElementById('tuButtonContainer');
    if (event.key === 'Enter' && tuButtonContainer.style.display !== 'none') {
      event.preventDefault();
      tuButton.click();
    }
  });

  infoField2.addEventListener('keydown', (event) => {
    const tuButtonContainer = document.getElementById('tuButtonContainer');
    if (event.key === 'Enter' && tuButtonContainer.style.display !== 'none') {
      event.preventDefault();
      tuButton.click();
    }
  });

  cqButton.addEventListener('click', () => {
    responseField.focus();
  });

  // Note: The old "2s Delay to Send" checkbox has been replaced with the "Auto-Send Delay" slider
  // The auto-send functionality is now handled in Send Only mode via setupAutoSendCallback()

  // Handle "Clear on Send" checkbox - will be checked in send() function

  // Handle difficulty level changes
  const difficultyLevel = document.getElementById('difficultyLevel');

  function updateUIForDifficultyMode() {
    const isSendOnly = isSendOnlyMode();

    // Disable/enable buttons based on Send Only mode
    cqButton.disabled = isSendOnly;
    sendButton.disabled = isSendOnly;
    tuButton.disabled = isSendOnly;

    // Disable/enable response field (but keep state fields editable)
    responseField.disabled = isSendOnly;
    if (isSendOnly) {
      responseField.classList.add('text-muted');

      // Initialize yourStation if not already initialized
      if (!yourStation) {
        yourStation = getYourStation();
        yourStation.player = createMorsePlayer(yourStation);
      }

      // Initialize morse input and set up Send Only handler
      morseInput.initialize();
      morseInput.setWordSpacing(true);
      morseInput.setCustomDecodedLetterHandler(handleSendOnlyCharacter);

      // Reset Send Only state
      sendOnlyPhase = 'idle';
      sendOnlyDecodedText = '';
    } else {
      responseField.classList.remove('text-muted');

      // Clear Send Only handler if switching away from that mode
      morseInput.clearCustomDecodedLetterHandler();
      morseInput.setWordSpacing(false);
    }
  }

  // Update UI when difficulty changes
  if (difficultyLevel) {
    difficultyLevel.addEventListener('change', updateUIForDifficultyMode);

    // Initialize UI state on load
    updateUIForDifficultyMode();
  }

  // Local Storage keys for user settings
  const keys = {
    yourCallsign: 'yourCallsign',
    yourName: 'yourName',
    yourState: 'yourState', // Added yourState
    yourSpeed: 'yourSpeed',
    yourSidetone: 'yourSidetone',
    yourVolume: 'yourVolume',
    keyerMode: 'keyerMode',
  };

  /**
   * Local storage handling for user settings.
   *
   * - Loads saved values from local storage into input fields during initialization.
   * - Saves updated input field values to local storage whenever they change.
   * - Ensures persistence of user preferences across sessions.
   */
  yourCallsign.value =
    localStorage.getItem(keys.yourCallsign) || yourCallsign.value;
  yourName.value = localStorage.getItem(keys.yourName) || yourName.value;
  yourState.value = localStorage.getItem(keys.yourState) || yourState.value; // Load yourState
  yourSpeed.value = localStorage.getItem(keys.yourSpeed) || yourSpeed.value;
  yourSidetone.value =
    localStorage.getItem(keys.yourSidetone) || yourSidetone.value;
  yourVolume.value = localStorage.getItem(keys.yourVolume) || yourVolume.value;
  keyerMode.value = localStorage.getItem(keys.keyerMode) || keyerMode.value;

  // Save user settings to localStorage on input change
  yourCallsign.addEventListener('input', () => {
    localStorage.setItem(keys.yourCallsign, yourCallsign.value);
  });
  yourName.addEventListener('input', () => {
    localStorage.setItem(keys.yourName, yourName.value);
  });
  yourState.addEventListener('input', () => {
    // Save yourState
    localStorage.setItem(keys.yourState, yourState.value);
  });
  yourSpeed.addEventListener('input', () => {
    localStorage.setItem(keys.yourSpeed, yourSpeed.value);
    // Update morse input speed when changed
    morseInput.updateSettings({ wpm: parseInt(yourSpeed.value) });
  });
  yourSidetone.addEventListener('input', () => {
    localStorage.setItem(keys.yourSidetone, yourSidetone.value);
    // Update morse input tone when changed
    morseInput.updateSettings({ tone: parseInt(yourSidetone.value) });
  });
  yourVolume.addEventListener('input', () => {
    localStorage.setItem(keys.yourVolume, yourVolume.value);
  });
  keyerMode.addEventListener('change', () => {
    localStorage.setItem(keys.keyerMode, keyerMode.value);
    // Update morse input keyer mode when changed
    morseInput.updateSettings({ mode: parseInt(keyerMode.value) });
  });

  // Handle QRN intensity changes
  const qrnRadioButtons = document.querySelectorAll('input[name="qrn"]');
  qrnRadioButtons.forEach((radio) => {
    radio.addEventListener('change', updateStaticIntensity);
  });

  // Determine mode from local storage or default to single
  const savedMode = localStorage.getItem('mode') || 'single';
  // Check the corresponding radio button based on savedMode
  const savedModeRadio = document.querySelector(
    `input[name="mode"][value="${savedMode}"]`
  );
  if (savedModeRadio) {
    savedModeRadio.checked = true;
  }

  // Set currentMode to the saved or default mode
  currentMode = savedMode;

  // Update basic stats on page load
  if (yourCallsign.value !== '') {
    fetch(`https://stats.${window.location.hostname}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode, callsign: yourCallsign.value }),
    }).catch((error) => {
      console.error('Failed to send CloudFlare stats.');
    });
  }

  // Reset state to ensure no leftover stations when loading
  resetGameState();

  // Apply mode settings now that currentMode matches the dropdown and local storage
  applyModeSettings(currentMode);
});

/**
 * Retrieves the logic configuration for the current mode.
 *
 * Returns the object containing mode-specific logic and rules, such as
 * message templates and exchange formats, based on the selected mode.
 *
 * @returns {Object} The configuration object for the current mode.
 */
function getModeConfig() {
  return modeLogicConfig[currentMode];
}

/**
 * Updates the UI to reflect the current mode's configuration.
 *
 * Adjusts visibility, placeholders, and content of various UI elements like the
 * "TU" button, input fields, and results table. Also modifies extra columns in the
 * results table based on mode-specific requirements.
 *
 * @param {string} mode - The mode to apply settings for.
 */
function applyModeSettings(mode) {
  const config = modeUIConfig[mode];
  const tuButtonContainer = document.getElementById('tuButtonContainer');
  const infoFieldContainer = document.getElementById('infoFieldContainer');
  const infoField = document.getElementById('infoField');
  const infoField2Container = document.getElementById('infoField2Container');
  const infoField2 = document.getElementById('infoField2');
  const resultsTable = document.getElementById('resultsTable');
  const modeResultsHeader = document.getElementById('modeResultsHeader');

  // TU button visibility
  tuButtonContainer.style.display = config.showTuButton ? 'block' : 'none';

  // Info field visibility & placeholder
  if (config.showInfoField) {
    infoFieldContainer.style.display = 'block';
    infoField.placeholder = config.infoFieldPlaceholder;
  } else {
    infoFieldContainer.style.display = 'none';
    infoField.value = '';
  }

  // Info field 2 visibility & placeholder
  if (config.showInfoField2) {
    infoField2Container.style.display = 'block';
    infoField2.placeholder = config.infoField2Placeholder;
  } else {
    infoField2Container.style.display = 'none';
    infoField2.value = '';
  }

  // Update results header text
  modeResultsHeader.textContent = config.resultsHeader;

  // Show/hide the extra column in the results table
  const extraColumns = resultsTable.querySelectorAll('.mode-specific-column');
  extraColumns.forEach((col) => {
    col.style.display = config.tableExtraColumn ? 'table-cell' : 'none';
  });

  // Update extra column header text
  const extraColumnHeaders = resultsTable.querySelectorAll(
    'thead .mode-specific-column'
  );
  extraColumnHeaders.forEach((header) => {
    header.textContent = config.extraColumnHeader || 'Additional Info';
  });
}

/**
 * Resets the game state and clears all UI elements.
 *
 * Resets variables related to stations, attempts, and contacts. Clears the results
 * table, disables the CQ button, stops all audio, and reinitializes the response field.
 */
function resetGameState() {
  currentStations = [];
  currentStation = null;
  activeStationIndex = null;
  readyForTU = false;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  totalContacts = 0;

  updateActiveStations(0);
  clearTable('resultsTable');
  document.getElementById('responseField').value = '';
  document.getElementById('infoField').value = '';
  document.getElementById('infoField2').value = '';
  document.getElementById('cqButton').disabled = false;
  stopAllAudio();
  updateAudioLock(0);
}

/**
 * Handles changes to the operating mode.
 *
 * Updates the `currentMode` variable, saves the new mode to local storage,
 * resets the game state, clears invalid states, and applies the new mode's settings.
 */
function changeMode() {
  const selectedMode = document.querySelector(
    'input[name="mode"]:checked'
  ).value;
  currentMode = selectedMode;
  localStorage.setItem('mode', currentMode);
  resetGameState();
  clearAllInvalidStates();
  applyModeSettings(currentMode);
}

/**
 * Handles characters decoded in send practice mode
 * @param {string} letter - The decoded letter
 * @returns {boolean} True if handled
 */
function handleSendPracticeCharacter(letter) {
  if (!sendPracticeActive) return false;

  const letterUpper = letter.toUpperCase();

  // Determine which decoded text element to use (CQ, Send, or TU)
  const cqDecodedText = document.getElementById('cqDecodedText');
  const sendDecodedText = document.getElementById('sendDecodedText');
  const tuDecodedText = document.getElementById('tuDecodedText');
  const cqTxText = document.getElementById('cqTxText');
  const sendTxText = document.getElementById('sendTxText');
  const tuTxText = document.getElementById('tuTxText');

  let decodedTextEl, txTextEl;

  // Check which mode we're in based on which decoded text is visible
  if (cqDecodedText && cqDecodedText.style.display !== 'none') {
    decodedTextEl = cqDecodedText;
    txTextEl = cqTxText;
  } else if (sendDecodedText && sendDecodedText.style.display !== 'none') {
    decodedTextEl = sendDecodedText;
    txTextEl = sendTxText;
  } else if (tuDecodedText && tuDecodedText.style.display !== 'none') {
    decodedTextEl = tuDecodedText;
    txTextEl = tuTxText;
  } else {
    return false; // No active decoded text display
  }

  // Append the decoded letter to the decoded text display
  decodedTextEl.textContent += letterUpper;

  // Check if we've completed the expected text
  const expectedText = Array.from(txTextEl.querySelectorAll('.char')).map(el => el.textContent).join('');

  if (decodedTextEl.textContent.length >= expectedText.length) {
    // Message complete
    sendPracticeActive = false;
    morseInput.clearCustomDecodedLetterHandler();
    morseInput.setWordSpacing(false); // Disable word spacing

    // Trigger the pending station response
    if (sendPracticePendingResponse) {
      sendPracticePendingResponse();
      sendPracticePendingResponse = null;
    }
  }

  return true; // We handled it
}

/**
 * Handles characters decoded in Send Only mode
 * @param {string} letter - The decoded letter
 * @returns {boolean} True if handled
 */
function handleSendOnlyCharacter(letter) {
  console.log('handleSendOnlyCharacter called with:', letter, 'Phase:', sendOnlyPhase);

  if (!isSendOnlyMode()) return false;

  const letterUpper = letter.toUpperCase();
  sendOnlyDecodedText += letterUpper;
  console.log('sendOnlyDecodedText:', sendOnlyDecodedText);

  const cqDecodedText = document.getElementById('cqDecodedText');
  const cqTxText = document.getElementById('cqTxText');
  const sendDecodedText = document.getElementById('sendDecodedText');
  const sendTxText = document.getElementById('sendTxText');
  const tuDecodedText = document.getElementById('tuDecodedText');
  const tuTxText = document.getElementById('tuTxText');
  const responseField = document.getElementById('responseField');

  // CQ Phase: Waiting for user to send CQ
  if (sendOnlyPhase === 'idle' || sendOnlyPhase === 'cq') {
    if (sendOnlyDecodedText.startsWith('CQ')) {
      sendOnlyPhase = 'cq';

      // Show white CQ text and green decoded text
      if (!cqTxText.querySelector('.char')) {
        const modeConfig = getModeConfig();
        const cqMsg = modeConfig.cqMessage(yourStation, null, null);
        prepareTxText(cqTxText, cqMsg);
        cqTxText.style.display = 'inline-block';
        console.log('Prepared CQ white text:', cqMsg);
      }
      cqDecodedText.textContent = sendOnlyDecodedText;
      cqDecodedText.style.display = 'inline-block';

      // Check for end signals: <BK>, BK, or standalone K followed by space
      // Only trigger when we see a SPACE after the K/BK
      const hasBK = sendOnlyDecodedText.includes('<BK> ') || sendOnlyDecodedText.endsWith('<BK>');
      const hasWordBK = /\sBK\s/.test(sendOnlyDecodedText);
      const hasStandaloneK = /\sK\s/.test(sendOnlyDecodedText);

      if (hasBK || hasWordBK || hasStandaloneK) {
        console.log('Triggering stations to respond');
        // Trigger stations to respond without playing user's CQ
        sendOnlyPhase = 'callsign';
        sendOnlyDecodedText = '';

        // Set up auto-send callback for callsign phase
        setupAutoSendCallback();

        // Call the station response logic directly instead of full cq()
        triggerStationResponses();
        return true;
      }
      return true; // We handled this character
    } else {
      // In idle phase, not starting with CQ yet - show in decoded text but don't block
      cqDecodedText.textContent = sendOnlyDecodedText;
      cqDecodedText.style.display = 'inline-block';
      return true; // We handled it by displaying
    }
  }
  // Callsign Phase: User sending callsign
  else if (sendOnlyPhase === 'callsign') {
    sendDecodedText.textContent = sendOnlyDecodedText;
    sendDecodedText.style.display = 'inline-block';

    // Check if user sent a question mark (immediate send)
    if (sendOnlyDecodedText.includes('?')) {
      console.log('Question mark detected - sending callsign immediately');

      // Remove the question mark
      let callsign = sendOnlyDecodedText.replace('?', '').trim();

      console.log('Callsign phase: sending callsign:', callsign);

      // Put callsign in response field and trigger send logic
      responseField.value = callsign;
      sendOnlyDecodedText = '';

      // Clear the auto-send callback since we're sending immediately
      morseInput.clearOnKeyingStoppedCallback();

      // Trigger the send/matching logic
      triggerSendOnlyCallsignMatch();
      return true;
    }

    // If no question mark, the auto-send callback will trigger after pause
    return true; // We handled it
  }
  // Exchange Phase: User sending exchange info
  else if (sendOnlyPhase === 'exchange') {
    sendDecodedText.textContent = sendOnlyDecodedText;
    sendDecodedText.style.display = 'inline-block';

    // Check for end signals: <BK>, BK, or standalone K followed by space
    const hasBK = sendOnlyDecodedText.includes('<BK> ') || sendOnlyDecodedText.endsWith('<BK>');
    const hasWordBK = /\sBK\s/.test(sendOnlyDecodedText);
    const hasStandaloneK = /\sK\s/.test(sendOnlyDecodedText);

    // Or check for question mark (immediate send)
    const hasQuestionMark = sendOnlyDecodedText.includes('?');

    if (hasBK || hasWordBK || hasStandaloneK || hasQuestionMark) {
      console.log('Exchange complete - triggering station response');

      // Remove question mark if present
      let exchange = sendOnlyDecodedText.replace('?', '').trim();

      // Clear auto-send callback
      morseInput.clearOnKeyingStoppedCallback();

      // Trigger the TU response from station
      triggerSendOnlyExchangeResponse(exchange);
      return true;
    }

    return true; // We handled it
  }
  // TU Phase: User sending TU message with state validation
  else if (sendOnlyPhase === 'tu') {
    tuDecodedText.textContent = sendOnlyDecodedText;
    tuDecodedText.style.display = 'inline-block';

    // Validate state letters as user types
    validateTuStateLetters(tuTxText, sendOnlyDecodedText, sendOnlyExpectedState);

    // Check for "E E" to complete the contact
    if (sendOnlyDecodedText.includes('E E') && sendOnlyPhase === 'tu') {
      console.log('E E detected - contact complete!');

      // Immediately set phase to 'completing' to prevent duplicate triggers
      sendOnlyPhase = 'completing';

      // Clear callbacks
      morseInput.clearOnKeyingStoppedCallback();

      // Complete the contact
      completeSendOnlyContact();
      return true;
    }

    return true; // We handled it
  }

  return false; // Not in Send Only mode or unhandled phase
}

/**
 * Gets the current auto-send delay from the slider.
 * @returns {number} Delay in milliseconds
 */
function getAutoSendDelay() {
  const autoSendDelaySlider = document.getElementById('autoSendDelay');
  const delaySeconds = autoSendDelaySlider ? parseFloat(autoSendDelaySlider.value) : 1.0;
  return delaySeconds * 1000;
}

/**
 * Sets up auto-send callback based on the configurable delay slider.
 * Triggers send when user stops keying for the specified duration.
 */
function setupAutoSendCallback() {
  console.log(`Setting up auto-send callback`);

  // Set up the keying stopped callback with a function that reads delay dynamically
  morseInput.setOnKeyingStoppedCallback(() => {
    console.log('Keying stopped - auto-sending');
    handleAutoSend();
  }, getAutoSendDelay);
}

/**
 * Handles auto-send when user stops keying.
 * Triggers the appropriate action based on current phase.
 */
function handleAutoSend() {
  if (sendOnlyPhase === 'callsign') {
    console.log('Auto-send in callsign phase:', sendOnlyDecodedText);

    // Put callsign in response field and trigger send logic
    const responseField = document.getElementById('responseField');
    responseField.value = sendOnlyDecodedText.trim();
    sendOnlyDecodedText = '';

    // Trigger the send/matching logic
    triggerSendOnlyCallsignMatch();
  } else if (sendOnlyPhase === 'exchange') {
    console.log('Auto-send in exchange phase:', sendOnlyDecodedText);

    // Trigger the exchange response from station
    const exchange = sendOnlyDecodedText.trim();
    sendOnlyDecodedText = '';

    triggerSendOnlyExchangeResponse(exchange);
  } else if (sendOnlyPhase === 'tu') {
    console.log('Auto-send in TU phase:', sendOnlyDecodedText);
    // TODO: Implement TU auto-send
  }
}

/**
 * Triggers station responses without playing the user's CQ message.
 * Used in Send Only mode after user manually sends their CQ.
 */
function triggerStationResponses() {
  const modeConfig = getModeConfig();

  // Get inputs (needed for addStations)
  inputs = getInputs();
  if (inputs === null) return;

  // Initialize timing and attempt tracking for Send Only mode
  currentStationStartTime = audioContext.currentTime;
  currentStationAttempts = 0;

  let backgroundStaticDelay = 0;
  if (!isBackgroundStaticPlaying()) {
    createBackgroundStatic();
    backgroundStaticDelay = 2;
  }

  const yourResponseTimer = audioContext.currentTime + backgroundStaticDelay;

  if (modeConfig.showTuStep) {
    // Contest-like modes: CQ adds more stations
    addStations(currentStations, inputs);
    respondWithAllStations(currentStations, yourResponseTimer);
    lastRespondingStations = currentStations;
  } else {
    // Single mode: Just get one station
    const cqButton = document.getElementById('cqButton');
    cqButton.disabled = true;
    nextSingleStation(yourResponseTimer);
  }
}

/**
 * Triggers callsign matching logic for Send Only mode.
 * Matches the user's keyed callsign against active stations.
 */
function triggerSendOnlyCallsignMatch() {
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const sendTxText = document.getElementById('sendTxText');

  let responseFieldText = responseField.value.trim().toUpperCase();

  console.log('Matching callsign:', responseFieldText);

  // Prepare white text display
  prepareTxText(sendTxText, responseFieldText);
  sendTxText.style.display = 'inline-block';

  if (modeConfig.showTuStep) {
    // Multi-station scenario
    if (currentStations.length === 0) {
      console.log('No stations to match');
      return;
    }

    // Check for match type
    let results = currentStations.map((stn) =>
      compareStrings(stn.callsign, responseFieldText.replace('?', ''))
    );
    let hasQuestionMark = responseFieldText.includes('?');
    let isPerfectMatch = results.includes('perfect') && !hasQuestionMark;

    console.log('Match results:', results, 'Perfect:', isPerfectMatch);

    const yourResponseTimer = audioContext.currentTime;

    if (isPerfectMatch) {
      // Perfect match - station sends "R R" and exchange
      console.log('Perfect match! Moving to exchange phase');

      const matchIndex = results.indexOf('perfect');
      const matchedStation = currentStations[matchIndex];

      // Get yourStation first to ensure we have current field values
      const currentYourStation = getYourStation();
      if (!currentYourStation) {
        console.error('Failed to get yourStation for exchange');
        return;
      }

      // Play "R R" acknowledgment
      const rrResponseTimer = matchedStation.player.playSentence(
        'R R',
        yourResponseTimer + 0.25
      );
      updateAudioLock(rrResponseTimer);

      // Prepare white exchange text for user to send
      const modeConfig = getModeConfig();
      const yourExchange = modeConfig.yourExchange(currentYourStation, matchedStation, null);
      prepareTxText(sendTxText, yourExchange);
      sendTxText.style.display = 'inline-block';

      console.log('Prepared exchange white text:', yourExchange);

      // Move to exchange phase
      sendOnlyPhase = 'exchange';
      sendOnlyDecodedText = '';
      activeStationIndex = matchIndex;
      readyForTU = true;

      // Clear any existing auto-send callback - exchange phase uses <BK> detection instead
      morseInput.clearOnKeyingStoppedCallback();

      console.log('Now waiting for user to send exchange with <BK>');
    } else if (results.includes('partial')) {
      // Partial match - stations repeat their callsigns
      console.log('Partial match - stations repeating callsigns');

      let partialMatchStations = currentStations.filter(
        (_, index) => results[index] === 'partial'
      );
      respondWithAllStations(partialMatchStations, yourResponseTimer);
      lastRespondingStations = partialMatchStations;
      currentStationAttempts++;
    } else {
      // No match
      console.log('No match found');
      currentStationAttempts++;
    }
  } else {
    // Single station mode - implement if needed
    console.log('Single station mode not yet implemented for Send Only');
  }
}

/**
 * Triggers station TU response after user sends exchange in Send Only mode.
 * Station sends acknowledgment and displays TU white text for user to respond.
 * @param {string} userExchange - The exchange the user sent
 */
function triggerSendOnlyExchangeResponse(userExchange) {
  const modeConfig = getModeConfig();
  const tuTxText = document.getElementById('tuTxText');
  const sendTxText = document.getElementById('sendTxText');

  console.log('User sent exchange:', userExchange);

  if (activeStationIndex === null || activeStationIndex === undefined) {
    console.log('No active station for exchange');
    return;
  }

  const matchedStation = currentStations[activeStationIndex];
  const yourResponseTimer = audioContext.currentTime;

  // Get yourStation for exchange generation
  const currentYourStation = getYourStation();
  if (!currentYourStation) {
    console.error('Failed to get yourStation for exchange response');
    return;
  }

  // Station sends their exchange (e.g., "<BK> UR 5NN MO MO <BK>")
  const theirExchange = modeConfig.theirExchange(currentYourStation, matchedStation, null);
  const exchangeResponseTimer = matchedStation.player.playSentence(
    theirExchange,
    yourResponseTimer + 0.25
  );
  updateAudioLock(exchangeResponseTimer);

  console.log('Station sending their exchange:', theirExchange);

  // Station sends TU acknowledgment after their exchange
  const tuMessage = 'TU';
  const tuResponseTimer = matchedStation.player.playSentence(
    tuMessage,
    exchangeResponseTimer + 0.5
  );
  updateAudioLock(tuResponseTimer);

  console.log('Station sent TU');

  // Store the station's state for validation (they sent it in their exchange)
  sendOnlyExpectedState = matchedStation.state ? matchedStation.state.toUpperCase() : '';

  // Prepare white TU text for user to send
  // Format: <BK> TU ?? ?? 73 E E
  // User must fill in the state they heard from the station
  const tuWhiteText = `<BK> TU ?? ?? 73 E E`;
  prepareTxText(tuTxText, tuWhiteText);
  tuTxText.style.display = 'inline-block';

  // Clear the white exchange text now that we're moving to TU
  sendTxText.style.display = 'none';

  console.log('Prepared TU white text:', tuWhiteText);

  // Move to TU phase
  sendOnlyPhase = 'tu';
  sendOnlyDecodedText = '';

  // Clear auto-send callback for TU phase - it ends on E E detection
  morseInput.clearOnKeyingStoppedCallback();
}

/**
 * Validates state letters in the TU message as user types.
 * Colors state letters green if correct, red if incorrect.
 * @param {HTMLElement} tuTxText - The white text display element
 * @param {string} decodedText - The text user has typed so far
 * @param {string} expectedState - The expected state letters (e.g., "PA")
 */
function validateTuStateLetters(tuTxText, decodedText, expectedState) {
  if (!expectedState) return;

  // Parse the decoded text to find state letter positions
  // The format is: <BK> TU {state} {state} 73 E E
  // We need to check if the user typed the correct state letters

  const expectedPattern = `<BK> TU ${expectedState} ${expectedState}`;

  // Find where we are in the expected pattern
  let matchIndex = 0;
  for (let i = 0; i < decodedText.length && matchIndex < expectedPattern.length; i++) {
    const expectedChar = expectedPattern[matchIndex];
    const actualChar = decodedText[i];

    // Find the corresponding char span in the white text
    const charSpans = tuTxText.querySelectorAll('.char');
    if (matchIndex < charSpans.length) {
      if (actualChar === expectedChar) {
        // Correct character - mark green
        markCharCorrect(tuTxText, matchIndex);
      } else {
        // Incorrect character - mark red
        markCharIncorrect(tuTxText, matchIndex);
      }
    }
    matchIndex++;
  }
}

/**
 * Completes the Send Only contact after user sends "E E".
 * Plays station's final "E E" response, logs the contact, and resets to idle phase.
 */
function completeSendOnlyContact() {
  console.log('Contact completed successfully!');

  // Validate the state the user sent
  const tuDecodedText = document.getElementById('tuDecodedText');
  const userSentText = tuDecodedText ? tuDecodedText.textContent : sendOnlyDecodedText;
  
  // Check if the expected state appears in what the user sent
  // Remove spaces and check if state letters are present
  const userTextNoSpaces = userSentText.replace(/\s/g, '');
  const expectedStateNoSpaces = sendOnlyExpectedState.replace(/\s/g, '');
  const stateCorrect = userTextNoSpaces.includes(expectedStateNoSpaces);

  console.log('State validation:', {
    expected: sendOnlyExpectedState,
    userSent: userSentText,
    correct: stateCorrect
  });

  // Declare signoffEndTime with default value
  let signoffEndTime = audioContext.currentTime + 1; // Default 1 second if no station

  // Get the matched station for logging and final response
  if (activeStationIndex !== null && activeStationIndex !== undefined && currentStations[activeStationIndex]) {
    const matchedStation = currentStations[activeStationIndex];
    const modeConfig = getModeConfig();

    // Play station's final "E E" response
    const theirSignoff = modeConfig.theirSignoff
      ? modeConfig.theirSignoff(getYourStation(), matchedStation, null)
      : 'EE';

    console.log(`Station sending final signoff: ${theirSignoff}`);

    // Play the signoff immediately
    if (!matchedStation.player) {
      matchedStation.player = createMorsePlayer(matchedStation);
    }
    signoffEndTime = matchedStation.player.playSentence(theirSignoff, audioContext.currentTime);
    updateAudioLock(signoffEndTime);
    
    console.log(`Signoff will end at: ${signoffEndTime}, current time: ${audioContext.currentTime}`);
    
    // Increment total contacts
    totalContacts++;

    // Build WPM string
    const wpmString = `${matchedStation.wpm}${
      matchedStation.enableFarnsworth ? ` / ${matchedStation.farnsworthSpeed}` : ''
    }`;

    // Build extra info with state validation result
    const stateInfo = stateCorrect 
      ? `${sendOnlyExpectedState} ✓` 
      : `${sendOnlyExpectedState} ✗`;

    // Add to results table
    addTableRow(
      'resultsTable',
      totalContacts,
      matchedStation.callsign,
      wpmString,
      currentStationAttempts,
      audioContext.currentTime - currentStationStartTime,
      stateInfo
    );

    console.log(`Contact logged: ${matchedStation.callsign} - State: ${stateInfo}`);
  }

  // Calculate delay to wait for signoff to finish playing
  const currentTime = audioContext.currentTime;
  const delayMs = Math.max(0, (signoffEndTime - currentTime) * 1000) + 500; // Add 500ms buffer
  
  console.log(`Waiting ${delayMs}ms for signoff to complete`);
  
  // Reset to idle phase after signoff completes
  setTimeout(() => {
    // Remove the contacted station from the list
    if (activeStationIndex !== null && activeStationIndex !== undefined) {
      currentStations.splice(activeStationIndex, 1);
      updateActiveStations(currentStations.length);
      console.log(`Station removed. ${currentStations.length} stations remaining.`);
    }

    sendOnlyPhase = 'idle';
    sendOnlyDecodedText = '';
    sendOnlyExpectedState = '';
    activeStationIndex = null;

    // Clear all displays
  const cqDecodedText = document.getElementById('cqDecodedText');
  const cqTxText = document.getElementById('cqTxText');
  const sendDecodedText = document.getElementById('sendDecodedText');
  const sendTxText = document.getElementById('sendTxText');
  const tuDecodedTextElement = document.getElementById('tuDecodedText');
  const tuTxText = document.getElementById('tuTxText');

  if (cqDecodedText) {
    cqDecodedText.textContent = '';
    cqDecodedText.style.display = 'none';
  }
  if (cqTxText) {
    cqTxText.innerHTML = '';
    cqTxText.style.display = 'none';
  }
  if (sendDecodedText) {
    sendDecodedText.textContent = '';
    sendDecodedText.style.display = 'none';
  }
  if (sendTxText) {
    sendTxText.innerHTML = '';
    sendTxText.style.display = 'none';
  }
  if (tuDecodedTextElement) {
    tuDecodedTextElement.textContent = '';
    tuDecodedTextElement.style.display = 'none';
  }
  if (tuTxText) {
    tuTxText.innerHTML = '';
    tuTxText.style.display = 'none';
  }

    console.log('Ready for next CQ');
  }, delayMs);
}

/**
 * Handles the "CQ" button click to call stations.
 *
 * - In multi-station modes, calling CQ adds more stations if enabled.
 * - In single mode, calling CQ fetches a new station if none is active.
 * - Plays the CQ message using the user's station configuration.
 */
function cq() {
  if (getAudioLock()) return;

  const modeConfig = getModeConfig();
  const cqButton = document.getElementById('cqButton');

  if (!modeConfig.showTuStep && currentStation !== null) {
    return;
  }

  let backgroundStaticDelay = 0;
  if (!isBackgroundStaticPlaying()) {
    createBackgroundStatic();
    backgroundStaticDelay = 2;
  }

  inputs = getInputs();
  if (inputs === null) return;

  yourStation = getYourStation();
  yourStation.player = createMorsePlayer(yourStation);

  let cqMsg = modeConfig.cqMessage(yourStation, null, null);

  // Prepare TX text display for CQ
  const cqTxText = document.getElementById('cqTxText');
  const cqDecodedText = document.getElementById('cqDecodedText');
  prepareTxText(cqTxText, cqMsg);

  let yourResponseTimer;

  if (isSendPracticeMode()) {
    // Send practice mode: Show text but don't play audio
    sendPracticeActive = true;
    sendPracticeExpectedText = cqMsg.toUpperCase();
    sendPracticeCurrentIndex = 0;
    yourResponseTimer = audioContext.currentTime; // Immediate

    // Clear and show the decoded text display
    cqDecodedText.textContent = '';
    cqDecodedText.style.display = 'inline-block';

    // Enable word spacing for send practice mode
    morseInput.setWordSpacing(true);

    // Set up custom handler for morse input
    morseInput.setCustomDecodedLetterHandler(handleSendPracticeCharacter);
  } else {
    // Hide decoded text in other modes
    cqDecodedText.style.display = 'none';
    // Normal modes: Play audio with or without highlighting
    const cqCallback = shouldDisplayTxText() ? createHighlightCallback(cqTxText) : null;

    yourResponseTimer = yourStation.player.playSentence(
      cqMsg,
      audioContext.currentTime + backgroundStaticDelay,
      cqCallback
    );
    updateAudioLock(yourResponseTimer);

    // Auto-focus response field after CQ is sent
    if (shouldDisplayTxText()) {
      const responseField = document.getElementById('responseField');
      setTimeout(() => {
        responseField.focus();
      }, (yourResponseTimer - audioContext.currentTime) * 1000);
    }
  }

  if (modeConfig.showTuStep) {
    // Contest-like modes: CQ adds more stations
    addStations(currentStations, inputs);

    if (isSendPracticeMode()) {
      // Store the response to play after user finishes sending
      sendPracticePendingResponse = () => {
        respondWithAllStations(currentStations, audioContext.currentTime);
      };
    } else {
      respondWithAllStations(currentStations, yourResponseTimer);
    }
    lastRespondingStations = currentStations;
  } else {
    // Single mode: Just get one station
    cqButton.disabled = true;

    if (isSendPracticeMode()) {
      // Store the response to play after user finishes sending
      sendPracticePendingResponse = () => {
        nextSingleStation(audioContext.currentTime);
      };
    } else {
      nextSingleStation(yourResponseTimer);
    }
  }
}

/**
 * Sends the user's response to a station or stations.
 *
 * Matches the user's input against active stations, handles repeat requests, and
 * processes partial or perfect matches. Plays responses and exchanges based on the
 * mode's configuration. Adjusts the game state for each scenario.
 */
function send() {
  if (getAudioLock()) return;
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');

  let responseFieldText = responseField.value.trim().toUpperCase();

  // Prevent sending if responseField text box is empty
  if (responseFieldText === '') {
    // If the response field is empty and there are no active stations, call CQ
    if (currentStations.length === 0) {
      cq();
    }
    return;
  }

  console.log(`--> Sending "${responseFieldText}"`);

  // Handle "Clear on Send" checkbox
  const clearOnSendCheckbox = document.getElementById('clearOnSend');
  if (clearOnSendCheckbox && clearOnSendCheckbox.checked) {
    // Clear the response field after capturing the text
    setTimeout(() => {
      responseField.value = '';
    }, 100);
  }

  // Prepare TX text display for Send
  const sendTxText = document.getElementById('sendTxText');
  const sendDecodedText = document.getElementById('sendDecodedText');
  const cqDecodedText = document.getElementById('cqDecodedText');
  prepareTxText(sendTxText, responseFieldText);

  let yourResponseTimer;
  let sendCallback = null;

  // Set up callback for display modes (not send practice)
  if (!isSendPracticeMode()) {
    sendCallback = shouldDisplayTxText() ? createHighlightCallback(sendTxText) : null;
  }

  if (modeConfig.showTuStep) {
    // Multi-station scenario
    if (currentStations.length === 0) return;

    // Check for match type first to determine if we should play audio
    let results = currentStations.map((stn) =>
      compareStrings(stn.callsign, responseFieldText.replace('?', ''))
    );
    let hasQuestionMark = responseFieldText.includes('?');
    let isPerfectMatch = results.includes('perfect') && !hasQuestionMark;

    // Play user's response audio unless in send practice mode
    // In send practice mode, user already keyed the message in morse, so don't replay it
    if (!isSendPracticeMode()) {
      yourResponseTimer = yourStation.player.playSentence(responseFieldText, audioContext.currentTime, sendCallback);
      updateAudioLock(yourResponseTimer);
    } else {
      // In send practice mode, user already keyed it - don't play audio
      yourResponseTimer = audioContext.currentTime;
    }

    // Handling repeats
    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      respondWithAllStations(currentStations, yourResponseTimer);
      lastRespondingStations = currentStations;
      currentStationAttempts++;
      return;
    }

    // Handle QRS
    if (responseFieldText === 'QRS') {
      // For each lastRespondingStations,
      // if Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      lastRespondingStations.forEach((stn) => {
        if (stn.enableFarnsworth) {
          stn.farnsworthSpeed = Math.max(
            5,
            stn.farnsworthSpeed - farnsworthLowerBy
          );
        } else {
          stn.enableFarnsworth = true;
          stn.farnsworthSpeed = stn.wpm - farnsworthLowerBy;
        }
      });

      respondWithAllStations(lastRespondingStations, yourResponseTimer);
      currentStationAttempts++;
      return;
    }

    // results and hasQuestionMark already calculated above
    if (results.includes('perfect')) {
      let matchIndex = results.indexOf('perfect');
      if (hasQuestionMark) {
        // Perfect match but user unsure
        let theirResponseTimer = currentStations[
          matchIndex
        ].player.playSentence('RR', yourResponseTimer + 0.25);
        updateAudioLock(theirResponseTimer);
        currentStationAttempts++;
        return;
      } else {
        // Perfect confirmed match
        let yourExchange, theirExchange;
        yourExchange =
          ' ' +
          modeConfig.yourExchange(
            yourStation,
            currentStations[matchIndex],
            null
          );
        theirExchange = modeConfig.theirExchange(
          yourStation,
          currentStations[matchIndex],
          null
        );

        if (inputs.enableCutNumbers) {
          // inputs.cutNumbers is the object returned by getSelectedCutNumbers()
          // e.g. { '0': 'T', '9': 'N' } if T/0 and N/9 are selected
          const cutMap = inputs.cutNumbers;

          // Convert any digits in yourExchange and theirExchange
          // to their cut-letter equivalent, if found in cutMap
          yourExchange = yourExchange.replace(
            /\d/g,
            (digit) => cutMap[digit] || digit
          );
          theirExchange = theirExchange.replace(
            /\d/g,
            (digit) => cutMap[digit] || digit
          );
        }

        // Update the TX text display to show the full message (callsign + exchange)
        const fullMessage = responseFieldText + yourExchange;
        prepareTxText(sendTxText, fullMessage);

        let yourResponseTimer2, theirResponseTimer;

        if (isSendPracticeMode()) {
          // Send practice mode: Play "R R" acknowledgment first
          const rrResponseTimer = currentStations[matchIndex].player.playSentence(
            'R R',
            yourResponseTimer + 0.25
          );
          updateAudioLock(rrResponseTimer);

          // Update expected text to include exchange
          sendPracticeExpectedText = fullMessage.toUpperCase();
          yourResponseTimer2 = rrResponseTimer + 0.25;

          // NOW activate send practice mode (after callsign was validated)
          sendPracticeActive = true;

          // Clear CQ decoded text and show Send decoded text
          if (cqDecodedText) {
            cqDecodedText.style.display = 'none';
          }
          if (sendDecodedText) {
            sendDecodedText.textContent = '';
            sendDecodedText.style.display = 'inline-block';
          }

          // Enable word spacing and set up custom handler
          morseInput.setWordSpacing(true);
          morseInput.setCustomDecodedLetterHandler(handleSendPracticeCharacter);

          // Store the pending response to play after user finishes
          sendPracticePendingResponse = () => {
            const theirTime = currentStations[matchIndex].player.playSentence(
              theirExchange,
              audioContext.currentTime + 0.5
            );
            updateAudioLock(theirTime);
          };
        } else {
          const fullSendCallback = shouldDisplayTxText() ? createHighlightCallback(sendTxText) : null;

          // Play the exchange part with highlighting starting from where the callsign left off
          yourResponseTimer2 = yourStation.player.playSentence(
            yourExchange,
            yourResponseTimer,
            fullSendCallback ? (index, token) => {
              // Offset the index by the length of the callsign already sent
              highlightChar(sendTxText, responseFieldText.length + index);
            } : null
          );
          updateAudioLock(yourResponseTimer2);
          theirResponseTimer = currentStations[
            matchIndex
          ].player.playSentence(theirExchange, yourResponseTimer2 + 0.5);
          updateAudioLock(theirResponseTimer);
        }

        currentStationAttempts++;

        // Auto-focus info field after exchange is complete (if in display-tx-text mode)
        if (!isSendPracticeMode()) {
          if (shouldDisplayTxText() && modeConfig.requiresInfoField) {
            setTimeout(() => {
              infoField.focus();
            }, (theirResponseTimer - audioContext.currentTime) * 1000);
          } else if (modeConfig.requiresInfoField) {
            infoField.focus();
          }
        }
        readyForTU = true;
        activeStationIndex = matchIndex;
        return;
      }
    }

    if (results.includes('partial')) {
      // Partial matches: repeat them
      let partialMatchStations = currentStations.filter(
        (_, index) => results[index] === 'partial'
      );
      respondWithAllStations(partialMatchStations, yourResponseTimer);
      lastRespondingStations = partialMatchStations;
      currentStationAttempts++;
      return;
    }

    // No matches at all
    currentStationAttempts++;
  } else {
    // Single mode
    if (currentStation === null) return;

    let yourResponseTimer = yourStation.player.playSentence(responseFieldText);
    updateAudioLock(yourResponseTimer);

    if (
      responseFieldText === '?' ||
      responseFieldText === 'AGN' ||
      responseFieldText === 'AGN?'
    ) {
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      currentStationAttempts++;
      return;
    }

    if (responseFieldText === 'QRS') {
      // If Farensworth is already enabled, lower it by farnsworthLowerBy, but not less than 5
      if (currentStation.enableFarnsworth) {
        currentStation.farnsworthSpeed = Math.max(
          5,
          currentStation.farnsworthSpeed - farnsworthLowerBy
        );
      } else {
        currentStation.enableFarnsworth = true;
        currentStation.farnsworthSpeed = currentStation.wpm - farnsworthLowerBy;
      }
      // Create a new player
      currentStation.player = createMorsePlayer(currentStation);
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      currentStationAttempts++;
      return;
    }

    let compareResult = compareStrings(
      currentStation.callsign,
      responseFieldText.replace('?', '')
    );

    if (compareResult === 'perfect') {
      currentStationAttempts++;

      if (responseFieldText.includes('?')) {
        let theirResponseTimer = currentStation.player.playSentence(
          'RR',
          yourResponseTimer + 1
        );
        updateAudioLock(theirResponseTimer);
        return;
      }

      // Perfect match confirmed in single mode
      let yourExchange =
        ' ' + modeConfig.yourExchange(yourStation, currentStation, null);
      let theirExchange = modeConfig.theirExchange(
        yourStation,
        currentStation,
        null
      );

      let yourResponseTimer2 = yourStation.player.playSentence(
        yourExchange,
        yourResponseTimer
      );
      updateAudioLock(yourResponseTimer2);
      let theirResponseTimer = currentStation.player.playSentence(
        theirExchange,
        yourResponseTimer2 + 0.5
      );
      updateAudioLock(theirResponseTimer);
      let yourSignoff = modeConfig.yourSignoff(
        yourStation,
        currentStation,
        null
      );
      let yourResponseTimer3 = yourStation.player.playSentence(
        yourSignoff,
        theirResponseTimer + 0.5
      );
      updateAudioLock(yourResponseTimer3);
      let theirSignoff = modeConfig.theirSignoff(
        yourStation,
        currentStation,
        null
      );
      let theirResponseTimer2 = currentStation.player.playSentence(
        theirSignoff,
        yourResponseTimer3 + 0.5
      );
      updateAudioLock(theirResponseTimer2);

      totalContacts++;
      const wpmString =
        `${currentStation.wpm}` +
        (currentStation.enableFarnsworth
          ? ` / ${currentStation.farnsworthSpeed}`
          : '');
      addTableRow(
        'resultsTable',
        totalContacts,
        currentStation.callsign,
        wpmString,
        currentStationAttempts,
        audioContext.currentTime - currentStationStartTime,
        '' // No additional info in single mode
      );

      nextSingleStation(theirResponseTimer2);
      return;
    } else if (compareResult === 'partial') {
      currentStationAttempts++;
      let theirResponseTimer = currentStation.player.playSentence(
        currentStation.callsign,
        yourResponseTimer + Math.random() + 0.25
      );
      updateAudioLock(theirResponseTimer);
      return;
    }

    // No match in single mode
    currentStationAttempts++;
    let theirResponseTimer = currentStation.player.playSentence(
      currentStation.callsign,
      yourResponseTimer + Math.random() + 0.25
    );
    updateAudioLock(theirResponseTimer);
  }
}

/**
 * Finalizes a QSO (contact) in multi-station modes.
 *
 * Compares the user's input in extra info fields against the current station's
 * attributes. Logs results, updates the UI, and optionally fetches new stations.
 * Plays the user's and station's sign-off messages.
 */
function tu() {
  if (getAudioLock()) return;
  const modeConfig = getModeConfig();
  if (!modeConfig.showTuStep || !readyForTU) return;

  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  let infoValue1 = infoField.value.trim();
  let infoValue2 = infoField2.value.trim();

  let currentStation = currentStations[activeStationIndex];
  totalContacts++;

  // Compare both fields if required
  let extraInfo = '';
  extraInfo += compareExtraInfo(
    modeConfig.extraInfoFieldKey,
    infoValue1,
    currentStation
  );
  if (modeConfig.requiresInfoField2 && modeConfig.extraInfoFieldKey2) {
    if (extraInfo.length > 0) extraInfo += ' / ';
    extraInfo += compareExtraInfo(
      modeConfig.extraInfoFieldKey2,
      infoValue2,
      currentStation
    );
  }

  let arbitrary = null;
  if (currentMode === 'sst') {
    arbitrary = infoValue1; // name
  } else if (currentMode === 'pota') {
    arbitrary = infoValue1; //state
  }

  let yourSignoffMessage = modeConfig.yourSignoff(
    yourStation,
    currentStation,
    arbitrary
  );

  // Prepare TX text display for TU
  const tuTxText = document.getElementById('tuTxText');
  const tuDecodedText = document.getElementById('tuDecodedText');
  prepareTxText(tuTxText, yourSignoffMessage);

  let yourResponseTimer;
  let responseTimerToUse;

  if (isSendPracticeMode()) {
    // Send practice mode: Don't play audio, wait for user to key in the signoff
    sendPracticeExpectedText = yourSignoffMessage.toUpperCase();
    sendPracticeActive = true;

    // Hide previous decoded text elements and show TU decoded text
    const cqDecodedText = document.getElementById('cqDecodedText');
    const sendDecodedText = document.getElementById('sendDecodedText');

    if (cqDecodedText) {
      cqDecodedText.style.display = 'none';
    }
    if (sendDecodedText) {
      sendDecodedText.style.display = 'none';
    }
    if (tuDecodedText) {
      tuDecodedText.textContent = '';
      tuDecodedText.style.display = 'inline-block';
    }

    // Enable word spacing and set up custom handler
    morseInput.setWordSpacing(true);
    morseInput.setCustomDecodedLetterHandler(handleSendPracticeCharacter);

    // Store the pending response to play after user finishes
    // In send practice mode, complete the QSO after user finishes keying
    sendPracticePendingResponse = () => {
      let theirTime = audioContext.currentTime;

      if (typeof modeConfig.theirSignoff === 'function') {
        let theirSignoffMessage = modeConfig.theirSignoff(
          yourStation,
          currentStation,
          null
        );
        if (theirSignoffMessage) {
          theirTime = currentStation.player.playSentence(
            theirSignoffMessage,
            audioContext.currentTime + 0.5
          );
          updateAudioLock(theirTime);
        }
      }

      // Complete the QSO after the response plays
      const wpmString =
        `${currentStation.wpm}` +
        (currentStation.enableFarnsworth
          ? ` / ${currentStation.farnsworthSpeed}`
          : '');

      // Add the QSO result to the table
      addTableRow(
        'resultsTable',
        totalContacts,
        currentStation.callsign,
        wpmString,
        currentStationAttempts,
        audioContext.currentTime - currentStationStartTime,
        extraInfo
      );

      // Remove the worked station
      currentStations.splice(activeStationIndex, 1);
      activeStationIndex = null;
      currentStationAttempts = 0;
      readyForTU = false;
      updateActiveStations(currentStations.length);

      const responseField = document.getElementById('responseField');
      responseField.value = '';
      infoField.value = '';
      infoField2.value = '';
      responseField.focus();

      // Chance of a new station joining
      if (Math.random() < 0.4) {
        addStations(currentStations, inputs);
      }

      respondWithAllStations(currentStations, theirTime);
      lastRespondingStations = currentStations;
      currentStationStartTime = audioContext.currentTime;
    };

    // In send practice mode, don't complete the QSO yet - return early
    return;
  } else {
    // Normal mode: Play audio with highlighting
    const tuCallback = shouldDisplayTxText() ? createHighlightCallback(tuTxText) : null;

    yourResponseTimer = yourStation.player.playSentence(
      yourSignoffMessage,
      audioContext.currentTime + 0.5,
      tuCallback
    );
    updateAudioLock(yourResponseTimer);

    responseTimerToUse = yourResponseTimer;

    if (typeof modeConfig.theirSignoff === 'function') {
      // Call theirSignoff only if it returns a non-empty string
      let theirSignoffMessage = modeConfig.theirSignoff(
        yourStation,
        currentStation,
        null
      );
      if (theirSignoffMessage) {
        let theirResponseTimer = currentStation.player.playSentence(
          theirSignoffMessage,
          yourResponseTimer + 0.5
        );
        updateAudioLock(theirResponseTimer);
        responseTimerToUse = theirResponseTimer;
      }
    }
  }

  const wpmString =
    `${currentStation.wpm}` +
    (currentStation.enableFarnsworth
      ? ` / ${currentStation.farnsworthSpeed}`
      : '');

  // Add the QSO result to the table
  addTableRow(
    'resultsTable',
    totalContacts,
    currentStation.callsign,
    wpmString,
    currentStationAttempts,
    audioContext.currentTime - currentStationStartTime,
    extraInfo
  );

  // Remove the worked station
  currentStations.splice(activeStationIndex, 1);
  activeStationIndex = null;
  currentStationAttempts = 0;
  readyForTU = false;
  updateActiveStations(currentStations.length);

  const responseField = document.getElementById('responseField');
  responseField.value = '';
  infoField.value = '';
  infoField2.value = '';
  responseField.focus();

  // Chance of a new station joining
  if (Math.random() < 0.4) {
    addStations(currentStations, inputs);
  }

  respondWithAllStations(currentStations, responseTimerToUse);
  lastRespondingStations = currentStations;
  currentStationStartTime = audioContext.currentTime;
}

/**
 * Compares the user's input against a station's corresponding property.
 *
 * Matches the input to attributes like name, state, or serial number, and
 * returns a string indicating correctness. For incorrect matches, shows
 * the expected value.
 *
 * @param {string} fieldKey - The station attribute to compare (e.g., name, state).
 * @param {string} userInput - The user's input value.
 * @param {Object} callingStation - The station object to compare against.
 * @returns {string} A string indicating correctness or showing the expected value.
 */
function compareExtraInfo(fieldKey, userInput, callingStation) {
  if (!fieldKey) return '';

  // Grab the raw expected value
  let expectedValue = callingStation[fieldKey];

  // Handle numeric fields separately:
  if (fieldKey === 'serialNumber' || fieldKey === 'cwopsNumber') {
    let userValInt = parseInt(userInput, 10);

    // Handle NaN (i.e., empty or non-numeric input)
    if (isNaN(userValInt)) {
      return `<span class="text-warning">
                <i class="fa-solid fa-triangle-exclamation me-1"></i>
              </span> (${expectedValue})`;
    }

    let correct = userValInt === Number(expectedValue);
    return correct
      ? `<span class="text-success">
           <i class="fa-solid fa-check me-1"></i><strong>${userValInt}</strong>
         </span>`
      : `<span class="text-warning">
           <i class="fa-solid fa-triangle-exclamation me-1"></i>${userValInt}
         </span> (${expectedValue})`;
  }

  // For string-based fields (e.g. name, state), force them to string
  let upperExpectedValue = String(expectedValue).toUpperCase();
  userInput = (userInput || '').toUpperCase().trim();

  // Special rule: if both are empty => "N/A"
  if (upperExpectedValue === '') {
    return 'N/A';
  }

  // Normal string comparison
  let correct = userInput === upperExpectedValue;
  return correct
    ? `<span class="text-success">
         <i class="fa-solid fa-check me-1"></i><strong>${userInput}</strong>
       </span>`
    : `<span class="text-warning">
         <i class="fa-solid fa-triangle-exclamation me-1"></i>${userInput}
       </span> (${upperExpectedValue})`;
}

/**
 * Fetches and sets up a new station in single mode after a completed QSO.
 *
 * Creates a new station object, initializes it with a Morse player, and plays
 * the station's callsign. Updates the game state and refocuses on the response field.
 *
 * @param {number} responseStartTime - The time at which the next station interaction begins.
 */
function nextSingleStation(responseStartTime) {
  const modeConfig = getModeConfig();
  const responseField = document.getElementById('responseField');
  const cqButton = document.getElementById('cqButton');

  let callingStation = getCallingStation();
  printStation(callingStation);
  currentStation = callingStation;
  currentStationAttempts = 0;
  updateActiveStations(1);

  callingStation.player = createMorsePlayer(callingStation);
  let theirResponseTimer = callingStation.player.playSentence(
    callingStation.callsign,
    responseStartTime + Math.random() + 1
  );
  updateAudioLock(theirResponseTimer);

  currentStationStartTime = theirResponseTimer;
  responseField.value = '';
  responseField.focus();

  cqButton.disabled = !modeConfig.showTuStep && currentStation !== null;
}

/**
 * Stops all audio playback and resets the CQ button.
 *
 * Clears the game state for single mode, ensuring no active station remains.
 * Leaves multi-station mode state untouched.
 */
function stop() {
  stopAllAudio();
  const cqButton = document.getElementById('cqButton');
  cqButton.disabled = false;

  // If the mode is single, reset the current station as well
  if (currentMode === 'single') {
    currentStation = null;
    currentStationAttempts = 0;
    currentStationStartTime = null;
    updateActiveStations(0);
  }
}

/**
 * Performs a full reset of the application.
 *
 * Clears the results table, resets all variables, stops audio playback,
 * and focuses on the response field. Adjusts the CQ button based on mode logic.
 */
function reset() {
  clearTable('resultsTable');

  totalContacts = 0;
  currentStation = null;
  currentStationAttempts = 0;
  currentStationStartTime = null;
  currentStations = [];
  activeStationIndex = null;
  readyForTU = false;

  updateActiveStations(0);
  updateAudioLock(0);
  stopAllAudio();

  const responseField = document.getElementById('responseField');
  const infoField = document.getElementById('infoField');
  const infoField2 = document.getElementById('infoField2');
  responseField.value = '';
  infoField.value = '';
  infoField2.value = '';
  responseField.focus();

  const modeConfig = getModeConfig();
  const cqButton = document.getElementById('cqButton');
  cqButton.disabled = false;
}
