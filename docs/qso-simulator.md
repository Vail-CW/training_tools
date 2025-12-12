# QSO Simulator Module

## Overview
A sophisticated pileup training simulator for practicing contest-style and field activation QSOs. Based on the Morse Walker project by W6NYC, heavily customized with Vail branding and color scheme.

## Training Modes
1. **Single Caller** - Practice basic QSOs with one station at a time
2. **Basic Contest** - Handle multiple stations calling simultaneously
3. **POTA Activator** - Simulate Parks on the Air activation scenarios
4. **CW Ops Test (CWT)** - Practice CWT-style exchanges
5. **K1USN SST** - Simulate SST contest format

## Difficulty Levels
Each mode supports three difficulty levels:

1. **Receive Only** - Station sends complete exchange, you just listen and copy
   - Practice receiving exchanges at various speeds
   - Focus on copying callsigns and exchange information
   - No sending required

2. **Receive & Send** - Traditional pileup training (default mode)
   - Send callsigns to respond to callers
   - Send your exchange when requested
   - Station responds with their information
   - Practice both sending and receiving

3. **Send Only** - YOU initiate the contact, station responds
   - YOU send CQ to call stations
   - Multiple stations may respond to your CQ
   - YOU send their callsign when you pick one from the pileup
   - Station sends "R R" on perfect match, otherwise repeats callsign
   - YOU send your exchange (mode-dependent format)
   - Station sends their exchange after detecting your `<BK>`
   - YOU send TU with their information (e.g., `<BK> TU VT VT 73 E E`)
   - Station validates your copy and sends final "E E" confirmation
   - Contact logged with state validation (✓ correct, ✗ incorrect)
   - System resets for next CQ automatically

## POTA Mode Send Only Workflow

Complete workflow for POTA (Parks on the Air) Send Only difficulty:

1. **Call CQ** - YOU send: `CQ CQ POTA [YOUR_CALL] [YOUR_CALL] K`
2. **Stations Respond** - Multiple stations may respond with their callsigns
3. **Send Callsign** - YOU pick one and send their callsign
4. **Station Confirms** - Station sends `R R` on perfect match, otherwise repeats callsign
5. **Your Exchange** - White text shows: `TU UR 5NN 5NN MD MD <BK>` (with your state)
   - YOU send this exchange with your state repeated twice
6. **Station Exchange** - Station sends: `<BK> UR 5NN VT VT <BK>` (with their state)
7. **TU Message** - White text shows: `<BK> TU ?? ?? 73 E E` (question marks are placeholders)
   - YOU copy the state you heard (e.g., VT) and send: `<BK> TU VT VT 73 E E`
8. **Final Confirmation** - Station sends: `E E`
9. **Contact Logged** - System validates your state copy:
   - ✓ = Correct (state matches what station sent)
   - ✗ = Incorrect (state doesn't match)
10. **System Reset** - After ~500ms delay, returns to idle for next CQ

### State Validation Details
- System compares the state you sent with what the station actually sent
- Spaces are ignored in comparison (so "VTVT", "VT VT", or "V T V T" all work)
- Contact is logged regardless of whether state was correct
- Results table shows the expected state with validation indicator

## USB CW Key Support

### Real-time Morse Input
Use keyboard or USB CW keys to send morse code in the simulator.

### Key Mappings
- **Left Control** = Dit (primary)
- **Right Control** = Dah (primary)
- **`[` key** = Dit (backup for USB interfaces like vband)
- **`]` key** = Dah (backup for USB interfaces)

### Multiple Keyer Modes
- **Mode 1: Straight Key** (default) - Direct on/off control, best for beginners
- **Mode 2: Iambic A** - Automatic alternation between dit and dah
- **Mode 3: Iambic B** - Enhanced with queue retention for smoother keying
- **Mode 4: Ultimatic** - Lever-priority keying mode

**Note:** The default mode is Straight Key (Mode 1), which provides the simplest behavior - what you press is exactly what you get, with no automatic keying features.

### Real-time Decoder
- Automatically converts dit/dah timing into characters
- Adaptive speed adjustment based on your actual keying speed
- Inserts decoded characters directly into input fields
- Supports Farnsworth timing configuration

### Audio Sidetone
- Configurable sidetone frequency (matches "Your Sidetone" setting)
- Configurable volume (matches "Sidetone Volume" setting)
- 5ms attack/release envelope for smooth, click-free tones
- Uses shared AudioContext with main application

## Key Features

### Realistic Audio Environment
- Multiple simultaneous CW tones at different frequencies
- QSB (signal fading) simulation with configurable percentage
- QRN (atmospheric noise) at various intensity levels (Off, Normal, Moderate, Heavy)
- Volume normalization prevents audio artifacts

### Configurable Settings
- **Your station:** Callsign, name, state, speed (WPM), sidetone frequency/volume, keyer mode
- **Responding stations:** Max stations, speed range (min/max WPM), Farnsworth spacing
- **Tone range:** 400-9999 Hz (min/max)
- **Volume range:** 0-100% (min/max)
- **Wait time:** 0-5 seconds between responses
- **Cut numbers support:** T/0, A/1, U/2, V/3, E/5, G/7, D/8, N/9
- **Callsign format options:** 1x1, 1x2, 2x1, 2x2, 1x3, 2x3
- **US-only callsigns option**

### Advanced Interactions
- Partial callsign matching to isolate stations in pileup
- "AGN" or "?" to request repeats
- "QRS" to slow down responding stations (adds Farnsworth spacing)
- Real-time attempts and timing tracking
- Results table with accuracy feedback
- USB CW key input for realistic sending practice

### Development Tools
- Browser console "cheat mode" displays calling station callsigns
- JSDoc documentation available
- Webpack build system for optimization
- Hot module replacement in dev mode
- Prettier code formatting
- Husky pre-commit hooks

## Technical Architecture
- Modular ES6+ JavaScript with Webpack bundling
- Shared AudioContext with individual OscillatorNode instances per station
- GainNode for QSB simulation with depth, frequency, and phase randomization
- Mode-based configuration system for different contest formats
- LocalStorage for settings persistence
- Bootstrap 5 + custom Vail dark theme CSS
- Morse input system with event-driven keyer/decoder architecture

## File Locations
- Main source: [training/qso-simulator/src/](../training/qso-simulator/src/)
- Morse input: [training/qso-simulator/src/js/morse-input/](../training/qso-simulator/src/js/morse-input/)
- Build output: [training/qso-simulator/dist/](../training/qso-simulator/dist/)
- Entry point: [training/qso-simulator/src/js/app.js](../training/qso-simulator/src/js/app.js)
- Mode configurations: [training/qso-simulator/src/js/modes.js](../training/qso-simulator/src/js/modes.js)
- Theme customization: [training/qso-simulator/src/css/style.css](../training/qso-simulator/src/css/style.css)

## Morse Input Modules
- `keyer.js` - Multi-mode keyer implementation with WPM-based timing (256 lines)
- `decoder.js` - Dit/dah sequence to character conversion with adaptive timing (148 lines)
- `sounder.js` - Audio sidetone generation using Web Audio API (112 lines)
- `morse-input.js` - System coordinator and integration (113 lines)

## Build Commands
```bash
cd training/qso-simulator
npm install          # Install dependencies
npm start           # Development server with hot reload
npm run build       # Production build to dist/
npm run format      # Format code with Prettier
```

## Vail Customizations
- Rebranded from "Morse Walker" to "Vail QSO Simulator"
- Changed tagline from "Walk before you run!" to "Master the pileup!"
- Applied Vail dark theme colors (turquoise #00d1b2 accent on dark backgrounds)
- Updated all links to point to vailmorse.com, Discord, and KE9BOS contact
- Maintained credit to original author W6NYC in footer
- Switched from Cerulean to Darkly Bootstrap theme with CSS overrides
- Added USB CW key support while preserving all original features (especially cut numbers)

## Debugging Tips
1. Check browser console for keyboard event logging
2. Verify keyer mode is set correctly (1-4)
3. Test with both Control keys and bracket keys
4. Check sidetone volume is not set to 0
5. Ensure morse input is initialized (click CQ button first)
6. Verify decoder timing thresholds match expected WPM

## Common Tasks

### Modifying USB CW Key Mappings
Edit keyer initialization in `morse-input/keyer.js`:
- `ditKey1`: Primary dit key (currently 'ControlLeft')
- `dahKey1`: Primary dah key (currently 'ControlRight')
- `ditKey2`: Backup dit key (currently 'BracketLeft')
- `dahKey2`: Backup dah key (currently 'BracketRight')
