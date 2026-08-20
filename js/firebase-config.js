// js/firebase-config.js

// ImgBB API Key (For Free Cloud Image Hosting)
const IMGBB_API_KEY = "fac19ae5956e46b656a6004b390875e2";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD3LmaUOB679Q6Qjc_7Q43O6zfEq1IxRF4",
    authDomain: "custom-zone-8c3ca.firebaseapp.com",
    projectId: "custom-zone-8c3ca",
    storageBucket: "custom-zone-8c3ca.firebasestorage.app",
    messagingSenderId: "1077854273187",
    appId: "1:1077854273187:web:0a3f244ac7bbca22988916",
    measurementId: "G-DY9D736BLY"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore Database connection
const db = firebase.firestore();