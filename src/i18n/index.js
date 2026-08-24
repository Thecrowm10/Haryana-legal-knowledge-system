import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from './locales/en/common.json';
import commonHi from './locales/hi/common.json';
import loginEn from './locales/en/login.json';
import loginHi from './locales/hi/login.json';
import citizenEn from './locales/en/citizen.json';
import citizenHi from './locales/hi/citizen.json';
import actContentsEn from './locales/en/actContents.json';
import actContentsHi from './locales/hi/actContents.json';
import uploaderEn from './locales/en/uploader.json';
import uploaderHi from './locales/hi/uploader.json';
import approverEn from './locales/en/approver.json';
import approverHi from './locales/hi/approver.json';
import nodalEn from './locales/en/nodal.json';
import nodalHi from './locales/hi/nodal.json';
import adminEn from './locales/en/admin.json';
import adminHi from './locales/hi/admin.json';
import csoEn from './locales/en/cso.json';
import csoHi from './locales/hi/cso.json';
import auditorEn from './locales/en/auditor.json';
import auditorHi from './locales/hi/auditor.json';

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
  ns: ['common', 'login', 'citizen', 'actContents', 'uploader', 'approver', 'nodal', 'admin', 'cso', 'auditor'],
  resources: {
    en: { common: commonEn, login: loginEn, citizen: citizenEn, actContents: actContentsEn, uploader: uploaderEn, approver: approverEn, nodal: nodalEn, admin: adminEn, cso: csoEn, auditor: auditorEn },
    hi: { common: commonHi, login: loginHi, citizen: citizenHi, actContents: actContentsHi, uploader: uploaderHi, approver: approverHi, nodal: nodalHi, admin: adminHi, cso: csoHi, auditor: auditorHi },
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
