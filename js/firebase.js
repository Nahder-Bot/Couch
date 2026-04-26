import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult, signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut as firebaseSignOut, updatePassword, EmailAuthProvider, signInWithEmailAndPassword, reauthenticateWithCredential, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
// Phase 11 / REFR-09 — Firebase Storage (first Couch use). Narrow scope per CLAUDE.md:
// only post-session couch-album photo uploads. Storage rules in the deploy-mirror sibling
// repo's storage.rules restrict writes to authed users + 5MB + image/* MIME (Variant A —
// see 11-05-SUMMARY.md for variant-selection rationale).
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
export const storage = getStorage(app);
export { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch };
export { getAuth, GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult, signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, firebaseSignOut, updatePassword, EmailAuthProvider, signInWithEmailAndPassword, reauthenticateWithCredential, signInAnonymously };
export { getFunctions, httpsCallable };
export { getStorage, storageRef, uploadBytes, getDownloadURL };
