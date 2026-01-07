import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // We are hardcoding this to strictly bypass any .env issues
  apiKey: "AIzaSyA_dB36QLMt1_Q7bNkQoZO1NIK7F-HMLAg",
  authDomain: "pratibimba-web.firebaseapp.com",
  projectId: "pratibimba-web",
  storageBucket: "pratibimba-web.firebasestorage.app",
  messagingSenderId: "928103275536",
  appId: "1:928103275536:web:47511a9d2ed153c9e0be95"
};

// 🔍 DEBUG: This will print the key to your browser console
console.log("🔥 Firebase Key Check:", firebaseConfig.apiKey);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();