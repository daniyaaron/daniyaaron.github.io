# Dani & Aarón — diario de pelis

Un sitio sencillo, solo para ustedes dos, para registrar las pelis que ven
juntos y que cada uno deje su propia reseña. Sin cuentas ni contraseñas:
al entrar simplemente eligen quién es quién ("Dani" o "Aarón") y el sitio
lo recuerda en ese navegador.

Los datos (pelis y reseñas) se guardan en **Firebase Firestore**, así que
se sincronizan solos entre los dos, sin importar el dispositivo desde el
que entren. Los pósters y sinopsis se traen en vivo desde **TMDb** (The
Movie Database) — el sitio nunca guarda ni muestra la película en sí,
solo esa información pública.

## 1. Antes de nada: dos claves gratuitas

### Firebase
1. Entra a https://console.firebase.google.com y crea un proyecto (gratis).
2. En el menú lateral, entra a **Build → Firestore Database** y créala en
   **modo de prueba** (esto la deja abierta por 30 días; más abajo hay
   reglas para dejarla así indefinidamente, ya que el sitio no es público).
3. En **Configuración del proyecto → General**, baja hasta "Tus apps",
   crea una app web (el icono `</>`) y copia el objeto `firebaseConfig`
   que te muestra.
4. Pega esos valores en `js/config.js`, en `configuracionFirebase`.

### TMDb
1. Crea una cuenta gratis en https://www.themoviedb.org
2. Ve a **Configuración → API** (https://www.themoviedb.org/settings/api)
   y solicita una API key (elige "Developer", es instantáneo).
3. Pega la clave ("API Key (v3 auth)") en `js/config.js`, en `claveTMDb`.

## 2. Reglas de Firestore

Como el sitio no tiene contraseñas, cualquiera con el enlace a tu proyecto
de Firebase podría leer o escribir datos. Como acordaron que por ahora no
será público, esto es un riesgo bajo, pero conviene igual limitar un poco
las reglas en **Firestore Database → Reglas**, reemplazando el contenido
por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /peliculas/{idPelicula} {
      allow read, write: if true;
    }
  }
}
```

Esto deja la colección `peliculas` abierta (sin fecha de expiración) pero
el resto del proyecto cerrado. Si más adelante quieren cerrarlo del todo,
lo más simple es agregar Firebase Authentication anónima; avísenme si
llegan a ese punto y lo agregamos.

## 3. Probarlo en su computadora

Como el sitio usa módulos de JavaScript, no alcanza con abrir `index.html`
haciendo doble clic — hace falta un servidor local simple. Por ejemplo,
parados en la carpeta del proyecto:

```
python3 -m http.server 8000
```

y luego abren http://localhost:8000 en el navegador.

## 4. Subirlo a GitHub y publicarlo

1. Suban todo este contenido al repositorio `dani y aaron`.
2. Entren a **Settings → Pages** del repositorio, y en "Source" elijan la
   rama principal (`main`) y la carpeta raíz (`/`).
3. GitHub les va a dar una URL (algo como
   `https://usuario.github.io/dani-y-aaron/`) — esa es la que van a usar
   los dos para entrar.

## Estructura del proyecto

```
dani-y-aaron/
├── index.html        Estructura de las dos pantallas (elegir persona / app)
├── css/style.css      Todo el estilo visual
├── js/config.js       Acá van SUS claves de Firebase y TMDb
├── js/app.js          Toda la lógica: búsqueda, guardado, reseñas
└── README.md          Este archivo
```

## Novedades

- **Por ver / Ya vistas**: dos pestañas separan lo pendiente de lo visto.
  Al agregar una peli cae en "Por ver"; desde el panel de detalle se marca
  como vista eligiendo la fecha (editable después).
- **Promedio en el póster**: si al menos uno de los dos puntuó una peli
  vista, aparece una insignia con el promedio directamente en la rejilla.
- **Estadísticas**: el botón "📊 Estadísticas" del encabezado abre un
  resumen tipo *wrapped* — total de vistas y pendientes, promedio de cada
  uno, la mejor puntuada, la más discutida (mayor diferencia entre los
  dos) y la primera y última peli vista.
- **Búsqueda con debounce**: los resultados de TMDb aparecen solos 450 ms
  después de dejar de escribir (dos letras como mínimo), sin gastar
  consultas de más.
- **Estados de carga**: un spinner mientras carga el diario por primera
  vez y otro mientras llegan los resultados de búsqueda.
- **Línea de tiempo interactiva**: una tercera pestaña muestra todas las
  vistas ordenadas cronológicamente sobre un eje horizontal. La distancia
  entre pósters refleja el tiempo real que pasó entre una y otra (con una
  escala que se aplana para saltos muy largos, para que un hueco de meses
  no aplaste el resto de la línea), y los tramos de más de un día llevan
  una etiqueta ("2 semanas después", "3 meses después"...). Se navega
  arrastrando la barra de scroll o con la rueda del mouse, y cada póster
  abre el mismo panel de detalle.
- **Sin "agregada por"**: ya no se guarda ni se muestra quién sumó cada
  peli — el diario es de los dos.
- **Racha**: las estadísticas ahora también muestran cuántas vieron este
  mes, la racha actual de meses seguidos viendo pelis y su récord.
- **Modo "Sorpréndeme"**: en la pestaña "Por ver" hay un botón que elige
  al azar una peli pendiente y abre su detalle.

## Cómo funciona por dentro

- Cada peli agregada es un documento en la colección `peliculas` de
  Firestore, identificado con el id de TMDb (así nunca se duplica).
- Dentro de cada peli hay un campo `resenas` con dos posibles entradas,
  `dani` y `aaron`, cada una con su puntuación (1 a 5 estrellas) y su
  texto. Cada quien solo puede editar su propia reseña desde el panel de
  detalle; la del otro se ve, pero no se puede tocar.
- La rejilla principal se actualiza sola en tiempo real: si Dani agrega
  una peli o deja una reseña, Aarón la va a ver aparecer sin recargar la
  página (y viceversa).
