import type { HistoryFile } from '../types';
import { store } from './store';

const FILE_VERSION = '1.2'; // Bumped version for pronunciation aliases support

// Export history to JSON file
export function exportHistory(): void {
  const state = store.getState();

  const exportData: HistoryFile = {
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    characterSet: state.characterSet,
    characters: state.history,
    wordCharacters: state.wordHistory,
    wordModeSettings: state.wordModeSettings,
    pronunciationAliases: state.pronunciationAliases,
    wordPronunciationAliases: state.wordPronunciationAliases,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.download = `morse-icr-history-${timestamp}.json`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Import history from JSON file
export async function importHistory(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as HistoryFile;

    // Validate file format
    if (!data.version || !data.characters) {
      throw new Error('Invalid history file format');
    }

    // Import the data (word history and aliases fields are optional for backwards compatibility)
    store.importState({
      settings: data.settings,
      characterSet: data.characterSet,
      history: data.characters,
      wordHistory: data.wordCharacters || {},
      wordModeSettings: data.wordModeSettings,
      pronunciationAliases: data.pronunciationAliases || {},
      wordPronunciationAliases: data.wordPronunciationAliases || {},
    });

    return true;
  } catch (e) {
    console.error('Failed to import history:', e);
    return false;
  }
}

// Reset all history (both character and word)
export function resetAllHistory(): void {
  if (confirm('Are you sure you want to reset all practice history? This cannot be undone.')) {
    store.resetHistory();
    store.resetWordHistory();
  }
}
