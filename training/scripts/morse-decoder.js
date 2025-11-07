// Morse Decoder - Decodes dit/dah patterns into characters
// Simplified version for training tools (no ES6 modules)

const morseToAlphabet = new Map([
  ['12', 'A'],
  ['2111', 'B'],
  ['2121', 'C'],
  ['211', 'D'],
  ['1', 'E'],
  ['1121', 'F'],
  ['221', 'G'],
  ['1111', 'H'],
  ['11', 'I'],
  ['1222', 'J'],
  ['212', 'K'],
  ['1211', 'L'],
  ['22', 'M'],
  ['21', 'N'],
  ['222', 'O'],
  ['1221', 'P'],
  ['2212', 'Q'],
  ['121', 'R'],
  ['111', 'S'],
  ['2', 'T'],
  ['112', 'U'],
  ['1112', 'V'],
  ['122', 'W'],
  ['2112', 'X'],
  ['2122', 'Y'],
  ['2211', 'Z'],
  ['12222', '1'],
  ['11222', '2'],
  ['11122', '3'],
  ['11112', '4'],
  ['11111', '5'],
  ['21111', '6'],
  ['22111', '7'],
  ['22211', '8'],
  ['22221', '9'],
  ['22222', '0'],
  ['121212', '.'],
  ['221122', ','],
  ['21121', '/'],
  ['112211', '?'],
  ['212122', '!'],
  ['211112', '-'],
  ['21221', '('],
  ['212212', ')'],
  ['222111', ':'],
]);

class MorseDecoder {
  constructor(onLetterDecoded) {
    this.onLetterDecoded = onLetterDecoded; // Callback function when a letter is decoded
    this.lastLetter = '';
    this.decodeArray = '';
    this.unit = 80; // Dit duration in ms (adaptive)
    this.keyStartTime = null;
    this.keyEndTime = null;
    this.spaceTimer = null;
    this.farnsworth = 3; // Letter spacing multiplier
    this.wordTimer = null;
    this.wordTimeout = this.unit * 7;
  }

  keyOn() {
    clearTimeout(this.spaceTimer);
    clearTimeout(this.wordTimer);
    this.keyStartTime = Date.now();
  }

  keyOff() {
    this.keyEndTime = Date.now();
    const keyDuration = this.keyStartTime ? this.keyEndTime - this.keyStartTime : 0;

    // Adaptive timing: adjust unit based on actual key duration
    if (keyDuration < this.unit) {
      // Short dit - reduce unit
      this.unit = (keyDuration + this.unit) / 2;
      this.registerDit();
    } else if (keyDuration > this.unit * 3) {
      // Long dah - lengthen unit
      this.unit = (keyDuration / 3 + this.unit) / 2;
      this.registerDah();
    } else {
      // Normal dit or dah
      const ditAndDahThreshold = this.unit * 2;
      if (keyDuration >= ditAndDahThreshold) {
        this.registerDah();
      } else {
        this.registerDit();
      }
    }

    // Wait for letter spacing before decoding
    const spaceTime = this.unit * this.farnsworth;
    this.spaceTimer = setTimeout(() => {
      this.updateLastLetter(this.morseToLetter(this.decodeArray));
      this.decodeArray = '';
    }, spaceTime);
  }

  registerDit() {
    this.decodeArray += '1';
  }

  registerDah() {
    this.decodeArray += '2';
  }

  updateLastLetter(letter) {
    this.lastLetter = letter;

    // Notify the callback function that a new letter is decoded
    if (this.onLetterDecoded) {
      this.onLetterDecoded(letter);
    }
  }

  morseToLetter(sequence) {
    const letter = morseToAlphabet.get(sequence);
    if (letter) {
      return letter;
    } else {
      return '*'; // Unknown sequence
    }
  }

  calculateWpm() {
    return 60000 / (this.unit * 50);
  }

  setFarnsworth(farnsworth) {
    this.farnsworth = farnsworth;
  }

  setUnit(unit) {
    this.unit = unit;
  }
}
