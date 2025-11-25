
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const STORAGE_KEY = 'fasttrack_firebase_config';

const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error("Config parse error", e);
    return null;
  }
};

const config = getStoredConfig();

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let isFirebaseConfigured = false;

// Inizializza solo se abbiamo una config apparentemente valida
if (config && config.apiKey && !config.apiKey.includes("INSERISCI")) {
    try {
        app = initializeApp(config);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseConfigured = true;
    } catch (e) {
        console.error("Firebase init error", e);
        // Se fallisce l'init, resettiamo flag ma non cancelliamo config per permettere correzioni
        isFirebaseConfigured = false;
    }
}

export { app, auth, db, isFirebaseConfigured, getStoredConfig };

export const saveConfig = (cfg: any) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    window.location.reload();
};

export const resetConfig = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
};
