import en from './en.js';
import fr from './fr.js';
import es from './es.js';
import de from './de.js';
import it from './it.js';
import pt from './pt.js';

// Language registry. Adding a language = add its dictionary file next to en.js
// (same keys; anything left out falls back to English) and register it here with
// its name written in that language, as shown in the language picker.
export const LANGUAGES = {
  en: { name: 'English', messages: en },
  fr: { name: 'Français', messages: fr },
  es: { name: 'Español', messages: es },
  de: { name: 'Deutsch', messages: de },
  it: { name: 'Italiano', messages: it },
  pt: { name: 'Português', messages: pt },
};

export const DEFAULT_LANGUAGE = 'en';
