import { configuracionFirebase, claveTMDb } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase ----------
const app = initializeApp(configuracionFirebase);
const db = getFirestore(app);
const coleccionPelis = collection(db, "peliculas");

// ---------- TMDb ----------
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

async function buscarEnTMDb(consulta) {
  const url = `${TMDB_BASE}/search/movie?api_key=${claveTMDb}&language=es-ES&query=${encodeURIComponent(consulta)}`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error("No se pudo buscar en TMDb");
  const datos = await respuesta.json();
  return datos.results || [];
}

// ---------- Estado local ----------
let personaActual = localStorage.getItem("personaActual"); // "dani" | "aaron" | null
let peliculas = []; // espejo local de la colección de Firestore
let idPeliculaAbierta = null;

// ---------- Elementos ----------
const pantallaPersona = document.getElementById("pantalla-persona");
const pantallaApp = document.getElementById("pantalla-app");
const insigniaUsuario = document.getElementById("insignia-usuario");
const btnCambiarPersona = document.getElementById("btn-cambiar-persona");

const formBuscar = document.getElementById("form-buscar");
const inputBuscar = document.getElementById("input-buscar");
const panelResultados = document.getElementById("panel-resultados");
const listaResultados = document.getElementById("lista-resultados");
const btnCerrarResultados = document.getElementById("btn-cerrar-resultados");

const rejillaPelis = document.getElementById("rejilla-pelis");
const contadorPelis = document.getElementById("contador-pelis");
const estadoVacio = document.getElementById("estado-vacio");

const panelDetalle = document.getElementById("panel-detalle");
const fondoDetalle = document.getElementById("fondo-detalle");
const btnCerrarDetalle = document.getElementById("btn-cerrar-detalle");
const btnQuitarPelicula = document.getElementById("btn-quitar-pelicula");

const mensajeFlash = document.getElementById("mensaje-flash");

const NOMBRES = { dani: "Dani", aaron: "Aarón" };

// ---------- Arranque ----------
document.querySelectorAll(".opcion-persona").forEach((boton) => {
  boton.addEventListener("click", () => {
    personaActual = boton.dataset.persona;
    localStorage.setItem("personaActual", personaActual);
    mostrarApp();
  });
});

if (personaActual) {
  mostrarApp();
}

function mostrarApp() {
  pantallaPersona.classList.add("oculto");
  pantallaApp.classList.remove("oculto");
  insigniaUsuario.textContent = NOMBRES[personaActual];
  insigniaUsuario.style.setProperty(
    "--color-persona",
    `var(--color-${personaActual})`
  );
  suscribirseAPeliculas();
}

btnCambiarPersona.addEventListener("click", () => {
  localStorage.removeItem("personaActual");
  location.reload();
});

// ---------- Sincronización en tiempo real con Firestore ----------
function suscribirseAPeliculas() {
  onSnapshot(
    coleccionPelis,
    (instantanea) => {
      peliculas = instantanea.docs.map((d) => ({ id: d.id, ...d.data() }));
      peliculas.sort((a, b) => {
        const fechaA = a.fechaAgregada?.toMillis?.() ?? 0;
        const fechaB = b.fechaAgregada?.toMillis?.() ?? 0;
        return fechaB - fechaA;
      });
      pintarRejilla();
      if (idPeliculaAbierta) pintarDetalle(idPeliculaAbierta);
    },
    (error) => {
      console.error(error);
      mostrarFlash("No se pudo conectar con Firebase. Revisa js/config.js");
    }
  );
}

// ---------- Búsqueda ----------
formBuscar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const consulta = inputBuscar.value.trim();
  if (!consulta) return;

  try {
    const resultados = await buscarEnTMDb(consulta);
    pintarResultados(resultados);
  } catch (error) {
    console.error(error);
    mostrarFlash("No se pudo buscar. Revisa tu clave de TMDb en js/config.js");
  }
});

btnCerrarResultados.addEventListener("click", () => {
  panelResultados.classList.add("oculto");
});

function pintarResultados(resultados) {
  listaResultados.innerHTML = "";

  if (resultados.length === 0) {
    listaResultados.innerHTML = `<p class="estado-vacio">No se encontró ninguna peli con ese nombre.</p>`;
  }

  resultados.slice(0, 12).forEach((resultado) => {
    const yaEsta = peliculas.some((p) => p.tmdbId === resultado.id);
    const item = document.createElement("div");
    item.className = "resultado-item";
    const anio = (resultado.release_date || "").slice(0, 4);

    item.innerHTML = resultado.poster_path
      ? `<img src="${TMDB_IMG}${resultado.poster_path}" alt="Póster de ${resultado.title}" />`
      : `<div class="resultado-sin-poster">🎬</div>`;
    item.innerHTML += `<span>${resultado.title}${anio ? ` (${anio})` : ""}${
      yaEsta ? " · ya está" : ""
    }</span>`;

    item.addEventListener("click", () => {
      if (yaEsta) {
        mostrarFlash("Esa peli ya está en el diario.");
        return;
      }
      agregarPelicula(resultado);
    });

    listaResultados.appendChild(item);
  });

  panelResultados.classList.remove("oculto");
}

async function agregarPelicula(resultado) {
  const idDoc = String(resultado.id);
  const datos = {
    tmdbId: resultado.id,
    titulo: resultado.title,
    anio: (resultado.release_date || "").slice(0, 4),
    poster_path: resultado.poster_path || null,
    sinopsis: resultado.overview || "Sin sinopsis disponible.",
    agregadaPor: personaActual,
    fechaAgregada: serverTimestamp(),
    resenas: { dani: null, aaron: null },
  };

  try {
    await setDoc(doc(db, "peliculas", idDoc), datos);
    panelResultados.classList.add("oculto");
    inputBuscar.value = "";
    mostrarFlash(`"${resultado.title}" se añadió al diario.`);
  } catch (error) {
    console.error(error);
    mostrarFlash("No se pudo guardar la peli.");
  }
}

// ---------- Rejilla principal ----------
function pintarRejilla() {
  rejillaPelis.innerHTML = "";
  contadorPelis.textContent = peliculas.length
    ? `${peliculas.length} ${peliculas.length === 1 ? "peli" : "pelis"}`
    : "";
  estadoVacio.classList.toggle("oculto", peliculas.length > 0);

  peliculas.forEach((peli) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-pelicula";

    tarjeta.innerHTML = peli.poster_path
      ? `<img src="${TMDB_IMG}${peli.poster_path}" alt="Póster de ${peli.titulo}" />`
      : `<div class="sin-poster">🎬</div>`;

    const puntos = ["dani", "aaron"]
      .filter((persona) => peli.resenas?.[persona])
      .map((persona) => `<span class="punto-resena" style="background: var(--color-${persona})"></span>`)
      .join("");

    tarjeta.innerHTML += `
      <div class="puntos-resena">${puntos}</div>
      <div class="titulo-tarjeta">${peli.titulo}</div>
      <div class="anio-tarjeta">${peli.anio || ""}</div>
    `;

    tarjeta.addEventListener("click", () => abrirDetalle(peli.id));
    rejillaPelis.appendChild(tarjeta);
  });
}

// ---------- Panel de detalle ----------
function abrirDetalle(id) {
  idPeliculaAbierta = id;
  pintarDetalle(id);
  panelDetalle.classList.remove("oculto");
}

function cerrarDetalle() {
  idPeliculaAbierta = null;
  panelDetalle.classList.add("oculto");
}

btnCerrarDetalle.addEventListener("click", cerrarDetalle);
fondoDetalle.addEventListener("click", cerrarDetalle);

function pintarDetalle(id) {
  const peli = peliculas.find((p) => p.id === id);
  if (!peli) {
    cerrarDetalle();
    return;
  }

  document.getElementById("detalle-poster").src = peli.poster_path
    ? `${TMDB_IMG}${peli.poster_path}`
    : "";
  document.getElementById("detalle-poster").alt = `Póster de ${peli.titulo}`;
  document.getElementById("detalle-titulo").textContent = peli.titulo;
  document.getElementById("detalle-meta").textContent = peli.anio || "";
  document.getElementById("detalle-sinopsis").textContent = peli.sinopsis;
  document.getElementById("detalle-agregada").textContent = peli.agregadaPor
    ? `Añadida por ${NOMBRES[peli.agregadaPor]}`
    : "";

  pintarTarjetaResena("dani", peli);
  pintarTarjetaResena("aaron", peli);
}

function pintarTarjetaResena(persona, peli) {
  const contenedor = document.getElementById(`resena-${persona}`);
  const resena = peli.resenas?.[persona] || null;
  const esMiTarjeta = persona === personaActual;

  let html = `<span class="nombre-resena">${NOMBRES[persona]}</span>`;

  if (!esMiTarjeta) {
    if (resena) {
      html += pintarEstrellasSoloLectura(resena.puntuacion);
      html += `<p class="texto-resena">${escaparHtml(resena.texto || "")}</p>`;
    } else {
      html += `<p class="sin-resena">Todavía no dejó reseña.</p>`;
    }
    contenedor.innerHTML = html;
    return;
  }

  // Es la tarjeta de la persona actual: formulario editable
  const puntuacionActual = resena?.puntuacion || 0;
  html += `<div class="estrellas" data-puntuacion="${puntuacionActual}">`;
  for (let i = 1; i <= 5; i++) {
    html += `<button type="button" class="estrella ${i <= puntuacionActual ? "activa" : ""}" data-valor="${i}">★</button>`;
  }
  html += `</div>`;
  html += `<textarea placeholder="¿Qué les pareció? (opcional)">${
    resena?.texto ? escaparHtml(resena.texto) : ""
  }</textarea>`;
  html += `<button class="guardar">${resena ? "Actualizar reseña" : "Guardar reseña"}</button>`;

  contenedor.innerHTML = html;

  const contenedorEstrellas = contenedor.querySelector(".estrellas");
  let puntuacionSeleccionada = puntuacionActual;

  contenedorEstrellas.querySelectorAll(".estrella").forEach((estrella) => {
    estrella.addEventListener("click", () => {
      puntuacionSeleccionada = Number(estrella.dataset.valor);
      contenedorEstrellas.querySelectorAll(".estrella").forEach((e) => {
        e.classList.toggle("activa", Number(e.dataset.valor) <= puntuacionSeleccionada);
      });
    });
  });

  contenedor.querySelector(".guardar").addEventListener("click", async () => {
    if (puntuacionSeleccionada === 0) {
      mostrarFlash("Elige al menos una estrella.");
      return;
    }
    const texto = contenedor.querySelector("textarea").value.trim();
    await guardarResena(peli.id, persona, puntuacionSeleccionada, texto);
  });
}

function pintarEstrellasSoloLectura(puntuacion) {
  let html = `<div class="estrellas">`;
  for (let i = 1; i <= 5; i++) {
    html += `<span class="estrella ${i <= puntuacion ? "activa" : ""}" aria-hidden="true">★</span>`;
  }
  html += `</div>`;
  return html;
}

async function guardarResena(idPeli, persona, puntuacion, texto) {
  try {
    await updateDoc(doc(db, "peliculas", idPeli), {
      [`resenas.${persona}`]: {
        puntuacion,
        texto,
        fecha: new Date().toISOString(),
      },
    });
    mostrarFlash("Reseña guardada.");
  } catch (error) {
    console.error(error);
    mostrarFlash("No se pudo guardar la reseña.");
  }
}

btnQuitarPelicula.addEventListener("click", async () => {
  if (!idPeliculaAbierta) return;
  const confirmar = confirm("¿Quitar esta peli del diario? Se perderán las dos reseñas.");
  if (!confirmar) return;

  try {
    await deleteDoc(doc(db, "peliculas", idPeliculaAbierta));
    cerrarDetalle();
    mostrarFlash("Peli eliminada del diario.");
  } catch (error) {
    console.error(error);
    mostrarFlash("No se pudo eliminar la peli.");
  }
});

// ---------- Utilidades ----------
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

let temporizadorFlash;
function mostrarFlash(texto) {
  mensajeFlash.textContent = texto;
  mensajeFlash.classList.remove("oculto");
  clearTimeout(temporizadorFlash);
  temporizadorFlash = setTimeout(() => mensajeFlash.classList.add("oculto"), 3200);
}
