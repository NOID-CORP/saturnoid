// Página de Saturnoid: contadores en vivo, buscador, vuelo al asiento, pase de abordar y plan B sin 3D.
import { resumen, buscarPasajero, tripulacion, ocupantesCerca, asientosOcupados } from './datos.js';
import { CLASES, ORDEN_CLASES, NIVELES, nivelDe, normalizarUsuario, USUARIO_VALIDO, vecinos, leerAsiento, codigoAsiento } from './asientos.js';
import { crearPase, aBlob, fechaCorta } from './pase.js';
import { PERFIL_IG } from './config.js';
import { crearMirada } from './mirada.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const MODO_FOTO = params.has('foto'); // para generar la imagen de portada (sin interfaz)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('es-CO');

let R = null;           // último resumen de Supabase
let mundo = null;       // escena 3D (null = plan B)
let modulos = null;     // camara.js
let modo = 'portada';   // portada | volando | asiento
let vuelo = null, tVuelo0 = 0, tLlegada = 0;
let nivelVis = 0, nivelObj = 0;
let actual = null;      // pasajero en pantalla
let mirada = null;      // dedo + celular + flechas desde el asiento (js/mirada.js)
let tercera = 0, terceraObj = 0; // 0 = desde tus ojos, 1 = verte sentado (la cámara pasa de una a otra suave)
const reducirMov = matchMedia('(prefers-reduced-motion: reduce)');
const DUR_VUELO = 5.6;

// ---------- datos ----------
async function cargarResumen() {
  try {
    R = await resumen();
    pintarResumen();
  } catch (e) {
    if (!R) { $('#estado-texto').textContent = 'No pudimos conectar con la nave. Recarga la página.'; }
  }
}

function lineaMeta(p, metas) {
  const n = nivelDe(p, metas);
  if (n >= metas.length) return 'La nave está llena y lista para despegar';
  const falta = metas[n] - p;
  const que = ['encender el motor 1', 'encender el motor 2', 'el despegue'][n];
  return `Faltan ${num(falta)} para ${que}`;
}

function pintarResumen() {
  const e = R.estado; const p = R.pasajeros; const metas = e.metas;
  const n = nivelDe(p, metas);
  nivelObj = n;
  document.body.dataset.nivel = n;
  $('#estado-texto').textContent = n === 0 ? 'Esperando pasajeros' : n === 3 ? 'Lista para despegar' : NIVELES[n].nombre;
  $('#pasajeros').textContent = num(p);
  $('#meta').textContent = n < metas.length ? `/ ${num(metas[n])}` : '';
  // tres tramos iguales (uno por nivel); dentro de cada tramo, el avance real hacia su meta
  const previo = metas[n - 1] || 0, siguiente = metas[n];
  const avance = n >= metas.length ? metas.length : n + (p - previo) / (siguiente - previo);
  $('#progreso .relleno').style.transform = `scaleX(${Math.min(1, avance / metas.length)})`;
  $('#progreso').setAttribute('aria-label', lineaMeta(p, metas));
  document.querySelectorAll('#progreso li').forEach((li, i) => {
    li.style.left = `${((i + 1) / metas.length) * 100}%`;
    li.classList.toggle('hecho', p >= metas[i]);
    li.querySelector('span').innerHTML = `${['Motor 1', 'Motor 2', 'Despegue'][i]}<b>${num(metas[i])}</b>`;
  });
  const ep = Math.max(1, e.episodio_actual);
  $('#ep').textContent = `EP. ${ep} · DÍA ${Math.max(1, e.dia_actual ?? ep)}`;
  $('#tripulantes').textContent = `Tripulación ${num(R.tripulacion)}/9${R.tripulacion >= 9 ? ' ✓' : ''}`; // ≠ pasajeros
  const reel = e.reel_url || PERFIL_IG;
  for (const a of [$('#reel'), $('#sa-reel')]) a.href = reel;
  $('#reel').textContent = e.reel_url ? 'Ver el último episodio ↗' : 'Ver la serie en Instagram ↗';

  const cupos = cuposDe(e);
  const quedan = {};
  let desde = 1;
  for (const c of CLASES_PASAJEROS) {
    quedan[c] = Math.max(0, cupos[c] - (R[c] || 0));
    const el = document.querySelector(`.cupo[data-clase="${c}"]`);
    el.textContent = quedan[c] ? `Quedan ${num(quedan[c])} de ${num(cupos[c])}` : 'Llena';
    el.classList.toggle('llena', !quedan[c]);
    // "Comentarios nº 1 al 100": la clase va por el orden del comentario (como lo dice el video)
    document.querySelector(`.orden[data-clase="${c}"]`).textContent = `Comentarios nº ${num(desde)} al ${num(desde + cupos[c] - 1)}`;
    desde += cupos[c];
  }
  $('#cupos-rapido').innerHTML = textoCupos(quedan);
  $('#sa-cupos').innerHTML = textoCupos(quedan);

  const av = $('#aviso-prueba');
  av.hidden = !R.prueba; av.querySelector('span').textContent = num(R.prueba);

  const asc = R.ultimos_ascensos || [];
  $('#ascensos').hidden = !asc.length;
  if (asc.length) {
    $('#ascensos .etq span').textContent = asc[0].episodio;
    $('#ascensos ul').innerHTML = asc.map((a) => `<li class="tag oro">@${esc(a.usuario)}</li>`).join('');
  }
}

// Las clases de pasajeros en el orden en que se llenan (la cabina es fija).
const CLASES_PASAJEROS = ORDEN_CLASES.filter((c) => c !== 'cabina');

// Cupos de la base. Mientras la base no tenga cupo_luna (antes de correr admin/sql/clase-luna.sql),
// Turista se parte como lo dice el video: 200 para Clase Luna y el resto para Turista.
function cuposDe(e) {
  const luna = e.cupo_luna ?? 200;
  return { anillo: e.cupo_anillo, orbita: e.cupo_orbita, luna, turista: e.cupo_luna == null ? e.cupo_turista - luna : e.cupo_turista };
}

function textoCupos(q) {
  if (q.anillo) return `Quedan <b>${q.anillo}</b> asientos en Clase Anillo${q.orbita ? ` y ${q.orbita} en Órbita` : ''}.`;
  if (q.orbita) return `Clase Anillo está llena. Quedan <b>${q.orbita}</b> en Órbita.`;
  if (q.luna) return `Anillo y Órbita están llenas. Quedan <b>${q.luna}</b> en Clase Luna.`;
  if (q.turista) return `Anillo, Órbita y Luna están llenas. Quedan <b>${num(q.turista)}</b> en Turista (y cada episodio 3 suben a Anillo).`;
  return 'La nave está llena: 1.000 pasajeros a bordo.';
}

async function cargarTripulacion(pedido = tripulacion()) {
  try {
    const t = await pedido;
    const inv = R?.estado?.investigadora || 'La investigadora';
    $('#tripulacion').innerHTML = `<li class="tag inv"><small>INVESTIGADORA</small>${esc(inv)}</li>` +
      t.map((x) => `<li class="tag">@${esc(x.usuario)}</li>`).join('');
  } catch { /* la sección queda vacía */ }
}

// ---------- 3D ----------
function soportaWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function elegirCalidad() {
  if (params.get('calidad')) return params.get('calidad');
  const movil = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const mem = navigator.deviceMemory || 4, nucleos = navigator.hardwareConcurrency || 4;
  if (movil && (mem <= 3 || nucleos <= 4)) return 'baja';
  if (movil) return 'media';
  return 'alta';
}

async function iniciar3D() {
  if (!soportaWebGL()) return planB();
  try {
    // fuentes (para los nametags) y escena a la vez, no una después de la otra
    const [{ crearMundo }, camara] = await Promise.all([import('../escena/mundo.js'), import('../escena/camara.js'),
      ...['800 40px Panchang', '500 40px "DM Mono"', '400 40px Switzer'].map((f) => document.fonts.load(f))]);
    modulos = camara;
    const lienzo = $('#lienzo');
    mundo = crearMundo({ canvas: lienzo, calidad: MODO_FOTO ? 'alta' : elegirCalidad() });
    ajustar();
    addEventListener('resize', ajustar);
    prepararMirada(lienzo);
    requestAnimationFrame(bucle);
  } catch (err) {
    console.error(err);
    planB();
  }
}

function planB() {
  mundo = null;
  document.body.classList.add('sin3d');
  document.body.classList.remove('cargando');
}

const desp = { x: 0, y: 0 };
function despObjetivo() {
  const ancho = innerWidth >= 900;
  if (modo === 'portada') return ancho ? { x: -0.34, y: -0.05 } : { x: 0, y: -0.42 };
  // con la tarjeta minimizada la escena baja: queda más a la vista
  return ancho ? { x: tarjetaMin ? -0.1 : -0.28, y: 0 } : { x: 0, y: tarjetaMin ? -0.05 : -0.18 };
}
function ajustar() {
  if (!mundo) return;
  mundo.redimensionar(innerWidth, innerHeight);
  if (modo === 'portada' && !desp.listo) { Object.assign(desp, despObjetivo()); desp.listo = true; }
}

let t0 = performance.now(), primerCuadro = true, lentos = 0, cuadros = 0, ultimo = performance.now();
function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (document.hidden || !mundo) return;
  const t = MODO_FOTO ? 14 : (ahora - t0) / 1000;
  const dt = (ahora - ultimo) / 1000;
  // ahorro: si la hoja tapa el 3D, cuadros a menos velocidad
  if (modo === 'portada' && scrollY > innerHeight * 1.1 && cuadros % 4) { cuadros++; return; }
  nivelVis += (nivelObj - nivelVis) * 0.012; // los motores se encienden por etapas, no de golpe
  if (MODO_FOTO) nivelVis = params.has('nivel') ? Number(params.get('nivel')) : nivelObj;
  const aspecto = innerWidth / innerHeight;
  let cam, sacudida = 0, adentro = 0;
  const obj = despObjetivo(); desp.x += (obj.x - desp.x) * 0.06; desp.y += (obj.y - desp.y) * 0.06;
  mundo.desplazamiento = desp;
  if (modo === 'portada') cam = modulos.camaraPortada(t, aspecto);
  else if (modo === 'volando') {
    const p = (ahora - tVuelo0) / 1000 / DUR_VUELO;
    cam = modulos.camaraVuelo(p, vuelo);
    cam.fov = lerpFov(p, aspecto);
    adentro = Math.min(1, Math.max(0, (p - 0.6) / 0.22));
    if (p >= 1) llegar(ahora);
  } else {
    const tl = (ahora - tLlegada) / 1000, pov = mundo.interior.pov;
    // la mirada (recorrido automático hasta que la persona tome el control, luego dedo + celular), suavizada
    const v = mirada.actualizar(dt, mirada.tomada ? undefined : modulos.recorridoPOV(tl, pov));
    cam = modulos.camaraPOV(tl, pov, { yaw: v.yaw, pitch: v.pitch, activo: true });
    // verse sentado: la cámara sale de la cabeza y gira alrededor (mismo dedo, mismo celular)
    tercera = reducirMov.matches ? terceraObj : tercera + (terceraObj - tercera) * (1 - Math.exp(-Math.min(dt, 0.1) / 0.2));
    if (Math.abs(terceraObj - tercera) < 0.002) tercera = terceraObj;
    if (tercera > 0) {
      const c3 = modulos.camaraTercera(tl, pov, v, pov.distTercera), k = tercera * tercera * (3 - 2 * tercera);
      cam.pos.lerp(c3.pos, k); cam.mira.lerp(c3.mira, k);
    }
    mundo.interior.verme?.(tercera);
    window.__mirada ??= () => ({ yaw: v.yaw, pitch: v.pitch }); // solo para pruebas/mirada.mjs
    cam.fov = aspecto < 0.85 ? 78 : 64;
    sacudida = mundo.interior.sacudida || 0;
    adentro = 1;
  }
  mundo.cuadro(t, { nivel: nivelVis, cam, sacudida, adentro });
  cuadros++;
  // si el teléfono no da, bajar calidad una vez
  ultimo = ahora;
  if (cuadros > 30 && cuadros < 400 && dt > 0.055) lentos++;
  if (lentos > 40 && !mundo.bajado) { mundo.bajado = true; mundo.renderer.setPixelRatio(1); ajustar(); }
  if (primerCuadro) {
    primerCuadro = false; document.body.classList.add('con3d'); document.body.classList.remove('cargando'); window.__saturnoidListo = true;
    // con la página quieta, dejar listos los interiores para que el primer vuelo no se congele
    const luego = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    if (!MODO_FOTO) setTimeout(() => luego(() => mundo.precalentar().catch(() => {})), 1500);
  }
}
const lerpFov = (p, a) => { const ini = a < 0.85 ? 58 : 42, fin = a < 0.85 ? 78 : 64; const k = Math.min(1, Math.max(0, (p - 0.55) / 0.45)); return ini + (fin - ini) * k; };

// Mirar alrededor desde el asiento: arrastrando (con inercia), moviendo el celular o con las flechas.
function prepararMirada(lienzo) {
  mirada = crearMirada({ elemento: lienzo, habilitada: () => modo === 'asiento', alMirar: pistaTrasMirar });
  mirada.usarConversor(modulos.miradaSensor);
  const boton = $('#a-sensor');
  mirada.alCambiarSensor((s) => {
    boton.hidden = !s.disponible || s.negado;
    boton.setAttribute('aria-pressed', String(s.activo));
    if (modo === 'asiento' && !mirada.tomada) $('#a-pista').textContent = textoPista();
    if (s.negado) mostrarPista('Sin permiso de movimiento: arrastra para mirar', 4500);
  });
  // en iPhone el permiso solo se puede pedir dentro del toque: alternarSensor se llama directo aquí
  boton.addEventListener('click', () => {
    mirada.alternarSensor().then((on) => { if (on) mostrarPista('Mueve el celular para mirar a los lados', 3500); });
  });
}

const tactil = matchMedia('(pointer: coarse)').matches;
function textoPista() {
  if (terceraObj) return tactil ? 'Arrastra para girar a tu alrededor' : 'Arrastra o usa las flechas para girar';
  if (mirada?.sensor.activo) return 'Mueve el celular o arrastra para mirar';
  return tactil ? 'Arrastra para mirar alrededor' : 'Arrastra o usa las flechas para mirar';
}
let pistaReloj = null;
function mostrarPista(texto, ms) {
  const p = $('#a-pista');
  clearTimeout(pistaReloj);
  p.textContent = texto; p.hidden = false; p.classList.remove('se-va');
  if (ms) pistaReloj = setTimeout(() => { p.classList.add('se-va'); }, ms);
}
// Cuando la persona ya miró por su cuenta, la pista enseña el doble toque (y luego se va).
function pistaTrasMirar(como) {
  if (como === 'centrar') { $('#a-pista').classList.add('se-va'); return; }
  mostrarPista(tactil ? 'Toca dos veces para volver al frente' : 'Doble clic para volver al frente', 3800);
}

// ---------- buscador ----------
// Se busca mientras la persona escribe: al tocar "Buscar", el asiento y los vecinos casi siempre ya llegaron.
const consultas = new Map();
function consultar(usuario) {
  if (!consultas.has(usuario)) {
    // el asiento, los vecinos (con nombre) y qué asientos de la clase están ocupados (para el piso completo), a la vez
    const pr = buscarPasajero(usuario).then(async (p) => {
      if (!p) return { p, ocupantes: null, ocupados: null };
      const [ocupantes, ocupados] = await Promise.all([ocupantesCerca(p.asiento).catch(() => new Map()),
        p.clase === 'cabina' ? null : asientosOcupados(p.clase).catch(() => null)]);
      return { p, ocupantes, ocupados };
    });
    pr.catch(() => consultas.delete(usuario));
    consultas.set(usuario, pr);
    setTimeout(() => consultas.delete(usuario), 60000); // no guardar respuestas viejas
  }
  return consultas.get(usuario);
}
let espera = null;
$('#usuario').addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(() => { const u = normalizarUsuario($('#usuario').value); if (USUARIO_VALIDO.test(u) && u.length >= 3) consultar(u).catch(() => {}); }, 350);
});

// Aviso que sale apenas se toca "Buscar" (para que quede claro que ya te lleva).
function aviso(linea1, linea2 = '', listo = false) {
  const a = $('#abordando');
  a.querySelector('.a1').textContent = linea1; a.querySelector('.a2').textContent = linea2;
  a.classList.toggle('listo', listo); a.hidden = false;
}
const quitarAviso = (ms = 0) => setTimeout(() => { $('#abordando').hidden = true; }, ms);

async function buscar(texto) {
  const usuario = normalizarUsuario(texto);
  const err = $('#error');
  err.hidden = true;
  if (!USUARIO_VALIDO.test(usuario)) { err.textContent = 'Escribe tu usuario de Instagram (letras, números, punto o guion bajo).'; err.hidden = false; return; }
  const boton = $('#buscador button'); boton.disabled = true; boton.textContent = 'Buscando…';
  $('#usuario').blur();
  aviso(`Buscando @${usuario}…`);
  try {
    const { p, ocupantes, ocupados } = await consultar(usuario);
    if (!p) { quitarAviso(); return sinAsiento(usuario); }
    history.replaceState(null, '', `?u=${encodeURIComponent(usuario)}`);
    aviso(`Asiento ${p.asiento} · ${CLASES[p.clase].nombre}`, mundo ? 'Despegando hacia tu asiento' : '', true);
    abordar(p, ocupantes, ocupados);
    quitarAviso(mundo ? 1800 : 600);
  } catch {
    quitarAviso();
    err.textContent = 'No pudimos buscar ahora. Revisa tu conexión y vuelve a intentar.'; err.hidden = false;
  } finally { boton.disabled = false; boton.textContent = 'Buscar'; }
}

function sinAsiento(usuario) {
  $('#sa-titulo').textContent = `@${usuario} todavía no tiene asiento`;
  $('#sin-asiento').hidden = false;
  $('#sa-reel').focus();
}

function abordar(p, ocupantes, ocupados) {
  actual = p;
  pintarTarjeta(p, ocupantes);
  $('#usuario').blur();
  if (!mundo) { mostrarAsiento(); return; }
  const info = {
    pasajeros: R?.pasajeros ?? 0, investigadora: R?.estado?.investigadora, nivel: nivelObj,
    nivelNombre: NIVELES[nivelObj].nombre, lineaMeta: R ? lineaMeta(R.pasajeros, R.estado.metas) : '',
  };
  // sin la lista de ocupados (falló la consulta), solo se ven los vecinos conocidos
  const interior = mundo.prepararAsiento(p.clase, { asiento: p.asiento, usuario: p.usuario, ocupantes, info,
    ocupados: ocupados || new Set([...ocupantes.keys(), p.asiento]) });
  const desde = { pos: mundo.camara.position.clone(), mira: mundo.camara.position.clone().add(mundo.camara.getWorldDirection(mundo.camara.position.clone()).multiplyScalar(40)) };
  vuelo = modulos.armarVuelo(desde, interior);
  mirada.reiniciar(modulos.limitesPOV(interior.pov));
  ponerVerme(false, true);
  scrollTo({ top: 0, behavior: 'instant' });
  modo = 'volando'; tVuelo0 = performance.now();
  document.body.classList.add('volando');
  ajustar();
}

function llegar(ahora) {
  modo = 'asiento'; tLlegada = ahora;
  document.body.classList.remove('volando');
  mostrarAsiento();
}

function mostrarAsiento() {
  document.body.classList.add('en-asiento');
  const panel = $('#asiento'); panel.hidden = false; panel.dataset.clase = actual.clase;
  clearTimeout(pistaReloj);
  const p = $('#a-pista'); p.hidden = !mundo; p.classList.remove('se-va');
  if (mundo) p.textContent = textoPista();
  $('#a-verme').hidden = !mundo;
}

function pintarTarjeta(p, ocupantes) {
  const c = CLASES[p.clase];
  $('#a-clase').textContent = p.es_tripulacion ? 'Cabina de mando · Tripulación fundadora' : c.nombre;
  $('#a-clase').dataset.asiento = p.asiento;
  $('#a-usuario').textContent = `@${p.usuario}`;
  $('#a-asiento').textContent = p.asiento;
  $('#a-num-etq').textContent = p.es_tripulacion ? 'Tripulante' : 'Pasajero';
  $('#a-numero').textContent = p.es_tripulacion ? p.asiento.replace('C-', '') : `Nº ${String(p.numero ?? '—').padStart(4, '0')}`;
  $('#a-fecha').textContent = p.es_tripulacion ? 'Fundador' : fechaCorta(p.comentado_en);
  // vecinos de al lado (no toda la zona)
  const lado = vecinos(p.asiento, 0).map((cod) => ocupantes.get(cod)?.usuario).filter(Boolean);
  const inv = R?.estado?.investigadora;
  if (p.clase === 'cabina') $('#a-vecinos').innerHTML = `En la cabina con <b>${esc(inv || 'la investigadora')}</b> y la tripulación.`;
  else $('#a-vecinos').innerHTML = lado.length ? `A tu lado: ${lado.slice(0, 4).map((u) => `<b>@${esc(u)}</b>`).join(', ')}` : 'Los asientos de al lado todavía están libres.';
  const extra = $('#a-extra');
  extra.hidden = true;
  if (p.ascendido_en) { extra.textContent = `Subiste de Turista a Clase Anillo en el episodio ${p.ascendido_en}.`; extra.hidden = false; }
  else if (p.clase === 'turista') { extra.textContent = 'Cada episodio, 3 pasajeros de Turista suben a Clase Anillo. Sigue la serie.'; extra.hidden = false; }
  // plan B: mapa 2D de la zona
  const mapa = $('#a-mapa');
  mapa.hidden = !!mundo;
  if (!mundo) mapa.innerHTML = mapa2D(p, ocupantes);
}

function mapa2D(p, ocupantes) {
  const a = leerAsiento(p.asiento); const c = CLASES[p.clase];
  const color = { cabina: '#C7D8EE', anillo: '#F2C14E', orbita: '#D9DEE6', luna: '#CDBCFF', turista: '#F2E6C8' }[p.clase];
  if (p.clase === 'cabina' || p.clase === 'anillo') {
    const cods = p.clase === 'cabina' ? Array.from({ length: 10 }, (_, i) => codigoAsiento('cabina', i)) : [-2, -1, 0, 1, 2].map((d) => a.i + d).filter((i) => i >= 0).map((i) => codigoAsiento('anillo', i));
    const w = 300 / cods.length;
    return `<svg viewBox="0 0 300 60" role="img" aria-label="Asientos cercanos">${cods.map((cod, i) => {
      const yo = cod === p.asiento; const ocupado = yo || ocupantes.has(cod) || cod === 'C-01';
      return `<rect x="${i * w + 3}" y="14" width="${w - 6}" height="32" rx="6" fill="${yo ? color : ocupado ? 'rgba(244,236,221,.28)' : 'none'}" stroke="${color}" stroke-opacity=".5"/><text x="${i * w + w / 2}" y="34" font-size="9" text-anchor="middle" fill="${yo ? '#1e1209' : '#F4ECDD'}" font-family="DM Mono">${cod}</text>`;
    }).join('')}</svg>`;
  }
  const filasV = [-1, 0, 1].map((d) => a.fila + d).filter((f) => f >= 1);
  const ancho = 300, celda = ancho / (c.porFila + 1);
  const pasillo = Math.floor(c.porFila / 2); // Luna: 2 junto a la ventana, pasillo y 3
  return `<svg viewBox="0 0 300 ${filasV.length * 40 + 10}" role="img" aria-label="Asientos cercanos">${filasV.map((f, fi) =>
    Array.from({ length: c.porFila }, (_, col) => {
      const cod = codigoAsiento(p.clase, (f - 1) * c.porFila + col); const yo = cod === p.asiento; const ocupado = yo || ocupantes.has(cod);
      const x = (col + (col >= pasillo ? 1 : 0)) * celda + 3;
      return `<rect x="${x}" y="${fi * 40 + 6}" width="${celda - 6}" height="32" rx="6" fill="${yo ? color : ocupado ? 'rgba(244,236,221,.28)' : 'none'}" stroke="${color}" stroke-opacity=".5"/><text x="${x + (celda - 6) / 2}" y="${fi * 40 + 26}" font-size="9" text-anchor="middle" fill="${yo ? '#1e1209' : '#F4ECDD'}" font-family="DM Mono">${cod.slice(2)}</text>`;
    }).join('')).join('')}</svg>`;
}

function volver() {
  document.body.classList.add('fundido');
  setTimeout(() => {
    $('#asiento').hidden = true;
    document.body.classList.remove('en-asiento', 'volando');
    mundo?.quitarAsiento();
    modo = 'portada'; actual = null;
    history.replaceState(null, '', location.pathname);
    ajustar();
    setTimeout(() => document.body.classList.remove('fundido'), 80);
  }, 450);
}

// ---------- tarjeta del asiento: minimizar y verse sentado ----------
let tarjetaMin = false;
function minimizarTarjeta(min) {
  tarjetaMin = min;
  const t = $('#a-tarjeta'), b = $('#a-minimizar');
  t.classList.toggle('min', min);
  b.setAttribute('aria-expanded', String(!min));
  b.setAttribute('aria-label', min ? 'Mostrar la tarjeta' : 'Minimizar la tarjeta');
  $('#a-detalle').inert = min; // lo oculto no se alcanza con el teclado
  try { localStorage.setItem('saturnoid-tarjeta-min', min ? '1' : ''); } catch { /* sin almacenamiento */ }
}
$('#a-minimizar').addEventListener('click', () => minimizarTarjeta(!tarjetaMin));
try { if (localStorage.getItem('saturnoid-tarjeta-min')) minimizarTarjeta(true); } catch { /* sin almacenamiento */ }

function ponerVerme(on, alInstante = false) {
  terceraObj = on ? 1 : 0;
  if (alInstante) tercera = terceraObj;
  $('#a-verme').setAttribute('aria-pressed', String(on));
  if (modo === 'asiento' && mundo) mostrarPista(textoPista(), 3500);
}
$('#a-verme').addEventListener('click', () => ponerVerme(!terceraObj));

// ---------- pase ----------
let urlPase = null;
async function verPase() {
  const b = $('#ver-pase'); b.disabled = true; b.textContent = 'Preparando…';
  try {
    let foto = null;
    if (mundo && modo === 'asiento') {
      // la vista principal del asiento (no la que quedó al arrastrar)
      const vista = modulos.camaraPOV(0, mundo.interior.pov, { yaw: 0, pitch: 0, activo: true });
      mundo.interior.verme?.(0); // la foto es desde tus ojos: sin tu propio casco delante
      foto = mundo.capturar(vista);
      mundo.interior.verme?.(tercera);
    }
    const cv = await crearPase(actual, { foto });
    const blob = await aBlob(cv);
    if (urlPase) URL.revokeObjectURL(urlPase);
    urlPase = URL.createObjectURL(blob);
    const img = new Image(); img.src = urlPase; img.alt = `Pase de abordar de @${actual.usuario} a Saturnoid`; img.width = 1080; img.height = 1920;
    $('#pase-img').replaceChildren(img);
    const g = $('#pase-guardar'); g.href = urlPase; g.download = `saturnoid-${actual.usuario}.png`;
    const archivo = new File([blob], `saturnoid-${actual.usuario}.png`, { type: 'image/png' });
    const puede = !!(navigator.canShare && navigator.canShare({ files: [archivo] }));
    const comp = $('#pase-compartir'); comp.hidden = !puede;
    comp.onclick = () => navigator.share({ files: [archivo], title: 'Mi asiento a Saturnoid', text: 'Ya tengo asiento en la nave a Saturnoid. Busca el tuyo en noidcorp.com/saturnoid' }).catch(() => {});
    $('#pase').hidden = false;
  } finally { b.disabled = false; b.textContent = 'Mi pase de abordar'; }
}

// ---------- arranque ----------
$('#buscador').addEventListener('submit', (e) => { e.preventDefault(); buscar($('#usuario').value); });
$('#volver').addEventListener('click', volver);
$('#ver-pase').addEventListener('click', verPase);
$('#pase-cerrar').addEventListener('click', () => { $('#pase').hidden = true; });
$('#sa-cerrar').addEventListener('click', () => { $('#sin-asiento').hidden = true; $('#usuario').focus(); $('#usuario').select(); });
for (const id of ['#pase', '#sin-asiento']) $(id).addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
addEventListener('scroll', () => $('#barra').classList.toggle('solida', scrollY > 40), { passive: true });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#pase').hidden = true; $('#sin-asiento').hidden = true; } });

if (MODO_FOTO) document.body.classList.add('foto');
// la tripulación se pide a la vez que el resumen (se pinta cuando llegan los dos: usa el nombre de la investigadora)
const pedidoTripulacion = tripulacion(); pedidoTripulacion.catch(() => {});
const listoDatos = cargarResumen().then(() => cargarTripulacion(pedidoTripulacion));
setInterval(() => { if (!document.hidden) cargarResumen(); }, 60000);
// el 3D arranca después del primer pintado, para que la página aparezca de una
const listo3D = new Promise((ok) => requestAnimationFrame(() => setTimeout(() => iniciar3D().finally(ok), 30)));
const u = params.get('u');
if (u) { $('#usuario').value = u; Promise.all([listoDatos, listo3D]).then(() => buscar(u)); }
