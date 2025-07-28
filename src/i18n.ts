import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { SUPPORTED_LANGUAGES, LANGUAGE_SESSION_STORAGE_KEY } from './types/ui';
import es from '../assets/locales/es/common.json';
import en from '../assets/locales/en/common.json';


const i18nextOptions = {
    order: ['sessionStorage', 'navigator'],
    lookupSessionStorage: LANGUAGE_SESSION_STORAGE_KEY,
    caches: ['sessionStorage'],
}
const resources = {
  en: { common: en },
  es: { common: es }
};


i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES.map(lang => lang.key),
    resources,
    ...i18nextOptions,
    fallbackLng: 'en',
    debug: false,
    defaultNS: 'common',
    interpolation: {
      escapeValue: false
    }
});


export default i18n;
