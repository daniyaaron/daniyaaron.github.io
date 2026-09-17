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
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyAq_b7Q3tr8ZIz9BxDVD_yZ2oVbiMwzWPA",
    authDomain: "dani-y-aaron.firebaseapp.com",
    projectId: "dani-y-aaron",
    storageBucket: "dani-y-aaron.firebasestorage.app",
    messagingSenderId: "764309271892",
    appId: "1:764309271892:web:2b1c7e446ec40dc53204c1",
    measurementId: "G-RCK4X0WFKD"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
};

// 2) Ve a https://www.themoviedb.org/settings/api, crea una cuenta
//    gratis y copia aquí tu "API Key (v3 auth)".
export const claveTMDb = "TU_CLAVE_TMDB";
