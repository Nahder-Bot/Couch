import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ====== PASTE YOUR FIREBASE CONFIG BELOW (between the curly braces) ======
const firebaseConfig = {
  apiKey: "AIzaSyBpIaEoVZ4GpbvPCFcziam4DY8hPRGh28U",
  authDomain: "queuenight-84044.firebaseapp.com",
  projectId: "queuenight-84044",
  storageBucket: "queuenight-84044.firebasestorage.app",
  messagingSenderId: "928451125383",
  appId: "1:928451125383:web:8ad831affb240bc41c1822"
};
// =========================================================================

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField };
