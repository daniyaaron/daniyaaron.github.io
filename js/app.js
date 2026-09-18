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
let pestanaActual = "vista"; // "vista" | "por_ver" | "linea"
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
const lineaTiempoEl = document.getElementById("linea-tiempo");
const contadorPelis = document.getElementById("contador-pelis");
const tituloLista = document.getElementById("titulo-lista");
const estadoVacio = document.getElementById("estado-vacio");
const btnSorprendeme = document.getElementById("btn-sorprendeme");

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

// ---------- Pestañas: Ya vistas / Por ver / Línea de tiempo ----------
document.querySelectorAll(".pestana").forEach((boton) => {
  boton.addEventListener("click", () => activarPestana(boton.dataset.pestana));
});

function activarPestana(nombre) {
  pestanaActual = nombre;
  document.querySelectorAll(".pestana").forEach((b) => {
    b.classList.toggle("activa", b.dataset.pestana === nombre);
  });
  pintarContenidoPrincipal();
}

// ---------- Sincronización en tiempo real con Firestore ----------
function suscribirseAPeliculas() {
  onSnapshot(
    coleccionPelis,
    (instantanea) => {
      peliculas = instantanea.docs.map((d) => ({ id: d.id, ...d.data() }));
      cargandoInicial = false;
      cargandoPelis.classList.add("oculto");
      pintarContenidoPrincipal();
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

// ---------- Sorpréndeme ----------
btnSorprendeme.addEventListener("click", () => {
  const porVer = peliculas.filter((p) => (p.estado || "por_ver") === "por_ver");
  if (!porVer.length) {
    mostrarFlash("No tienen pelis pendientes para sortear.");
    return;
  }
  const elegida = porVer[Math.floor(Math.random() * porVer.length)];
  abrirDetalle(elegida.id);
  mostrarFlash(`🎲 Les tocó "${elegida.titulo}"`);
});

// ---------- Contenido principal (rejilla o línea de tiempo) ----------
function pintarContenidoPrincipal() {
  if (cargandoInicial) return;

  btnSorprendeme.classList.toggle("oculto", pestanaActual !== "por_ver");

  if (pestanaActual === "linea") {
    tituloLista.textContent = "Línea de tiempo";
    rejillaPelis.classList.add("oculto");
    estadoVacio.classList.add("oculto");
    lineaTiempoEl.classList.remove("oculto");

    const vistas = peliculas
      .filter((p) => (p.estado || "por_ver") === "vista" && p.fechaVista)
      .sort((a, b) => a.fechaVista.localeCompare(b.fechaVista));

    contadorPelis.textContent = vistas.length
      ? `${vistas.length} ${vistas.length === 1 ? "peli" : "pelis"}`
      : "";

    pintarLineaTiempo(vistas);
    return;
  }

  lineaTiempoEl.classList.add("oculto");
  pintarRejilla();
}

function pintarRejilla() {
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
    }

    tarjeta.innerHTML += `
      <div class="titulo-tarjeta">${peli.titulo}</div>
      <div class="anio-tarjeta">${peli.anio || ""}</div>
    `;

    tarjeta.addEventListener("click", () => abrirDetalle(peli.id));
    rejillaPelis.appendChild(tarjeta);
  });
}

// ---------- Línea de tiempo interactiva ----------
lineaTiempoEl.addEventListener(
  "wheel",
  (evento) => {
    const pista = lineaTiempoEl.querySelector(".linea-tiempo-pista");
    if (!pista) return;
    if (Math.abs(evento.deltaY) > Math.abs(evento.deltaX)) {
      pista.scrollLeft += evento.deltaY;
      evento.preventDefault();
    }
  },
  { passive: false }
);

function diasEntre(fechaIsoA, fechaIsoB) {
  const [ay, am, ad] = fechaIsoA.split("-").map(Number);
  const [by, bm, bd] = fechaIsoB.split("-").map(Number);
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatearGapTiempo(dias) {
  if (dias < 7) return `${dias} ${dias === 1 ? "día" : "días"} después`;
  if (dias < 30) {
    const semanas = Math.max(1, Math.round(dias / 7));
    return `${semanas} ${semanas === 1 ? "semana" : "semanas"} después`;
  }
  if (dias < 365) {
    const meses = Math.max(1, Math.round(dias / 30));
    return `${meses} ${meses === 1 ? "mes" : "meses"} después`;
  }
  const anios = Math.max(1, Math.round(dias / 365));
  return `${anios} ${anios === 1 ? "año" : "años"} después`;
}

function anchoSegmento(dias) {
  // Escala logarítmica con techo: crece con el tiempo real transcurrido,
  // pero un salto de años no estira el eje sin límite ni aplasta el resto.
  return Math.round(Math.min(240, 28 + 30 * Math.log2(dias + 1)));
}

function pintarLineaTiempo(vistas) {
  if (vistas.length === 0) {
    lineaTiempoEl.innerHTML = `<p class="estado-vacio">Todavía no hay pelis vistas con fecha para armar la línea de tiempo.</p>`;
    return;
  }

  const pista = document.createElement("div");
  pista.className = "linea-tiempo-pista";

  vistas.forEach((peli, indice) => {
    if (indice > 0) {
      const dias = diasEntre(vistas[indice - 1].fechaVista, peli.fechaVista);
      const segmento = document.createElement("div");
      segmento.className = "segmento-tiempo";
      segmento.style.width = `${anchoSegmento(dias)}px`;
      segmento.innerHTML = `
        <div class="segmento-espaciador"></div>
        <div class="segmento-linea"></div>
        ${dias >= 2 ? `<span class="segmento-etiqueta">${formatearGapTiempo(dias)}</span>` : ""}
      `;
      pista.appendChild(segmento);
    }
    const hito = document.createElement("button");
    hito.type = "button";
    hito.className = "hito-tiempo";
    hito.dataset.id = peli.id;
    hito.innerHTML = `
      ${peli.poster_path ? `<img src="${TMDB_IMG}${peli.poster_path}" alt="Póster de ${peli.titulo}" />` : `<div class="sin-poster">🎬</div>`}
      <div class="hito-eje"></div>
      <span class="hito-fecha">${formatearFechaCorta(peli.fechaVista)}</span>
    `;
    hito.title = peli.titulo;
    hito.addEventListener("click", () => abrirDetalle(peli.id));
    pista.appendChild(hito);
  });

  lineaTiempoEl.innerHTML = "";
  lineaTiempoEl.appendChild(pista);

  // arranca mostrando lo más reciente (a la derecha)
  requestAnimationFrame(() => {
    pista.scrollLeft = pista.scrollWidth;
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

function obtenerMesISO(fechaISO) {
  return fechaISO.slice(0, 7); // "YYYY-MM"
}

function formatoMes(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function esMesSiguiente(mesA, mesB) {
  const [anio, mes] = mesA.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, 1);
  fecha.setMonth(fecha.getMonth() + 1);
  return formatoMes(fecha) === mesB;
}

function calcularRacha(vistas) {
  const meses = new Set(vistas.filter((p) => p.fechaVista).map((p) => obtenerMesISO(p.fechaVista)));
  if (meses.size === 0) return { actual: 0, record: 0, esteMes: 0 };

  const hoy = new Date();
  const cursor = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (!meses.has(formatoMes(cursor))) {
    cursor.setMonth(cursor.getMonth() - 1);
  }
  let actual = 0;
  while (meses.has(formatoMes(cursor))) {
    actual++;
    cursor.setMonth(cursor.getMonth() - 1);
  }

  const listaMeses = [...meses].sort();
  let record = 0;
  let rachaTemp = 0;
  let mesAnterior = null;
  listaMeses.forEach((mes) => {
    rachaTemp = mesAnterior && esMesSiguiente(mesAnterior, mes) ? rachaTemp + 1 : 1;
    record = Math.max(record, rachaTemp);
    mesAnterior = mes;
  });

  const esteMes = vistas.filter((p) => p.fechaVista && obtenerMesISO(p.fechaVista) === formatoMes(hoy)).length;

  return { actual, record, esteMes };
}

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
    racha: calcularRacha(vistas),
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

    <div class="grupo-stat">
      <div class="tarjeta-stat">
        <span class="valor-stat">${s.racha.esteMes}</span>
        <span class="etiqueta-stat">vistas este mes</span>
      </div>
      <div class="tarjeta-stat">
        <span class="valor-stat">${s.racha.actual}</span>
        <span class="etiqueta-stat">${s.racha.actual === 1 ? "mes seguido" : "meses seguidos"}</span>
      </div>
      <div class="tarjeta-stat">
        <span class="valor-stat">${s.racha.record}</span>
        <span class="etiqueta-stat">récord de racha</span>
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

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

let temporizadorFlash;
function mostrarFlash(texto) {
  mensajeFlash.textContent = texto;
  mensajeFlash.classList.remove("oculto");
  clearTimeout(temporizadorFlash);
  temporizadorFlash = setTimeout(() => mensajeFlash.classList.add("oculto"), 3200);
}
