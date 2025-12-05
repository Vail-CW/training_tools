// Morse Input Handler - Unified MIDI + Keyboard input for CW keys
// Supports both Vail MIDI adapter and vband keyboard mode
// Based on Vail Repeater MIDI implementation

class MorseInputHandler {
  constructor(keyer, isActiveCallback) {
    this.keyer = keyer; // MorseKeyer instance to send key events to
    this.isActiveCallback = isActiveCallback; // Function to check if practice is active

    // Keyboard mappings (vband USB adapter compatibility)
    this.ditKey1 = 'ControlLeft';
    this.dahKey1 = 'ControlRight';
    this.ditKey2 = 'BracketLeft';  // [ key
    this.dahKey2 = 'BracketRight'; // ] key

    // MIDI state
    this.midiAccess = null;
    this.midiInputs = [];
    this.midiEnabled = false;
    this.ditDuration = 60; // milliseconds (updated by keyer)
    this.keyerMode = 7; // Default to Iambic A (Vail protocol: 1=straight, 5=ultimatic, 7=iambicA, 8=iambicB)

    // Key state tracking
    this.pressedKeys = {
      straight: false,
      dit: false,
      dah: false
    };

    // Initialize input handlers
    this.initKeyboard();
    this.initMIDI();
  }

  // ===== KEYBOARD INPUT =====

  initKeyboard() {
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardEvent(event, true);
    });

    document.addEventListener('keyup', (event) => {
      this.handleKeyboardEvent(event, false);
    });

    console.log('Keyboard input initialized (vband mode)');
  }

  handleKeyboardEvent(event, down) {
    // Check if practice is active (if callback provided)
    if (this.isActiveCallback && !this.isActiveCallback()) {
      return; // Practice not active, ignore input
    }

    // Check if this is a dit or dah key
    const isDit = (event.code === this.ditKey1 || event.code === this.ditKey2);
    const isDah = (event.code === this.dahKey1 || event.code === this.dahKey2);

    if (!isDit && !isDah) {
      return; // Not a CW key
    }

    // Prevent default browser behavior
    event.preventDefault();

    // Pass to keyer's existing press() method
    this.keyer.press(event, down);
  }

  // ===== MIDI INPUT =====

  async initMIDI() {
    // Check if Web MIDI API is available
    if (!navigator.requestMIDIAccess) {
      console.log('Web MIDI API not supported in this browser');
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      console.log('MIDI access granted');

      // Listen for device connection changes
      this.midiAccess.addEventListener('statechange', (e) => {
        this.handleMIDIStateChange(e);
      });

      // Initial device scan
      this.handleMIDIStateChange();

      this.midiEnabled = true;
    } catch (error) {
      console.log('Failed to get MIDI access:', error);
    }
  }

  handleMIDIStateChange(event) {
    if (!this.midiAccess) return;

    // Get current connected inputs
    const currentInputs = Array.from(this.midiAccess.inputs.values());

    // Check if devices disconnected - release all keys
    for (let oldInput of this.midiInputs) {
      if (!currentInputs.includes(oldInput)) {
        console.log('MIDI device disconnected, releasing all keys');
        this.releaseAllKeys();
      }
    }

    // Update MIDI inputs list - only add new ones
    const newInputs = [];
    for (let input of currentInputs) {
      if (input.state === 'connected') {
        // Only attach listener if this is a new input
        if (!this.midiInputs.includes(input)) {
          console.log(`MIDI device connected: ${input.name}`);
          input.addEventListener('midimessage', (e) => {
            this.handleMIDIMessage(e);
          });
        }
        newInputs.push(input);
      }
    }
    this.midiInputs = newInputs;

    // Send configuration to MIDI adapter
    if (this.midiInputs.length > 0) {
      this.sendMIDIConfiguration();
    }

    // Update UI status
    this.updateMIDIStatus();
  }

  updateMIDIStatus() {
    // Update Send Practice MIDI status
    const statusElement = document.getElementById('midi-status');
    if (statusElement) {
      if (this.midiInputs.length > 0) {
        const deviceName = this.midiInputs[0].name || 'Unknown Device';
        statusElement.textContent = `Connected: ${deviceName}`;
        statusElement.classList.remove('is-danger');
        statusElement.classList.add('is-success');
      } else {
        statusElement.textContent = 'Not Detected';
        statusElement.classList.remove('is-success');
        statusElement.classList.add('is-danger');
      }
    }

    // Update Free Practice MIDI status
    const freeStatusElement = document.getElementById('free-midi-status');
    if (freeStatusElement) {
      if (this.midiInputs.length > 0) {
        const deviceName = this.midiInputs[0].name || 'Unknown Device';
        freeStatusElement.textContent = `Connected: ${deviceName}`;
        freeStatusElement.classList.remove('is-danger');
        freeStatusElement.classList.add('is-success');
      } else {
        freeStatusElement.textContent = 'Not Detected';
        freeStatusElement.classList.remove('is-success');
        freeStatusElement.classList.add('is-danger');
      }
    }
  }

  handleMIDIMessage(event) {
    const data = Array.from(event.data);

    // Parse MIDI command
    const cmd = data[0] >> 4;  // Upper 4 bits = command type
    const channel = data[0] & 0x0f; // Lower 4 bits = channel
    const byte1 = data[1];     // Data byte 1 (note or CC number)
    const byte2 = data[2];     // Data byte 2 (velocity or CC value)

    // Handle Control Change messages (adapter reporting settings)
    if (cmd === 0xb) {  // CC message (0xb0)
      if (byte1 === 0x01) {  // CC 0x01 = dit duration
        const ditDuration = byte2;
        this.handleAdapterDitDuration(ditDuration);
      }
      return;
    }

    // Handle Note On/Off messages (key presses)
    const note = byte1;
    const velocity = byte2;

    // Determine if key is pressed or released
    let begin;
    switch (cmd) {
      case 0x9:  // Note On (0x90)
        begin = true;
        break;
      case 0x8:  // Note Off (0x80)
        begin = false;
        break;
      default:
        return; // Ignore other MIDI messages
    }

    // Map MIDI note numbers to key types
    // Vail Adapter protocol:
    //   Note 0 = Straight key
    //   Note 1 = Dit paddle
    //   Note 2 = Dah paddle
    // N6ARA TinyMIDI protocol:
    //   Note 20 = Dit paddle
    //   Note 21 = Dah paddle

    // For training tools, we use browser-side keying (not adapter keying)
    // So we treat all notes as direct key presses

    switch (note) {
      case 0:  // Vail Adapter - Straight key
        this.handleMIDIKey('straight', begin);
        break;

      case 1:  // Vail Adapter - Dit
      case 20: // TinyMIDI - Dit
        this.handleMIDIKey('dit', begin);
        break;

      case 2:  // Vail Adapter - Dah
      case 21: // TinyMIDI - Dah
        this.handleMIDIKey('dah', begin);
        break;

      default:
        console.log(`Unknown MIDI note: ${note}`);
    }
  }

  handleMIDIKey(keyType, begin) {
    // Check if practice is active (if callback provided)
    if (this.isActiveCallback && !this.isActiveCallback()) {
      return; // Practice not active, ignore input
    }

    this.pressedKeys[keyType] = begin;

    // If adapter is running a keyer (mode > 1), treat all messages as straight key
    // This prevents double-keying: adapter does keying, browser just passes through
    // Mode 1 = straight (pass-through), modes 2-4 = iambic A/B/ultimatic (keyed)
    const adapterIsKeying = this.keyerMode > 1;

    if (adapterIsKeying) {
      // Adapter has done the keying logic, just pass audio through
      // Use mode 1 (straight key) to directly control sounder
      const event = {
        code: this.ditKey1, // Doesn't matter which key code for straight mode
        preventDefault: () => {}
      };
      this.keyer.press(event, begin, 1); // Force mode 1 (straight key)
    } else {
      // Adapter is in pass-through mode, apply browser's keyer logic
      const event = {
        code: (keyType === 'dit') ? this.ditKey1 : this.dahKey1,
        preventDefault: () => {}
      };
      this.keyer.press(event, begin);
    }

    console.log(`MIDI ${keyType} key ${begin ? 'down' : 'up'} (adapter keying: ${adapterIsKeying})`);
  }

  releaseAllKeys() {
    // Release all currently pressed keys
    if (this.pressedKeys.straight) {
      this.handleMIDIKey('straight', false);
    }
    if (this.pressedKeys.dit) {
      this.handleMIDIKey('dit', false);
    }
    if (this.pressedKeys.dah) {
      this.handleMIDIKey('dah', false);
    }
  }

  // ===== MIDI CONFIGURATION =====

  sendMIDIConfiguration() {
    if (!this.midiAccess) return;

    for (let output of this.midiAccess.outputs.values()) {
      console.log(`Sending configuration to MIDI device: ${output.name}`);

      // Disable keyboard mode on Vail adapter (CC 0x00)
      // This tells the adapter to send MIDI notes for key presses
      output.send([0xB0, 0x00, 0x00]);

      // Send dit duration (CC 0x01)
      // MIDI is 7-bit (0-127), so divide by 2
      const midiDitValue = Math.min(127, Math.floor(this.ditDuration / 2));
      output.send([0xB0, 0x01, midiDitValue]);

      // Send keyer mode (Program Change 0xC0)
      output.send([0xC0, this.keyerMode]);
    }
  }

  handleAdapterDitDuration(ditDuration) {
    console.log('Adapter reported dit duration:', ditDuration, 'ms');

    // Calculate WPM from dit duration (PARIS method: 50 dit units per word)
    const wpm = Math.round(60000 / (ditDuration * 50));
    console.log('Adapter WPM:', wpm);

    // Update the keyer
    if (this.keyer) {
      this.keyer.setWpm(wpm);
    }

    // Update the visible UI slider based on which module is active
    const freePracticeModule = document.getElementById('free-practice-module');
    const sendPracticeModule = document.getElementById('send-practice-module');

    if (freePracticeModule && freePracticeModule.style.display !== 'none') {
      // Update Free Practice slider
      const freeWpmSlider = document.getElementById('free-wpm');
      const freeWpmOutput = document.querySelector('output[for="free-wpm"]');
      if (freeWpmSlider) {
        freeWpmSlider.value = wpm;
        if (freeWpmOutput) {
          freeWpmOutput.textContent = wpm;
        }
        // Save to localStorage
        localStorage.setItem('vailTrainingFreeWpm', wpm);
        console.log('Updated Free Practice WPM slider to:', wpm);
      }
    } else if (sendPracticeModule && sendPracticeModule.style.display !== 'none') {
      // Update Send Practice slider
      const sendWpmSlider = document.getElementById('send-wpm');
      const sendWpmOutput = document.querySelector('output[for="send-wpm"]');
      if (sendWpmSlider) {
        sendWpmSlider.value = wpm;
        if (sendWpmOutput) {
          sendWpmOutput.textContent = wpm;
        }
        // Update speed display tag
        const sendSpeedDisplay = document.getElementById('send-speed-display');
        if (sendSpeedDisplay) {
          sendSpeedDisplay.textContent = `${wpm} WPM`;
        }
        // Save to localStorage
        localStorage.setItem('vailTrainingSendWpm', wpm);
        console.log('Updated Send Practice WPM slider to:', wpm);
      }
    }
  }

  setDitDuration(duration) {
    this.ditDuration = duration;
    this.sendMIDIConfiguration();
  }

  setKeyerMode(mode) {
    this.keyerMode = parseInt(mode);
    this.sendMIDIConfiguration();
  }

  // ===== STATUS =====

  getStatus() {
    return {
      midiEnabled: this.midiEnabled,
      midiDevices: this.midiInputs.length,
      keyboardEnabled: true,
      pressedKeys: {...this.pressedKeys}
    };
  }

  cleanup() {
    // Remove keyboard listeners
    // (In a real implementation, you'd want to store bound functions
    //  and remove them specifically)

    // Release all MIDI keys
    this.releaseAllKeys();
  }
}
