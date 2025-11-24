/**
 * TX Text Display Module
 *
 * Handles displaying transmitted text with character-by-character highlighting
 * as morse code is played.
 */

/**
 * Gets the difficulty level setting
 * @returns {string} The current difficulty level ('no-text' or 'display-tx-text')
 */
export function getDifficultyLevel() {
  const difficultySelect = document.getElementById('difficultyLevel');
  return difficultySelect ? difficultySelect.value : 'no-text';
}

/**
 * Checks if TX text should be displayed
 * @returns {boolean} True if TX text should be displayed
 */
export function shouldDisplayTxText() {
  return getDifficultyLevel() === 'display-tx-text';
}

/**
 * Tokenizes text into display units (characters and prosigns)
 * @param {string} text - The text to tokenize
 * @returns {string[]} Array of tokens
 */
function tokenizeForDisplay(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '<') {
      // Start of a prosign
      const endIndex = text.indexOf('>', i);
      if (endIndex !== -1) {
        tokens.push(text.substring(i, endIndex + 1));
        i = endIndex + 1;
      } else {
        // No closing '>', treat '<' as a normal character
        tokens.push(text[i]);
        i++;
      }
    } else if (text[i] === ' ') {
      tokens.push(' ');
      i++;
    } else {
      tokens.push(text[i]);
      i++;
    }
  }
  return tokens;
}

/**
 * Prepares a TX text display element with the given text
 * @param {HTMLElement} displayElement - The element to display the text in
 * @param {string} text - The text to display
 */
export function prepareTxText(displayElement, text) {
  if (!shouldDisplayTxText()) {
    displayElement.style.display = 'none';
    displayElement.innerHTML = '';
    return;
  }

  // Clear previous content
  displayElement.innerHTML = '';
  displayElement.style.display = 'inline-block';

  // Tokenize to handle prosigns correctly
  const tokens = tokenizeForDisplay(text);
  tokens.forEach((token, index) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = token;
    span.dataset.index = index;
    displayElement.appendChild(span);
  });
}

/**
 * Highlights a character at the given index
 * @param {HTMLElement} displayElement - The element containing the text
 * @param {number} index - The index of the character to highlight
 */
export function highlightChar(displayElement, index) {
  if (!shouldDisplayTxText()) return;

  const chars = displayElement.querySelectorAll('.char');
  if (index >= 0 && index < chars.length) {
    chars[index].classList.add('active');
  }
}

/**
 * Clears all highlights from a TX text display
 * @param {HTMLElement} displayElement - The element to clear
 */
export function clearHighlights(displayElement) {
  const chars = displayElement.querySelectorAll('.char.active');
  chars.forEach(char => char.classList.remove('active'));
}

/**
 * Creates a callback function for highlighting characters during playback
 * @param {HTMLElement} displayElement - The element to update
 * @returns {function} Callback function for use with playSentence
 */
export function createHighlightCallback(displayElement) {
  return (index, token) => {
    highlightChar(displayElement, index);
  };
}
