// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBmVhS3h9C-ONzy3kwXxW4Mcic6TgtF06g",
  authDomain: "firealert-36d12.firebaseapp.com",
  projectId: "firealert-36d12",
  storageBucket: "firealert-36d12.firebasestorage.app",
  messagingSenderId: "490634852762",
  appId: "1:490634852762:web:e205eb87e8df51b0316223",
  measurementId: "G-TX99D0LKXZ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
