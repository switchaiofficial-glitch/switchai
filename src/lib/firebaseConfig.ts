// Compatibility shim: some modules import from './firebaseConfig'
// Re-export from firebase.ts to keep imports working.
import { auth, db } from './firebase';
export { auth };
export const firestore = db;
