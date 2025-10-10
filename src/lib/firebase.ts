import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Mirrors services/firebaseConfig.js but configured for web usage
const firebaseConfig = {
  apiKey: 'AIzaSyD4NYntIL5vW1J-nz9anU54hLwpSL6f2r4',
  authDomain: 'switchai-e12d6.firebaseapp.com',
  projectId: 'switchai-e12d6',
  storageBucket: 'switchai-e12d6.firebasestorage.app',
  messagingSenderId: '342819136136',
  appId: '1:342819136136:web:baf0acee691ebd1b55f53d',
  measurementId: 'G-CVZCQT7G15',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Persist auth across reloads and new tabs
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} catch {}
export const db = getFirestore(app);
export const firestore = db;
export const googleProvider = new GoogleAuthProvider();
