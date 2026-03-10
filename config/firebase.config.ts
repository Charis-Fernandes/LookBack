import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBum1wsHXVSV-7vH34Ph3rGloz8acu6hYs",
  authDomain: "lookback-30b40.firebaseapp.com",
  projectId: "lookback-30b40",
  storageBucket: "lookback-30b40.firebasestorage.app",
  messagingSenderId: "939967695465",
  appId: "1:939967695465:web:f4feb93abb23c6974f30f8",
  measurementId: "G-JNS0V0Y0Z6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

export default app;
