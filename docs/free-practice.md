# Free Practice Module

## Overview
Free Practice is a freeform morse code sending module that provides complete freedom to practice without targets or constraints. Features real-time adaptive decoding with prosign support and the ability to record practice sessions as MP3 files. **Always active** - begins decoding immediately when the page loads, no "Start Practice" button required.

## Core Features
- **Always Active:** Decoding starts automatically on page load, ready to capture morse input immediately
- **Freeform Sending:** Practice sending morse code freely without predefined targets
- **Real-time Decoding:** Enhanced adaptive decoder displays your sending in real-time
- **Prosign Detection:** Automatically recognizes and displays prosigns (<AR>, <BT>, <SK>, <BK>, etc.)
- **Statistics Tracking:** Live character count, word count, and speed (WPM) indicators
- **MP3 Recording:** Record up to 10 minutes of practice and export as MP3
- **Auto-Configuration:** Changing WPM or keyer mode automatically sends MIDI commands to connected devices

## Input Methods

### MIDI Mode (Vail Adapter)
- Auto-detected MIDI CW keys (Vail adapter, TinyMIDI protocol)
- Hot-plug support with automatic device reconnection
- Automatic configuration sync (dit duration, keyer mode)

### Keyboard Mode (vband Adapter)
- Left/Right Ctrl (dit/dah) or `[`/`]` keys
- Compatible with vband USB CW key adapter
- No additional drivers needed

## Keyer Modes
- **Straight Key (mode 1)** - Direct key-down/key-up control
- **Iambic A (mode 2)** - Basic squeeze keying (default)
- **Iambic B (mode 3)** - Advanced squeeze keying with alternation
- **Ultimatic (mode 4)** - Last-pressed-key priority mode

## Recording Features
- **Start/Stop Recording:** Capture sidetone audio during practice
- **Playback Preview:** Listen to your recording before saving
- **MP3 Export:** Download recording as MP3 file
- **10-Minute Limit:** Prevents memory issues (warning at 9:30)
- **Filename Format:** `vail-practice-YYYYMMDD-HHMMSS.mp3`
- **Encoding:** 128kbps, 44.1kHz, stereo MP3 using lamejs

## Output Display
- Large scrolling textarea with monospace font
- Auto-scroll to bottom as characters are decoded
- Character counter (e.g., "152 chars")
- Word counter (e.g., "28 words")
- Real-time WPM speed indicator
- Copy to clipboard button
- Clear output button

## Technical Implementation

### Always-Active Architecture
- All components initialized immediately on page load in `initFreePractice()`
- Dedicated `MorseInputHandler` with `() => true` callback (always active)
- No Start/Stop buttons - keyer runs continuously
- MIDI configuration updates sent when settings change

### MorseProAdapter
Enhanced decoder with prosign support and adaptive timing:
- Extends existing morse decoder with 40+ morse mappings including prosigns
- Adaptive dit/dah duration learning (30-sample rolling average)
- Automatic character/word gap detection (3 dit / 7 dit units)
- WPM calculation using PARIS standard (50 dit units)

### AudioRecorder
MP3 recording engine using Web Audio API + lamejs:
- ScriptProcessorNode captures PCM audio from sidetone
- Buffers Float32 samples during recording (4096 sample chunks)
- Encodes to MP3 on stop using lamejs encoder
- Creates downloadable Blob with automatic filename generation

### Integration
- Reuses existing MorseKeyer, MorseSounder, and MorseInputHandler
- Settings persistence: WPM and keyer mode saved to localStorage

## Prosign Support
- **AR** (end of message): `·-·-·` → `<AR>`
- **BT** (break/pause): `-···-` → `<BT>`
- **SK** (end of contact): `···-·-` → `<SK>`
- **BK** (break-in): `-···-·-` → `<BK>`
- Plus additional prosigns: SN, AA, AS, CT, HH, SOS
- Prosigns displayed with brackets to distinguish from regular characters

## File Locations
- Main logic: [training/scripts/training.js:1198-1682](../training/scripts/training.js#L1198-L1682)
- Enhanced decoder: [training/scripts/morse-pro-adapter.js](../training/scripts/morse-pro-adapter.js)
- MP3 recorder: [training/scripts/audio-recorder.js](../training/scripts/audio-recorder.js)
- CSS styles: [training/training.css:620-721](../training/training.css#L620-L721)
- HTML structure: [training/index.html:463-654](../training/index.html#L463-L654)
