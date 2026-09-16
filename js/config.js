// Pega aquí tus propias claves y sube este archivo tal cual al
// repositorio: como el sitio se sirve como archivos estáticos (GitHub
// Pages), no hay forma de ocultar estas claves del navegador de todos
// modos. Ni la clave de Firebase ni la de TMDb son secretas en ese
// sentido — la seguridad real de los datos la dan las reglas de
// Firestore (ver README.md), no esta clave.

// 1) Ve a https://console.firebase.google.com, crea un proyecto gratis,
//    activa "Firestore Database" (modo de prueba) y copia aquí la
//    configuración que te da la consola (Configuración del proyecto ->
//    tus apps -> SDK setup and configuration).
export const configuracionFirebase = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

// 2) Ve a https://www.themoviedb.org/settings/api, crea una cuenta
//    gratis y copia aquí tu "API Key (v3 auth)".
export const claveTMDb = "TU_CLAVE_TMDB";
