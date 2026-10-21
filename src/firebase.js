import {initializeApp,getApps} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';

const e = import.meta.env;
export const cfg = {
  apiKey: e.VITE_FB_API_KEY || 'mock-api-key',
  authDomain: e.VITE_FB_AUTH_DOMAIN || 'mock.firebaseapp.com',
  projectId: e.VITE_FB_PROJECT_ID || 'mock-project-id',
  storageBucket: e.VITE_FB_STORAGE_BUCKET || '',
  appId: e.VITE_FB_APP_ID || ''
};

export const isMock = !e.VITE_FB_API_KEY || e.VITE_USE_MOCK === 'true';
export const isConfigured = true;
export const app = getApps().length ? getApps()[0] : initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const emailOf = u => `${u.trim().toLowerCase()}@decodeias.app`;
