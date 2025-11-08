// Morse Keyer - Handles keyboard/USB key input and iambic keyer modes
// Simplified version for training tools (no ES6 modules)

class MorseKeyer {
  constructor(sounder, decoder) {
    this.sounder = sounder; // MorseSounder instance
    this.decoder = decoder; // MorseDecoder instance

    // Key mappings (compatible with vband USB interface)
    this.ditKey1 = 'ControlLeft';
    this.dahKey1 = 'ControlRight';
    this.ditKey2 = 'BracketLeft';  // [ key
    this.dahKey2 = 'BracketRight'; // ] key

    this.wpm = 20;
    this.unit = 60; // Length of dit in milliseconds
    this.mode = 7; // Vail adapter protocol: 1=straight, 5=ultimatic, 7=iambicA, 8=iambicB
    this.tone = 600;

    this.queue = [];
    this.ditKeyState = 0;
    this.dahKeyState = 0;
    this.lastKey = null;
    this.ditStart = null;
    this.ditStop = null;
    this.dahStart = null;
    this.dahStop = null;
    this.sending = false;
    this.lastSendTimestamp = null;

    // Start oscillator timer
    this.oscillatorTimer = setInterval(() => {
      this.oscillate();
    }, 0);
  }

  setWpm(wpm) {
    this.wpm = wpm;
    this.unit = 60000 / (wpm * 50); // PARIS method
    this.decoder.setUnit(this.unit);
  }

  setMode(mode) {
    this.mode = parseInt(mode);
  }

  setTone(tone) {
    this.tone = tone;
    this.sounder.setTone(tone);
  }

  sendSignal() {
    this.sending = true;
    this.sounder.setTone(this.tone);
    this.sounder.on();
    this.decoder.keyOn();
  }

  stopSignal() {
    this.sounder.off();
    this.decoder.keyOff();
    this.lastSendTimestamp = Date.now();
    setTimeout(() => {
      this.sending = false;
    }, this.unit);
  }

  press(event, down, mode = this.mode) {
    // Straight key mode
    if (mode === 1) {
      if (down) {
        this.sounder.setTone(this.tone);
        this.sounder.on();
        this.decoder.keyOn();
      } else {
        this.sounder.off();
        this.decoder.keyOff();
      }
      return;
    }

    // Iambic modes - only process dit/dah keys
    if (mode > 1 &&
        event.code !== this.ditKey1 &&
        event.code !== this.dahKey1 &&
        event.code !== this.ditKey2 &&
        event.code !== this.dahKey2) {
      return;
    }

    if (mode > 1) {
      let key = -1;
      if (event.code === this.ditKey1 || event.code === this.ditKey2) {
        key = 1; // dit
        if (down) {
          this.ditKeyState = 1;
          this.ditStart = Date.now();
        } else {
          this.ditKeyState = 0;
          this.ditStop = Date.now();
        }
      }
      if (event.code === this.dahKey1 || event.code === this.dahKey2) {
        key = 2; // dah
        if (down) {
          this.dahKeyState = 1;
          this.dahStart = Date.now();
        } else {
          this.dahKeyState = 0;
          this.dahStop = Date.now();
        }
      }

      // Mode-specific queueing on key press
      if (down && key > 0) {
        // Mode 5 (Ultimatic): Queue every key press
        if (mode === 5) {
          this.queue.push(key);
        }
        // Mode 7 (Iambic A): No queuing on single key press
        // Mode 8 (Iambic B): Queue if different from what's sending (for extra element)
        else if (mode === 8 && this.lastKey !== key && this.sending) {
          if (!this.queue.includes(key)) {
            this.queue.push(key);
          }
        }
      }
    }
  }

  processQueue() {
    if (!this.sending && this.queue.length) {
      this.lastKey = this.queue.shift();
      const signalLength = this.lastKey === 1 ? this.unit : this.unit * 3;
      this.sendSignal();
      setTimeout(() => {
        this.stopSignal();
      }, signalLength);
    }
  }

  oscillate() {
    // Determine what to send next based on mode
    let shouldQueue = false;
    let keyToQueue = -1;

    // Mode 5 (Ultimatic) - repeat the currently held key, most recent press wins
    if (this.mode === 5 && !this.sending && this.queue.length === 0) {
      // Add all currently pressed keys to queue
      if (this.ditKeyState && !this.queue.includes(1)) {
        this.queue.push(1);
      }
      if (this.dahKeyState && !this.queue.includes(2)) {
        this.queue.push(2);
      }
    }

    // Mode 7 (Iambic A) - basic alternation, no extra element
    if (this.mode === 7 && this.queue.length === 0) {
      if (this.ditKeyState && (!this.dahKeyState && !this.sending)) {
        shouldQueue = true;
        keyToQueue = 1; // dit
      } else if (this.dahKeyState && (!this.ditKeyState && !this.sending)) {
        shouldQueue = true;
        keyToQueue = 2; // dah
      }
    }

    // Mode 8 (Iambic B) - handled primarily in press() function
    // The extra element is queued when opposite key is pressed during send
    if (this.mode === 8 && !this.sending && this.queue.length === 0) {
      // Only queue if a single key is held
      if (this.ditKeyState && !this.dahKeyState) {
        this.queue.push(1);
      } else if (this.dahKeyState && !this.ditKeyState) {
        this.queue.push(2);
      }
    }

    // For Iambic modes (7 and 8), alternate when both keys pressed (squeeze keying)
    if ((this.mode === 7 || this.mode === 8) && this.ditKeyState && this.dahKeyState) {
      // Both keys pressed - alternate
      if (this.lastKey === 1) {
        keyToQueue = 2; // Just sent dit, queue dah
      } else if (this.lastKey === 2) {
        keyToQueue = 1; // Just sent dah, queue dit
      } else {
        keyToQueue = 1; // Default to dit if no previous key
      }
      shouldQueue = true;
    }

    // Add to queue if determined
    if (shouldQueue && keyToQueue > 0 && this.queue.length === 0) {
      this.queue.push(keyToQueue);
    }

    // Process queue when not sending and enough time has passed
    if (!this.sending && Date.now() - this.lastSendTimestamp > this.unit) {
      this.processQueue();
    }
  }

  cleanup() {
    if (this.oscillatorTimer) {
      clearInterval(this.oscillatorTimer);
    }
  }
}
