// Página de Saturnoid: contadores en vivo, buscador, vuelo al asiento, pase de abordar y plan B sin 3D.
import { resumen, buscarPasajero, tripulacion, ocupantesCerca } from './datos.js';
import { CLASES, NIVELES, nivelDe, normalizarUsuario, USUARIO_VALIDO, vecinos, leerAsiento, codigoAsiento } from './asientos.js';
import { crearPase, aBlob, fechaCorta } from './pase.js';
import { PERFIL_IG } from './config.js';

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
const arrastre = { yaw: 0, pitch: 0, activo: false };
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
  $('#ep').textContent = `· EP. ${Math.max(1, e.episodio_actual)}`;
  const reel = e.reel_url || PERFIL_IG;
  for (const a of [$('#reel'), $('#sa-reel')]) a.href = reel;
  $('#reel').textContent = e.reel_url ? 'Ver el último episodio ↗' : 'Ver la serie en Instagram ↗';

  const quedan = { anillo: Math.max(0, e.cupo_anillo - R.anillo), orbita: Math.max(0, e.cupo_orbita - R.orbita), turista: Math.max(0, e.cupo_turista - R.turista) };
  const cupo = (clase, txt, llena) => { const el = document.querySelector(`.cupo[data-clase="${clase}"]`); el.textContent = txt; el.classList.toggle('llena', !!llena); };
  cupo('anillo', quedan.anillo ? `Quedan ${quedan.anillo} de ${e.cupo_anillo}` : 'Llena', !quedan.anillo);
  cupo('orbita', quedan.orbita ? `Quedan ${quedan.orbita} de ${e.cupo_orbita}` : 'Llena', !quedan.orbita);
  cupo('turista', quedan.turista ? `Quedan ${num(quedan.turista)} de ${num(e.cupo_turista)}` : 'Llena', !quedan.turista);
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

function textoCupos(q) {
  if (q.anillo) return `Quedan <b>${q.anillo}</b> asientos en Clase Anillo${q.orbita ? ` y ${q.orbita} en Órbita` : ''}.`;
  if (q.orbita) return `Clase Anillo está llena. Quedan <b>${q.orbita}</b> en Órbita.`;
  if (q.turista) return `Anillo y Órbita están llenas. Quedan <b>${num(q.turista)}</b> en Turista (y cada episodio 3 suben a Anillo).`;
  return 'La nave está llena: 1.000 pasajeros a bordo.';
}

async function cargarTripulacion() {
  try {
    const t = await tripulacion();
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
    await Promise.all(['800 40px Panchang', '500 40px "DM Mono"', '400 40px Switzer'].map((f) => document.fonts.load(f)));
    const [{ crearMundo }, camara] = await Promise.all([import('../escena/mundo.js'), import('../escena/camara.js')]);
    modulos = camara;
    const lienzo = $('#lienzo');
    mundo = crearMundo({ canvas: lienzo, calidad: MODO_FOTO ? 'alta' : elegirCalidad() });
    ajustar();
    addEventListener('resize', ajustar);
    requestAnimationFrame(bucle);
    enganchar(lienzo);
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
  return ancho ? { x: -0.28, y: 0 } : { x: 0, y: -0.18 };
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
    const tl = (ahora - tLlegada) / 1000;
    cam = modulos.camaraPOV(tl, mundo.interior.pov, arrastre);
    cam.fov = aspecto < 0.85 ? 78 : 64;
    sacudida = mundo.interior.sacudida || 0;
    adentro = 1;
  }
  mundo.cuadro(t, { nivel: nivelVis, cam, sacudida, adentro });
  cuadros++;
  // si el teléfono no da, bajar calidad una vez
  const dt = ahora - ultimo; ultimo = ahora;
  if (cuadros > 30 && cuadros < 400 && dt > 55) lentos++;
  if (lentos > 40 && !mundo.bajado) { mundo.bajado = true; mundo.renderer.setPixelRatio(1); ajustar(); }
  if (primerCuadro) {
    primerCuadro = false; document.body.classList.add('con3d'); document.body.classList.remove('cargando'); window.__saturnoidListo = true;
    // con la página quieta, dejar listos los interiores para que el primer vuelo no se congele
    const luego = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    if (!MODO_FOTO) setTimeout(() => luego(() => mundo.precalentar().catch(() => {})), 1500);
  }
}
const lerpFov = (p, a) => { const ini = a < 0.85 ? 58 : 42, fin = a < 0.85 ? 78 : 64; const k = Math.min(1, Math.max(0, (p - 0.55) / 0.45)); return ini + (fin - ini) * k; };

function enganchar(el) {
  let x0 = 0, y0 = 0, yaw0 = 0, pitch0 = 0, activo = false;
  el.addEventListener('pointerdown', (e) => {
    if (modo !== 'asiento') return;
    activo = true; x0 = e.clientX; y0 = e.clientY;
    if (!arrastre.activo) { // toma el ángulo actual del recorrido como punto de partida
      const d = mundo.camara.getWorldDirection(new (mundo.camara.position.constructor)());
      const c = mundo.interior.pov; const dc = c.centro.clone().sub(c.pos);
      arrastre.yaw = Math.atan2(d.x, -d.z) - Math.atan2(dc.x, -dc.z);
      arrastre.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) - Math.atan2(dc.y, Math.hypot(dc.x, dc.z));
      arrastre.activo = true;
    }
    yaw0 = arrastre.yaw; pitch0 = arrastre.pitch;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!activo) return;
    const k = 3.2 / Math.max(innerWidth, 360);
    arrastre.yaw = yaw0 + (e.clientX - x0) * k;
    arrastre.pitch = Math.max(-0.9, Math.min(0.9, pitch0 + (e.clientY - y0) * k));
    $('#a-pista').hidden = true;
  });
  const fin = () => { activo = false; };
  el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
}

// ---------- buscador ----------
// Se busca mientras la persona escribe: al tocar "Buscar", el asiento y los vecinos casi siempre ya llegaron.
const consultas = new Map();
function consultar(usuario) {
  if (!consultas.has(usuario)) {
    const pr = buscarPasajero(usuario).then(async (p) => ({ p, ocupantes: p ? await ocupantesCerca(p.asiento).catch(() => new Map()) : null }));
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
    const { p, ocupantes } = await consultar(usuario);
    if (!p) { quitarAviso(); return sinAsiento(usuario); }
    history.replaceState(null, '', `?u=${encodeURIComponent(usuario)}`);
    aviso(`Asiento ${p.asiento} · ${CLASES[p.clase].nombre}`, mundo ? 'Despegando hacia tu asiento' : '', true);
    abordar(p, ocupantes);
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

function abordar(p, ocupantes) {
  actual = p;
  pintarTarjeta(p, ocupantes);
  $('#usuario').blur();
  if (!mundo) { mostrarAsiento(); return; }
  const info = {
    pasajeros: R?.pasajeros ?? 0, investigadora: R?.estado?.investigadora, nivel: nivelObj,
    nivelNombre: NIVELES[nivelObj].nombre, lineaMeta: R ? lineaMeta(R.pasajeros, R.estado.metas) : '',
  };
  const interior = mundo.prepararAsiento(p.clase, { asiento: p.asiento, usuario: p.usuario, ocupantes, info });
  const desde = { pos: mundo.camara.position.clone(), mira: mundo.camara.position.clone().add(mundo.camara.getWorldDirection(mundo.camara.position.clone()).multiplyScalar(40)) };
  vuelo = modulos.armarVuelo(desde, interior);
  arrastre.yaw = arrastre.pitch = 0; arrastre.activo = false;
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
  $('#a-pista').hidden = !mundo;
}

function pintarTarjeta(p, ocupantes) {
  const c = CLASES[p.clase];
  $('#a-clase').textContent = p.es_tripulacion ? 'Cabina de mando · Tripulación fundadora' : c.nombre;
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
  const color = { cabina: '#C7D8EE', anillo: '#F2C14E', orbita: '#D9DEE6', turista: '#F2E6C8' }[p.clase];
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
  const pasillo = c.porFila / 2;
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

// ---------- pase ----------
let urlPase = null;
async function verPase() {
  const b = $('#ver-pase'); b.disabled = true; b.textContent = 'Preparando…';
  try {
    let foto = null;
    if (mundo && modo === 'asiento') {
      // la vista principal del asiento (no la que quedó al arrastrar)
      const vista = modulos.camaraPOV(0, mundo.interior.pov, { yaw: 0, pitch: 0, activo: true });
      foto = mundo.capturar(vista);
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
const listoDatos = cargarResumen().then(cargarTripulacion);
setInterval(() => { if (!document.hidden) cargarResumen(); }, 60000);
// el 3D arranca después del primer pintado, para que la página aparezca de una
const listo3D = new Promise((ok) => requestAnimationFrame(() => setTimeout(() => iniciar3D().finally(ok), 30)));
const u = params.get('u');
if (u) { $('#usuario').value = u; Promise.all([listoDatos, listo3D]).then(() => buscar(u)); }
