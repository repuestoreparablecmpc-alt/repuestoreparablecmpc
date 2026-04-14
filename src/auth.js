import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAILS = ["repuestoreparablecmpc@gmail.com", "santos.andre.rs@gmail.com"];

/**
 * Inicia sesión con Google SSO
 */
export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        if (!ADMIN_EMAILS.includes(user.email)) {
            await signOut(auth);
            throw new Error("Acceso denegado: El correo no tiene permisos de administrador.");
        }
        
        return user;
    } catch (error) {
        console.error("Error en login:", error.message);
        throw error;
    }
}

/**
 * Cierra la sesión
 */
export async function logout() {
    return await signOut(auth);
}

/**
 * Observa cambios en el estado de autenticación
 * @param {Function} callback 
 */
export function onAuth(callback) {
    return onAuthStateChanged(auth, (user) => {
        if (user && ADMIN_EMAILS.includes(user.email)) {
            callback(user);
        } else {
            callback(null);
        }
    });
}

export { auth };
