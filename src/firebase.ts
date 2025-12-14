import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyDBdK6hHw__PDLxk3KkGMKGR5HnXQ3FaiY",
    authDomain: "alin-2a386.firebaseapp.com",
    databaseURL: "https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "alin-2a386",
    storageBucket: "alin-2a386.firebasestorage.app",
    messagingSenderId: "774803910290",
    appId: "1:774303910290:web:bbcc7b8f95b6d2af5b404b"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
