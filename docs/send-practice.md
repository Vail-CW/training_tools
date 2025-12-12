# Send Practice Module

## Overview
Send Practice is a dedicated module for practicing sending Morse code with real-time feedback. Supports both MIDI CW keys (Vail adapter) and keyboard mode (vband adapter), providing a focused environment for developing clean, accurate sending skills.

## Practice Modes
1. **Random Letters** - Single random letters (A-Z)
2. **Random Numbers** - Single random digits (0-9)
3. **Letters & Numbers** - Mixed alphanumeric characters
4. **Common Words** - Practice sending complete words from the ham radio word list

## Keyer Modes
- **Straight Key (mode 1)** - Direct key-down/key-up control
- **Iambic A (mode 2)** - Basic squeeze keying with queue clearing (default)
- **Iambic B (mode 3)** - Advanced squeeze keying with dit/dah alternation
- **Ultimatic (mode 4)** - Last-pressed-key priority mode

## Input Methods

### MIDI Mode (Vail Adapter)
- Web MIDI API integration for direct device connection
- Auto-detects and connects to MIDI CW keys
- Supports Vail Adapter protocol (MIDI notes 0, 1, 2)
- Supports N6ARA TinyMIDI protocol (MIDI notes 20, 21)
- Sends configuration to adapter (dit duration, keyer mode)
- Hot-plug support (auto-reconnects when device is plugged in)

### Keyboard Mode (vband Adapter)
- **Dit:** Left Ctrl or `[` key
- **Dah:** Right Ctrl or `]` key
- Compatible with vband USB CW key adapter (https://www.vailadapter.com)
- No additional drivers needed

## How It Works
1. Press "Start Practice" to begin
2. A target character appears in large text (8rem font size)
3. Send the character using your USB key or keyboard
4. System decodes your morse input with adaptive timing
5. When correct character is sent, automatically advances to next target
6. Visual feedback via send lamp indicator (glows on character decode)

## Features
- **Adaptive Timing:** Decoder automatically adjusts to your sending speed
- **Auto-advance:** Generates new target immediately after correct send
- **Real-time Feedback:** "What You Sent" field shows decoded characters
- **Sidetone Audio:** Configurable tone frequency (uses global settings)
- **Visual Indicators:** Send lamp flashes when characters are decoded
- **Manual Skip:** "Next Character" button to skip difficult targets

## Technical Implementation
- **Unified Input Handler:** `morse-input-handler.js` manages both MIDI and keyboard inputs
- **Web MIDI API:** Direct browser support for MIDI devices (no drivers needed)
- **Adaptive Input:** Automatically uses MIDI if available, falls back to keyboard
- **Practice-aware:** Only processes input when Send Practice is active
- Standalone morse input modules (no ES6 modules, direct script includes)
- Shared Web Audio API context with copy practice
- Character-level decoding with callback notification
- High-frequency oscillator timer for responsive keying
- 5ms attack/release envelope for click-free sidetone
- **MIDI Configuration:** Automatically sends dit duration and keyer mode to MIDI adapter

## File Locations
- Main logic: [training/scripts/training.js](../training/scripts/training.js)
- Sidetone audio: [training/scripts/morse-sounder.js](../training/scripts/morse-sounder.js)
- Decoder: [training/scripts/morse-decoder.js](../training/scripts/morse-decoder.js)
- Keyer: [training/scripts/morse-keyer.js](../training/scripts/morse-keyer.js)
- Input handler: [training/scripts/morse-input-handler.js](../training/scripts/morse-input-handler.js)
- HTML: [training/index.html](../training/index.html)
- Styles: [training/training.css](../training/training.css)

## Debugging Tips
1. Check browser console for keyboard event logging
2. Verify keyer mode is set correctly (1-4)
3. Test with both Control keys and bracket keys
4. Check sidetone volume is not set to 0
5. Ensure morse input is initialized properly
6. Verify decoder timing thresholds match expected WPM
