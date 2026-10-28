import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBmVhS3h9C-ONzy3kwXxW4Mcic6TgtF06g",
  authDomain: "firealert-36d12.firebaseapp.com",
  projectId: "firealert-36d12",
  storageBucket: "firealert-36d12.firebasestorage.app",
  messagingSenderId: "490634852762",
  appId: "1:490634852762:web:e205eb87e8df51b0316223",
};

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);

// Khởi tạo Auth lưu phiên làm việc chuẩn với AsyncStorage
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Export Firestore & Realtime Database
export const db = getFirestore(app);
export const rtdb = getDatabase(app);