import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult, signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// ====== PASTE YOUR FIREBASE CONFIG BELOW (between the curly braces) ======
const firebaseConfig = {
  apiKey: "AIzaSyBpIaEoVZ4GpbvPCFcziam4DY8hPRGh28U",
  authDomain: "couchtonight.app",
  projectId: "queuenight-84044",
  storageBucket: "queuenight-84044.firebasestorage.app",
  messagingSenderId: "928451125383",
  appId: "1:928451125383:web:8ad831affb240bc41c1822"
};
// =========================================================================

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch };
export { getAuth, GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult, signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, firebaseSignOut };
export { getFunctions, httpsCallable };
