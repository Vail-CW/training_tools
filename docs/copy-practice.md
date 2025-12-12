# Copy Practice Module

## Overview
Copy Practice is the basic Morse code receiving practice module. Users listen to Morse code and type what they hear, building recognition skills.

## Practice Modes
1. **All Letters (A-Z)** - Random letter practice
2. **All Numbers (0-9)** - Random number practice
3. **Letters & Numbers** - Mixed alphanumeric
4. **Custom Selection** - Pick specific characters to practice
5. **Common Words** - 100+ words including ham radio terms
6. **Callsigns** - Realistic US amateur radio callsigns
7. **Q Codes** - 20 common amateur radio Q codes
8. **CW Academy** - 10 beginner sessions with progressive character introduction

## Settings
- **Speed:** 5-40 WPM (default 12 WPM)
- **Volume:** 0-100%
- **Tone Frequency:** 400-1000 Hz (default 600 Hz)
- **Character Count:** 1-10 characters per sequence (default 1)
  - Available for: Letters, Numbers, Mixed, Custom, CW Academy modes
  - Hidden for: Words, Callsigns, Q Codes modes

## CW Academy Integration
10 progressive sessions following CW Academy Beginner curriculum:
- **Session 1:** A, E, N, T
- **Session 2:** + S, I, O and numbers 1, 4
- **Session 3:** + H, D, L, R and numbers 2, 5
- **Session 4:** + C, U
- **Session 5:** + M, W and numbers 3, 6
- **Session 6:** + F, Y
- **Session 7:** + G, P, Q and numbers 7, 9
- **Session 8:** + B, V and prosign AR
- **Session 9:** + J, K and prosigns BT + number 0
- **Session 10:** + X, Z and prosigns BK, SK + number 8

Prosigns have 20% chance of appearing when available. Character count setting applies to regular characters; prosigns always appear as single units.

## User Experience Features

### Auto-capitalization
All input automatically converts to uppercase.

### Smart Wrong Answer Handling
- Shows "Try again..." message for 1 second
- Automatically replays morse code after 1 second
- "Show Answer" button appears to reveal answer if needed
- Typing a new guess re-enables "Check Answer" button

### Manual Answer Reveal
- Click "Show Answer" to see correct answer
- "Continue" button appears (must click to proceed to next)
- Gives full control over pacing

### Correct Answer Flow
- Shows "Correct!" message with answer
- Automatically advances to next question after 2 seconds

## Session Statistics
- Total attempts
- Correct answers
- Accuracy percentage
- Current speed display

## Prosign Support
- **AR** (end of message): ·-·-·
- **BT** (break/pause): -···-
- **BK** (break-in): -···-·-
- **SK** (end of contact): ···-·-

Properly handled as single units in morse playback.

## File Locations
- Main logic: [training/scripts/training.js](../training/scripts/training.js)
- HTML: [training/index.html](../training/index.html)
- Styles: [training/training.css](../training/training.css)

## Common Tasks

### Adding a New Practice Mode
1. Add mode to `copyModeSelect` dropdown in index.html
2. Implement generation logic in `startCopyPractice()` function in training.js
3. Test with various WPM settings

### Adding New Words or Q Codes
Edit arrays in training.js:
- `commonWords`: Array of practice words (line ~30-130)
- `qCodes`: Array of Q code objects with code and description (line ~135-160)
