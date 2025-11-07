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
    this.mode = 2; // 1: straight key, 2: iambicA, 3: iambicB, 4: ultimatic
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
      if (event.code === this.ditKey1 || event.code === this.ditKey2) {
        if (down) {
          this.ditKeyState = 1;
          this.ditStart = Date.now();
        } else {
          this.ditKeyState = 0;
          this.ditStop = Date.now();
        }
      }
      if (event.code === this.dahKey1 || event.code === this.dahKey2) {
        if (down) {
          this.dahKeyState = 1;
          this.dahStart = Date.now();
        } else {
          this.dahKeyState = 0;
          this.dahStop = Date.now();
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
    // Iambic mode queue clearing logic
    if (this.mode === 2 && !this.ditKeyState && !this.dahKeyState && this.queue.length) {
      if (this.queue[0] === 1) {
        // Dit is in the queue
        if (this.ditStart < this.dahStart || this.ditStop - this.ditStart > this.unit * 4) {
          this.queue.pop();
        }
      } else {
        // Dah is in the queue
        if (this.dahStart < this.ditStart || this.dahStop - this.dahStart > this.unit * 2) {
          this.queue.pop();
        }
      }
    }

    if (this.ditKeyState) {
      if (this.queue.length === 0) {
        if ((!this.dahKeyState && !this.sending) || this.lastKey === 2) {
          this.queue.push(1);
        }
      } else {
        // Dah key was lifted and is still in queue
        if (this.mode === 2 && !this.dahKeyState && this.dahStart < this.ditStart && this.queue[0] === 2) {
          this.queue.pop();
        }
      }
    }

    if (this.dahKeyState) {
      if (this.queue.length === 0) {
        if ((!this.ditKeyState && !this.sending) || this.lastKey === 1) {
          this.queue.push(2);
        }
      } else {
        // Dit key was lifted and is still in queue
        if (this.mode === 2 && !this.ditKeyState && this.ditStart < this.dahStart && this.queue[0] === 1) {
          this.queue.pop();
        }
      }
    }

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
