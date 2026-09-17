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
let pestanaActual = "vista"; // "vista" | "por_ver"
let cargandoInicial = true;
let tokenBusqueda = 0;
let temporizadorBusqueda;

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

const cargandoPelis = document.getElementById("cargando-pelis");
const rejillaPelis = document.getElementById("rejilla-pelis");
const contadorPelis = document.getElementById("contador-pelis");
const tituloLista = document.getElementById("titulo-lista");
const estadoVacio = document.getElementById("estado-vacio");

const panelDetalle = document.getElementById("panel-detalle");
const fondoDetalle = document.getElementById("fondo-detalle");
const btnCerrarDetalle = document.getElementById("btn-cerrar-detalle");
const btnQuitarPelicula = document.getElementById("btn-quitar-pelicula");
const bloqueResenas = document.getElementById("bloque-resenas");

const panelEstadisticas = document.getElementById("panel-estadisticas");
const fondoEstadisticas = document.getElementById("fondo-estadisticas");
const btnVerEstadisticas = document.getElementById("btn-ver-estadisticas");
const btnCerrarEstadisticas = document.getElementById("btn-cerrar-estadisticas");
const contenidoEstadisticas = document.getElementById("contenido-estadisticas");

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

// ---------- Pestañas: Ya vistas / Por ver ----------
document.querySelectorAll(".pestana").forEach((boton) => {
  boton.addEventListener("click", () => activarPestana(boton.dataset.pestana));
});

function activarPestana(nombre) {
  pestanaActual = nombre;
  document.querySelectorAll(".pestana").forEach((b) => {
    b.classList.toggle("activa", b.dataset.pestana === nombre);
  });
  pintarRejilla();
}

// ---------- Sincronización en tiempo real con Firestore ----------
function suscribirseAPeliculas() {
  onSnapshot(
    coleccionPelis,
    (instantanea) => {
      peliculas = instantanea.docs.map((d) => ({ id: d.id, ...d.data() }));
      cargandoInicial = false;
      cargandoPelis.classList.add("oculto");
      pintarRejilla();
      if (idPeliculaAbierta) pintarDetalle(idPeliculaAbierta);
      if (!panelEstadisticas.classList.contains("oculto")) pintarEstadisticas();
    },
    (error) => {
      console.error(error);
      cargandoPelis.classList.add("oculto");
      mostrarFlash("No se pudo conectar con Firebase. Revisa js/config.js");
    }
  );
}

// ---------- Búsqueda (con debounce) ----------
inputBuscar.addEventListener("input", () => {
  clearTimeout(temporizadorBusqueda);
  const consulta = inputBuscar.value.trim();
  if (consulta.length < 2) {
    panelResultados.classList.add("oculto");
    return;
  }
  temporizadorBusqueda = setTimeout(() => ejecutarBusqueda(consulta), 450);
});

formBuscar.addEventListener("submit", (evento) => {
  evento.preventDefault();
  clearTimeout(temporizadorBusqueda);
  const consulta = inputBuscar.value.trim();
  if (!consulta) return;
  ejecutarBusqueda(consulta);
});

btnCerrarResultados.addEventListener("click", () => {
  panelResultados.classList.add("oculto");
});

async function ejecutarBusqueda(consulta) {
  const miToken = ++tokenBusqueda;
  mostrarCargandoResultados();

  try {
    const resultados = await buscarEnTMDb(consulta);
    if (miToken !== tokenBusqueda) return; // llegó tarde, ya hay una búsqueda más nueva
    pintarResultados(resultados);
  } catch (error) {
    if (miToken !== tokenBusqueda) return;
    console.error(error);
    panelResultados.classList.add("oculto");
    mostrarFlash("No se pudo buscar. Revisa tu clave de TMDb en js/config.js");
  }
}

function mostrarCargandoResultados() {
  panelResultados.classList.remove("oculto");
  listaResultados.innerHTML = `<div class="estado-cargando resultado-cargando"><span class="spinner" aria-hidden="true"></span> Buscando…</div>`;
}

function pintarResultados(resultados) {
  listaResultados.innerHTML = "";

  if (resultados.length === 0) {
    listaResultados.innerHTML = `<p class="estado-vacio">No se encontró ninguna peli con ese nombre.</p>`;
    return;
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
    estado: "por_ver",
    fechaVista: null,
    resenas: { dani: null, aaron: null },
  };

  try {
    await setDoc(doc(db, "peliculas", idDoc), datos);
    panelResultados.classList.add("oculto");
    inputBuscar.value = "";
    activarPestana("por_ver");
    mostrarFlash(`"${resultado.title}" se añadió a Por ver.`);
  } catch (error) {
    console.error(error);
    mostrarFlash("No se pudo guardar la peli.");
  }
}

// ---------- Rejilla principal ----------
function pintarRejilla() {
  if (cargandoInicial) return;

  const filtradas = peliculas
    .filter((p) => (p.estado || "por_ver") === pestanaActual)
    .sort((a, b) => {
      if (pestanaActual === "vista") {
        return (b.fechaVista || "").localeCompare(a.fechaVista || "");
      }
      const fa = a.fechaAgregada?.toMillis?.() ?? 0;
      const fb = b.fechaAgregada?.toMillis?.() ?? 0;
      return fb - fa;
    });

  tituloLista.textContent = pestanaActual === "vista" ? "Vistas juntos" : "Por ver";
  contadorPelis.textContent = filtradas.length
    ? `${filtradas.length} ${filtradas.length === 1 ? "peli" : "pelis"}`
    : "";

  rejillaPelis.innerHTML = "";

  if (filtradas.length === 0) {
    estadoVacio.textContent =
      pestanaActual === "vista"
        ? "Todavía no han marcado ninguna peli como vista."
        : "No tienen pelis pendientes. ¡Busquen una arriba!";
    estadoVacio.classList.remove("oculto");
    rejillaPelis.classList.add("oculto");
    return;
  }

  estadoVacio.classList.add("oculto");
  rejillaPelis.classList.remove("oculto");

  filtradas.forEach((peli) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-pelicula";

    tarjeta.innerHTML = peli.poster_path
      ? `<img src="${TMDB_IMG}${peli.poster_path}" alt="Póster de ${peli.titulo}" />`
      : `<div class="sin-poster">🎬</div>`;

    if (pestanaActual === "vista") {
      const puntuaciones = ["dani", "aaron"]
        .map((persona) => peli.resenas?.[persona]?.puntuacion)
        .filter(Boolean);

      if (puntuaciones.length) {
        const promedio = puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length;
        tarjeta.innerHTML += `<span class="insignia-promedio">★ ${formatearNumero(promedio)}</span>`;
      }

      const puntos = ["dani", "aaron"]
        .filter((persona) => peli.resenas?.[persona])
        .map((persona) => `<span class="punto-resena" style="background: var(--color-${persona})"></span>`)
        .join("");
      tarjeta.innerHTML += `<div class="puntos-resena">${puntos}</div>`;
    } else {
      tarjeta.innerHTML += `<span class="insignia-porver">Agregada por ${NOMBRES[peli.agregadaPor] || "?"}</span>`;
    }

    tarjeta.innerHTML += `
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

  pintarEstadoVisto(peli);
  pintarTarjetaResena("dani", peli);
  pintarTarjetaResena("aaron", peli);
}

function pintarEstadoVisto(peli) {
  const contenedor = document.getElementById("detalle-estado-visto");
  const hoy = new Date().toISOString().slice(0, 10);

  if ((peli.estado || "por_ver") !== "vista") {
    bloqueResenas.classList.add("oculto");
    contenedor.innerHTML = `
      <p>Todavía no marcaron esta peli como vista.</p>
      <div class="fila-marcar">
        <input type="date" id="input-fecha-vista" value="${hoy}" max="${hoy}" />
        <button type="button" class="marcar-vista">Marcar como vista</button>
      </div>
    `;
    contenedor.querySelector(".marcar-vista").addEventListener("click", () => {
      const fecha = document.getElementById("input-fecha-vista").value;
      if (!fecha) {
        mostrarFlash("Elige una fecha.");
        return;
      }
      marcarComoVista(peli.id, fecha);
    });
    return;
  }

  bloqueResenas.classList.remove("oculto");
  contenedor.innerHTML = `
    <span class="fecha-vista-texto">Vista el ${formatearFecha(peli.fechaVista)}</span>
    <button type="button" id="btn-editar-fecha-vista" class="enlace-sutil" style="margin-left:0.6rem">Editar fecha</button>
  `;

  contenedor.querySelector("#btn-editar-fecha-vista").addEventListener("click", () => {
    contenedor.innerHTML = `
      <div class="fila-marcar">
        <input type="date" id="input-fecha-vista" value="${peli.fechaVista}" max="${hoy}" />
        <button type="button" class="marcar-vista">Guardar fecha</button>
      </div>
    `;
    contenedor.querySelector(".marcar-vista").addEventListener("click", () => {
      const fecha = document.getElementById("input-fecha-vista").value;
      if (!fecha) {
        mostrarFlash("Elige una fecha.");
        return;
      }
      marcarComoVista(peli.id, fecha);
    });
  });
}

async function marcarComoVista(idPeli, fecha) {
  try {
    await updateDoc(doc(db, "peliculas", idPeli), { estado: "vista", fechaVista: fecha });
    mostrarFlash("Marcada como vista.");
  } catch (error) {
    console.error(error);
    mostrarFlash("No se pudo actualizar la fecha.");
  }
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

// ---------- Estadísticas ----------
btnVerEstadisticas.addEventListener("click", () => {
  pintarEstadisticas();
  panelEstadisticas.classList.remove("oculto");
});
btnCerrarEstadisticas.addEventListener("click", () => panelEstadisticas.classList.add("oculto"));
fondoEstadisticas.addEventListener("click", () => panelEstadisticas.classList.add("oculto"));

function calcularEstadisticas() {
  const vistas = peliculas.filter((p) => (p.estado || "por_ver") === "vista");
  const porVer = peliculas.filter((p) => (p.estado || "por_ver") === "por_ver");

  const promedioDe = (persona) => {
    const puntuaciones = vistas
      .map((p) => p.resenas?.[persona]?.puntuacion)
      .filter(Boolean);
    if (!puntuaciones.length) return null;
    return puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length;
  };

  let mejor = null;
  let masDebatida = null;
  let mayorDiferencia = -1;

  vistas.forEach((p) => {
    const d = p.resenas?.dani?.puntuacion;
    const a = p.resenas?.aaron?.puntuacion;
    if (d && a) {
      const promedio = (d + a) / 2;
      if (!mejor || promedio > mejor.promedio) mejor = { titulo: p.titulo, promedio };
      const diferencia = Math.abs(d - a);
      if (diferencia > mayorDiferencia) {
        mayorDiferencia = diferencia;
        masDebatida = { titulo: p.titulo, diferencia };
      }
    }
  });

  const conFecha = vistas.filter((p) => p.fechaVista).sort((a, b) => a.fechaVista.localeCompare(b.fechaVista));
  const primera = conFecha[0] || null;
  const ultima = conFecha.length > 1 ? conFecha[conFecha.length - 1] : null;

  return {
    totalVistas: vistas.length,
    totalPorVer: porVer.length,
    promedioDani: promedioDe("dani"),
    promedioAaron: promedioDe("aaron"),
    mejor,
    masDebatida: mayorDiferencia > 0 ? masDebatida : null,
    primera,
    ultima,
    agregadasDani: peliculas.filter((p) => p.agregadaPor === "dani").length,
    agregadasAaron: peliculas.filter((p) => p.agregadaPor === "aaron").length,
  };
}

function pintarEstadisticas() {
  const s = calcularEstadisticas();

  if (s.totalVistas === 0) {
    contenidoEstadisticas.innerHTML = `<p class="estado-vacio">Todavía no hay suficientes pelis vistas. ¡Marquen alguna como vista para ver sus números acá!</p>`;
    return;
  }

  let html = `
    <div class="grupo-stat">
      <div class="tarjeta-stat">
        <span class="valor-stat">${s.totalVistas}</span>
        <span class="etiqueta-stat">vistas juntos</span>
      </div>
      <div class="tarjeta-stat">
        <span class="valor-stat">${s.totalPorVer}</span>
        <span class="etiqueta-stat">pendientes</span>
      </div>
      <div class="tarjeta-stat">
        <span class="valor-stat" style="color: var(--color-dani)">${s.promedioDani ? formatearNumero(s.promedioDani) : "—"}</span>
        <span class="etiqueta-stat">promedio de Dani</span>
      </div>
      <div class="tarjeta-stat">
        <span class="valor-stat" style="color: var(--color-aaron)">${s.promedioAaron ? formatearNumero(s.promedioAaron) : "—"}</span>
        <span class="etiqueta-stat">promedio de Aarón</span>
      </div>
    </div>
  `;

  if (s.mejor) {
    html += `<div class="destacado-stat"><strong>🏆 La mejor puntuada</strong>${s.mejor.titulo}, con ${formatearNumero(s.mejor.promedio)} ★ de promedio entre los dos.</div>`;
  }
  if (s.masDebatida) {
    html += `<div class="destacado-stat"><strong>🔥 La más discutida</strong>${s.masDebatida.titulo}: se llevaron ${s.masDebatida.diferencia} ${s.masDebatida.diferencia === 1 ? "estrella" : "estrellas"} de diferencia.</div>`;
  }
  if (s.primera) {
    html += `<div class="destacado-stat"><strong>🎬 La primera que vieron</strong>${s.primera.titulo}, el ${formatearFecha(s.primera.fechaVista)}.</div>`;
  }
  if (s.ultima) {
    html += `<div class="destacado-stat"><strong>🍿 La más reciente</strong>${s.ultima.titulo}, el ${formatearFecha(s.ultima.fechaVista)}.</div>`;
  }
  html += `<div class="destacado-stat"><strong>➕ Quién agrega más</strong>Dani agregó ${s.agregadasDani}, Aarón agregó ${s.agregadasAaron}.</div>`;

  contenidoEstadisticas.innerHTML = html;
}

// ---------- Utilidades ----------
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function formatearNumero(numero) {
  return numero.toFixed(1).replace(/\.0$/, "");
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

let temporizadorFlash;
function mostrarFlash(texto) {
  mensajeFlash.textContent = texto;
  mensajeFlash.classList.remove("oculto");
  clearTimeout(temporizadorFlash);
  temporizadorFlash = setTimeout(() => mensajeFlash.classList.add("oculto"), 3200);
}
