// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-xhr-backend'
import LanguageDetector from 'i18next-browser-languagedetector';
import { SUPPORTED_LANGUAGES, LANGUAGE_SESSION_STORAGE_KEY } from './types/ui';

const i18nextOptions = {
    order: ['sessionStorage', 'navigator'],
    lookupSessionStorage: LANGUAGE_SESSION_STORAGE_KEY,
    caches: ['sessionStorage'],
}

console.log(`Initializing i18next with options: ${JSON.stringify(i18nextOptions)}`);

i18n
  .use(Backend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES.map(lang => lang.key),
    ...i18nextOptions,
    fallbackLng: 'en',
    debug: true,
    defaultNS: 'common',
    interpolation: {
      escapeValue: false
    }
  });

  console.log(`inext initialized with languages: ${i18n.languages}`);

export default i18n;
