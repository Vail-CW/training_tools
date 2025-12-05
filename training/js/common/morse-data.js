// Vail Training Tools - Shared Morse Data
// morseCode map, commonWords, cwAcademySessions, generators

// Morse code map
const morseCode = {
	'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
	'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
	'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
	'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
	'Y': '-.--', 'Z': '--..',
	'0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
	'5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
	// Prosigns
	'AR': '.-.-.', 'BT': '-...-', 'BK': '-...-.-', 'SK': '...-.-'
};

// Common words for practice (mix of ham radio terms and common English words)
const commonWords = [
	// Ham radio specific terms
	'THE', 'AND', 'TO', 'OF', 'A', 'IN', 'IS', 'IT', 'YOU', 'THAT',
	'HE', 'WAS', 'FOR', 'ON', 'ARE', 'WITH', 'AS', 'I', 'HIS', 'THEY',
	'BE', 'AT', 'ONE', 'HAVE', 'THIS', 'FROM', 'OR', 'HAD', 'BY', 'BUT',
	'NOT', 'WHAT', 'ALL', 'WERE', 'WE', 'WHEN', 'YOUR', 'CAN', 'SAID', 'THERE',
	'UP', 'OUT', 'IF', 'ABOUT', 'WHO', 'GET', 'WHICH', 'GO', 'ME', 'WHEN',
	// Ham radio terms
	'HAM', 'RADIO', 'ANTENNA', 'RIG', 'QSO', 'QSL', 'QTH', 'NAME', 'HERE',
	'CALL', 'SIGNAL', 'FREQ', 'BAND', 'CW', 'POWER', 'WX', 'TEMP', 'CLEAR',
	'GOOD', 'BAD', 'WEAK', 'STRONG', 'COPY', 'ROGER', 'OVER', 'OUT', 'BREAK',
	// Numbers as words
	'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
	// Useful short words
	'YES', 'NO', 'NOW', 'NEW', 'OLD', 'DAY', 'WAY', 'MAY', 'BIG', 'USE',
	'HER', 'SHE', 'HIM', 'HOW', 'MAN', 'BOY', 'DID', 'ITS', 'LET', 'PUT',
	'SAY', 'SEE', 'TRY', 'WHY', 'MY', 'SO', 'DO', 'GO', 'HI', 'AM'
];

// CW Academy Beginner Course Sessions (cumulative character sets)
// Each session includes all characters and prosigns from current and previous sessions
const cwAcademySessions = {
	1: { chars: 'AENT', prosigns: [], numbers: '' },
	2: { chars: 'AENTSIO', prosigns: [], numbers: '14' },
	3: { chars: 'AENTSIOHDLR', prosigns: [], numbers: '1425' },
	4: { chars: 'AENTSIOHDLRCU', prosigns: [], numbers: '1425' },
	5: { chars: 'AENTSIOHDLRCUMW', prosigns: [], numbers: '142536' },
	6: { chars: 'AENTSIOHDLRCUMWFY', prosigns: [], numbers: '142536' },
	7: { chars: 'AENTSIOHDLRCUMWFYGPQ', prosigns: [], numbers: '14253679' },
	8: { chars: 'AENTSIOHDLRCUMWFYGPQBV', prosigns: ['AR'], numbers: '14253679' },
	9: { chars: 'AENTSIOHDLRCUMWFYGPQBVJK', prosigns: ['AR', 'BT'], numbers: '0145236789' },
	10: { chars: 'AENTSIOHDLRCUMWFYGPQBVJKXZ', prosigns: ['AR', 'BT', 'BK', 'SK'], numbers: '0123456789' }
};

// Q Codes
const qCodes = [
	'QRL',  // frequency in use
	'QRM',  // interference
	'QRN',  // static/noise
	'QRO',  // increase power
	'QRP',  // reduce power/low power
	'QRQ',  // send faster
	'QRS',  // send slower
	'QRT',  // stop sending
	'QRU',  // nothing for you
	'QRV',  // ready to receive
	'QRX',  // stand by
	'QRZ',  // who is calling me
	'QSB',  // fading
	'QSL',  // acknowledge/confirm
	'QSO',  // contact
	'QSP',  // relay
	'QSY',  // change frequency
	'QTH',  // location
	'QTC',  // message for you
	'QTR'   // time
];

/**
 * Generate a random Q code
 * @returns {string} Random Q code
 */
function generateQCode() {
	return qCodes[Math.floor(Math.random() * qCodes.length)];
}

/**
 * Generate a realistic amateur radio callsign
 * US Callsign format: [Prefix][0-9][Suffix]
 * @returns {string} Generated callsign
 */
function generateCallsign() {
	// Single letter prefixes (most common)
	const singlePrefixes = ['W', 'K', 'N', 'A'];

	// Two letter prefixes
	const twoLetterPrefixes = [];
	// AA-AL series
	for (let i = 0; i < 12; i++) {
		twoLetterPrefixes.push('A' + String.fromCharCode(65 + i));
	}
	// KA-KZ series
	for (let i = 0; i < 26; i++) {
		twoLetterPrefixes.push('K' + String.fromCharCode(65 + i));
	}
	// NA-NZ series
	for (let i = 0; i < 26; i++) {
		twoLetterPrefixes.push('N' + String.fromCharCode(65 + i));
	}
	// WA-WZ series
	for (let i = 0; i < 26; i++) {
		twoLetterPrefixes.push('W' + String.fromCharCode(65 + i));
	}

	// Choose prefix (70% single letter, 30% two letter for realistic distribution)
	const useSingleLetter = Math.random() < 0.7;
	const prefix = useSingleLetter
		? singlePrefixes[Math.floor(Math.random() * singlePrefixes.length)]
		: twoLetterPrefixes[Math.floor(Math.random() * twoLetterPrefixes.length)];

	// District number (0-9)
	const number = Math.floor(Math.random() * 10);

	// Suffix length (1-3 letters)
	// Extra class typically 1-2 letters, General/Tech 2-3 letters
	// Weight toward 2-3 letter suffixes as they're more common
	const rand = Math.random();
	let suffixLength;
	if (rand < 0.2) suffixLength = 1;      // 20% - Extra class (1x1, 2x1)
	else if (rand < 0.6) suffixLength = 2; // 40% - General/Extra (1x2, 2x2)
	else suffixLength = 3;                 // 40% - General/Tech (1x3, 2x3)

	let suffix = '';
	for (let i = 0; i < suffixLength; i++) {
		suffix += String.fromCharCode(65 + Math.floor(Math.random() * 26));
	}

	return prefix + number + suffix;
}

/**
 * Convert text to morse code
 * @param {string} text - Text to convert
 * @returns {string} Morse code representation
 */
function textToMorse(text) {
	// Check if the entire text is a prosign
	if (morseCode[text]) {
		return morseCode[text];
	}
	// Otherwise, split into individual characters
	return text.split('').map(char => morseCode[char] || '').join(' ');
}
