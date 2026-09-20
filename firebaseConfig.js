import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { createAsyncStorage } from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyBmVhS3h9C-ONzy3kwXxW4Mcic6TgtF06g",
  authDomain: "firealert-36d12.firebaseapp.com",
  projectId: "firealert-36d12",
  storageBucket: "firealert-36d12.firebasestorage.app",
  messagingSenderId: "490634852762",
  appId: "1:490634852762:web:e205eb87e8df51b0316223",
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
// Lưu trạng thái đăng nhập trên React Native
const appStorage = createAsyncStorage("app");

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(appStorage),
});

// Firestore
export const db = getFirestore(app);
