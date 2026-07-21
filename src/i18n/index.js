import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from './locales/en/common.json';
import commonHi from './locales/hi/common.json';
import loginEn from './locales/en/login.json';
import loginHi from './locales/hi/login.json';
import citizenEn from './locales/en/citizen.json';
import citizenHi from './locales/hi/citizen.json';
import uploaderEn from './locales/en/uploader.json';
import uploaderHi from './locales/hi/uploader.json';
import approverEn from './locales/en/approver.json';
import approverHi from './locales/hi/approver.json';

const STORAGE_KEY = 'hlks-lang';

function loadStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'hi') return stored;
  } catch { /* storage unavailable */ }
  return 'en';
}

i18n.use(initReactI18next).init({
  lng: loadStoredLanguage(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'login', 'citizen', 'uploader', 'approver'],
  resources: {
    en: { common: commonEn, login: loginEn, citizen: citizenEn, uploader: uploaderEn, approver: approverEn },
    hi: { common: commonHi, login: loginHi, citizen: citizenHi, uploader: uploaderHi, approver: approverHi },
  },
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

function syncDocumentLanguage(lng) {
  document.documentElement.lang = lng;
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* storage unavailable */ }
}

syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
