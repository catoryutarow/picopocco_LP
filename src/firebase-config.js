import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCYXDiZCiwj-ZO9xy1yhD1ZWk01NxHW2bg",
  authDomain: "picopocco-blog.firebaseapp.com",
  projectId: "picopocco-blog",
  storageBucket: "picopocco-blog.firebasestorage.app",
  messagingSenderId: "725474073550",
  appId: "1:725474073550:web:3f0674bae272eedf6ae99f"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)
