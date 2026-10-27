// Connexion de l'appli au projet Firebase « promos-courses ».
//
// Ces informations ne sont pas secrètes : toute appli web Firebase les montre. La sécurité repose
// sur les règles d'accès (firebase/firestore.rules), qui réservent les données aux deux comptes du
// foyer, et sur la clé, qui ne marche que depuis l'adresse de l'appli. Voir docs/liste-commune.md.

import { initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const configuration = {
  apiKey: "AIzaSyCjbyfsWbWDc8Kc8faiTRq9TeH7KhkT36Y",
  authDomain: "promos-courses.firebaseapp.com",
  projectId: "promos-courses",
  storageBucket: "promos-courses.firebasestorage.app",
  messagingSenderId: "967382217672",
  appId: "1:967382217672:web:0add222e528cc9be1346fd",
};

// Pour les tests automatiques, l'appli parle à l'émulateur Firebase (jamais à la vraie base).
const avecEmulateurs = import.meta.env.MODE === "emulateurs";

const app = initializeApp(avecEmulateurs ? { ...configuration, projectId: "demo-promos-courses" } : configuration);

// La connexion reste active sur le téléphone, même après avoir fermé l'appli.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });

// La liste est gardée sur le téléphone : l'appli marche aussi sans réseau (au fond du magasin),
// et les changements partent dès que le réseau revient.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (avecEmulateurs) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
