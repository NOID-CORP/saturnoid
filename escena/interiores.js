// Interior de cada clase (Cabina, Anillo, Órbita, Luna, Turista), construido alrededor del asiento buscado, con los
// vecinos de verdad y sus nametags, y el resto del piso completo con todos sus asientos (ocupados según la base).
// Se arma en METROS y el grupo se escala a la nave (ESCALA_INTERIOR): la nave real mide 25 m de ancho (ver nave.js).
// El grupo va en nave.cuerpo (así vibra con ella). La cámara entra por -z.
// crearInterior(clase, opciones) → { grupo, ruta, miras, pov, actualizar(t), liberar() }
//   ruta/miras: puntos (afuera → adentro → asiento) y a dónde mira la cámara en cada uno, en unidades de la nave.
//   pov: { pos, centro, izq, der }: la cabeza del pasajero y las tres miradas del recorrido automático.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { crearNametag, crearPasajero, crearMultitud } from './nametags.js';
import { SECCIONES, ESCALA_INTERIOR as K, CUPULAS, ANILLO_Y, TOTAL_CUPULAS, cupulaDeSuite } from './nave.js';
import { DIR_PLANETA } from './cielo.js';
import { lienzo, mulberry32, semilla, temblor, clamp, C } from './util.js';
import { CLASES, codigoAsiento, leerAsiento } from '../js/asientos.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, roughness = 0.7, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function caja(w, h, d, m, x, y, z, radio = 0) {
  const g = radio ? new RoundedBoxGeometry(w, h, d, 2, radio) : new THREE.BoxGeometry(w, h, d);
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o;
}

// Cartel / pantalla hecho en canvas.
function cartel(ancho, alto, dibujar, { emisivo = true, px = 256 } = {}) {
  const W = Math.round(px * ancho), H = Math.round(px * alto);
  const cv = lienzo(W, H); const x = cv.getContext('2d');
  dibujar(x, W, H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = emisivo ? new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.62, 0.62, 0.62) }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  return new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), m);
}
// Imágenes que son iguales en todos los interiores (las pantallas de los respaldos menos la tuya, el letrero del frente,
// los avisos de Turista, el techo y las mantas de Luna): se dibujan una sola vez, nunca se liberan y precalentar las sube
// con la página quieta (antes cada interior dibujaba y subía ~24 copias iguales en el primer cuadro del vuelo).
// Lo que se comparte es solo la imagen: cada pieza sigue con su propio material, creado en el mismo momento que antes,
// para que three.js las dibuje en el mismo orden (compartir el material cambia el orden y con él algún píxel de las juntas).
const propio = (base) => { const m = base.clone(); delete m.userData.compartida; return m; };
const PANTALLAS = {};
function pantallaComun(clave, ancho, alto, dibujar, opciones) {
  let base = PANTALLAS[clave];
  if (!base) {
    const muestra = cartel(ancho, alto, dibujar, opciones); muestra.geometry.dispose();
    base = PANTALLAS[clave] = muestra.material; base.userData.compartida = true; base.map.userData.compartida = true;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), propio(base));
}
const fuente = (peso, px, fam = 'DM Mono') => `${peso} ${px}px "${fam}", ${fam === 'DM Mono' ? 'monospace' : 'sans-serif'}`;

// Planeta dibujado para las pantallas (2D).
function dibujarPlaneta(x, cx, cy, r) {
  x.save();
  x.strokeStyle = 'rgba(250,236,178,.7)'; x.lineWidth = r * 0.12;
  x.beginPath(); x.ellipse(cx, cy, r * 2.1, r * 0.55, -0.35, Math.PI, Math.PI * 2); x.stroke();
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#6fa6c9'); g.addColorStop(0.55, '#2b5f7c'); g.addColorStop(1, '#0b2034');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(70,110,50,.85)';
  x.beginPath(); x.ellipse(cx - r * 0.25, cy - r * 0.1, r * 0.35, r * 0.22, 0.5, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(cx + r * 0.35, cy + r * 0.3, r * 0.22, r * 0.15, -0.3, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(199,216,238,.85)'; x.lineWidth = r * 0.12;
  x.beginPath(); x.ellipse(cx, cy, r * 2.1, r * 0.55, -0.35, 0, Math.PI); x.stroke();
  x.restore();
}

// ---------- Clase Luna: luna creciente y techo de estrellas (dibujos 2D) ----------
const LAVANDA = '#CDBCFF';

// Luna creciente con brillo (pantallas y letrero de Clase Luna). Se recorta en un lienzo aparte: así no abre un hueco en el fondo.
function dibujarLuna(x, cx, cy, r) {
  const t = Math.ceil(r * 2.4), cv = lienzo(t, t), y = cv.getContext('2d'), c = t / 2;
  const g = y.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
  g.addColorStop(0, '#fff8e6'); g.addColorStop(1, '#e8d9a8');
  y.fillStyle = g; y.beginPath(); y.arc(c, c, r, 0, Math.PI * 2); y.fill();
  y.globalCompositeOperation = 'destination-out';
  y.beginPath(); y.arc(c + r * 0.45, c - r * 0.2, r * 0.9, 0, Math.PI * 2); y.fill();
  x.save(); x.shadowColor = 'rgba(255,240,200,.85)'; x.shadowBlur = r * 0.6; x.drawImage(cv, cx - c, cy - c); x.restore();
}

// Techo de estrellas: cielo de noche con la Vía Láctea en diagonal y una luna. Se dibuja una sola vez (precalentar lo
// hace con la página quieta) y cada interior de Luna sube el mismo lienzo como textura.
let cieloLuna = null;
function lienzoCieloLuna() {
  if (cieloLuna) return cieloLuna;
  const W = 1620, H = 1080, k = W / 1800;
  const cv = lienzo(W, H), x = cv.getContext('2d'), r = mulberry32(77);
  const fondo = x.createLinearGradient(0, 0, W, H); fondo.addColorStop(0, '#060818'); fondo.addColorStop(1, '#0d0b26');
  x.fillStyle = fondo; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) {
    const u = r(), v = (r() - 0.5) * 0.28 + (r() - 0.5) * 0.12;
    const px = u * W, py = H * (0.85 - 0.7 * u) + v * H, rad = (26 + r() * 40) * k;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(${(170 + r() * 60) | 0},${(150 + r() * 60) | 0},255,${(0.035 + r() * 0.03).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 1200; i++) {
    const px = r() * W, py = r() * H, s = (Math.pow(r(), 6) * 3.2 + 0.5) * k, a = (0.45 + r() * 0.55).toFixed(2), tono = r();
    x.fillStyle = tono < 0.15 ? `rgba(255,214,170,${a})` : tono < 0.3 ? `rgba(190,215,255,${a})` : `rgba(255,255,255,${a})`;
    x.beginPath(); x.arc(px, py, s, 0, Math.PI * 2); x.fill();
  }
  for (let i = 0; i < 14; i++) { // estrellas grandes con destello
    const px = r() * W, py = r() * H, s = (3 + r() * 3) * k;
    x.save(); x.shadowColor = '#fff'; x.shadowBlur = 14; x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, s, 0, Math.PI * 2); x.fill(); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px - s * 5, py); x.lineTo(px + s * 5, py); x.moveTo(px, py - s * 5); x.lineTo(px, py + s * 5); x.stroke();
  }
  dibujarLuna(x, W * 0.78, H * 0.3, H * 0.13);
  return (cieloLuna = cv);
}
// La imagen de 1620×1080 del techo se sube a la tarjeta gráfica una sola vez (ver propio()).
let matCieloLuna = null;
function materialCieloLuna() {
  if (!matCieloLuna) {
    const t = new THREE.CanvasTexture(lienzoCieloLuna()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.compartida = true;
    matCieloLuna = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); matCieloLuna.userData.compartida = true;
  }
  return propio(matCieloLuna);
}

function tagDe(clase) { return CLASES[clase].tag; }

// Las luces del interior no se crean: se reutilizan las que mundo.js deja fijas en la nave (o.luces).
// Crear luces nuevas obliga a recompilar todos los materiales de la escena y congela el celular un momento.
function luz(o, i, color, intensidad, distancia, x, y, z) {
  const l = o.luces?.[i] || new THREE.PointLight();
  l.color.set(color); l.intensity = intensidad; l.distance = distancia; l.decay = 2; l.position.set(x, y, z);
  if (!o.luces) o.grupo?.add(l);
  return l;
}
const GEO = {};
function geosFilas() {
  if (GEO.manta) return GEO;
  GEO.manta = new THREE.BoxGeometry(0.42, 0.035, 0.56);
  GEO.mantaCaida = new THREE.BoxGeometry(0.035, 0.2, 0.56);
  GEO.taza = new THREE.CylinderGeometry(0.038, 0.032, 0.075, 16);
  GEO.choco = new THREE.CircleGeometry(0.033, 16); GEO.choco.rotateX(-Math.PI / 2);
  GEO.vapor = new THREE.PlaneGeometry(0.09, 0.18);
  GEO.foco = new THREE.SphereGeometry(0.025, 8, 6);
  for (const k in GEO) GEO[k].userData.compartida = true;
  return GEO;
}
// Los planos transparentes de doble cara (vapor, mamparas) van en una sola pasada (forceSinglePass): en un plano la
// cara de atrás y la de adelante nunca se tapan entre sí, así que se ve igual y no hay un segundo programa que preparar.
// Las imágenes del vapor y de la manta son iguales en todos los interiores de Luna: se dibujan una vez (ver propio()).
let texVapor = null, matManta = null;
function texturaVapor() {
  if (!texVapor) { texVapor = dibujarVapor(); texVapor.userData.compartida = true; }
  return texVapor;
}
function materialManta() {
  if (!matManta) { matManta = new THREE.MeshStandardMaterial({ map: texturaManta(), roughness: 0.95 }); matManta.userData.compartida = true; matManta.map.userData.compartida = true; }
  return propio(matManta);
}
function dibujarVapor() {
  const cv = lienzo(64, 128), x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 90, 2, 32, 76, 32); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  return new THREE.CanvasTexture(cv);
}
function texturaManta() { // tejido: franjas tinto / mantequilla / café / azul con punto
  const cv = lienzo(64, 96), x = cv.getContext('2d');
  const fr = ['#8c2f39', '#faecb2', '#5a3a22', '#c7d8ee', '#8c2f39']; const h = 96 / fr.length;
  fr.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * h, 64, h + 1); });
  x.globalAlpha = 0.18; x.fillStyle = '#000';
  for (let yy = 0; yy < 96; yy += 6) for (let xx = (yy / 6) % 2 ? 0 : 3; xx < 64; xx += 6) x.fillRect(xx, yy, 3, 3);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// =====================================================================================================================
// Escala y cuentas
// Adentro todo se arma en metros: piso en y = 0, eje de la nave en x = z = 0. Polar: x = sin(a)·r, z = cos(a)·r;
// a = π es -z, por donde entra la cámara. El grupo se escala por K y se sube al piso de su sección.
//
// Para que los 1.000 quepan de verdad (nave de 25 m de ancho, pisos que dan la vuelta completa al núcleo):
//   Turista  400 = 67 filas × 6 en un piso; filas a 0,78 m que ocupan 292° de la vuelta (el resto: el baño para 200).
//   Luna     200 = 40 filas × 5 en un piso; la vuelta completa, 1,6 m entre filas.
//   Órbita   300 = 75 filas × 4 en 2 pisos de 38 filas (las 2 filas de ventanas de afuera); 1,7 m entre filas.
//   Anillo   100 suites + las de los que suben de Turista = 114 cúpulas de 2,9 m sobre el anillo (ver nave.js).
//   Cabina   la investigadora y 9 tripulantes, en un puente de mando de 24 m.
// =====================================================================================================================
const RW = 4.88 / K;   // pared de adentro del casco: 12,2 m de radio
const RN = 2.6;        // núcleo del centro de cada piso (ascensor y escaleras)
const P = (r, a, y = 0) => V(Math.sin(a) * r, y, Math.cos(a) * r);
const UNO = V(1, 1, 1);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
// Matriz de un lugar del piso (posición en metros y giro en y).
const lugar = (pos, rotY = 0, esc = UNO) => new THREE.Matrix4().compose(pos, _q.setFromEuler(_e.set(0, rotY, 0)), esc);
// Una pieza repetida en muchos lugares = una sola malla instanciada (un dibujo para cientos de asientos).
function repetir(geo, material, lugares, local = null) {
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, lugares.length));
  im.count = lugares.length;
  lugares.forEach((L, i) => im.setMatrixAt(i, local ? _m.multiplyMatrices(L, local) : L));
  im.computeBoundingSphere();
  return im;
}
// Pieza de un mueble: caja (redondeada o no) y dónde va dentro del mueble.
function pieza(w, h, d, x, y, z, { rz = 0, ry = 0, rx = 0, radio = 0 } = {}) {
  const g = radio ? new RoundedBoxGeometry(w, h, d, 1, radio) : new THREE.BoxGeometry(w, h, d);
  return { g, m: new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), UNO) };
}
function enPiso(o, piso) {
  o.aNave = (v) => V(v.x * K, piso + v.y * K, v.z * K);
  const g = new THREE.Group(); g.position.y = piso; g.scale.setScalar(K); o.grupo = g;
  return g;
}
// Luz del interior en metros (se convierte a la nave; ver luz()).
function luzM(o, i, color, intensidad, alcance, v) { const p = o.aNave(v); return luz(o, i, color, intensidad, alcance * K, p.x, p.y, p.z); }
// Textura que se repite alrededor de un cilindro (pared con ventanas, núcleo con letreros). Igual en todos los
// interiores de la misma clase: se dibuja una vez y queda en la tarjeta gráfica (ver propio()).
const VUELTAS = {};
function texturaVuelta(clave, W, H, veces, dibujar) {
  if (!VUELTAS[clave]) {
    const cv = lienzo(W, H); dibujar(cv.getContext('2d'), W, H);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
    t.repeat.x = veces; t.userData.compartida = true; VUELTAS[clave] = t;
  }
  return VUELTAS[clave];
}
// Mirada hacia el planeta desde un punto (para las ventanas y las cúpulas).
const haciaPlaneta = (desde, dist = 30) => desde.clone().add(DIR_PLANETA.clone().multiplyScalar(dist));

// Coloca un pasajero suelto (cabina) con su nametag encima. pos en metros del piso.
function sentar(grupo, ocupante, { pos, rotY, clase, traje, detalle, alturaTag = 1.12, tag }) {
  if (!ocupante) return null;
  const p = crearPasajero(traje, detalle); p.position.copy(pos); p.rotation.y = rotY; grupo.add(p);
  const nt = crearNametag(ocupante.etiqueta || ocupante.usuario, tag || tagDe(clase), { etiqueta: ocupante.rol || null });
  nt.position.copy(pos).add(V(0, alturaTag, 0)); grupo.add(nt);
  return p;
}

// ---------- CABINA DE MANDO (puente de 24 m con el ventanal al frente) ----------
function cabina(o) {
  const { asiento, ocupantes, info } = o;
  const S = SECCIONES.cabina; const g = enPiso(o, S.piso);
  const R = 4.75 / K, alto = S.alto;
  const vIn = (36.4 - S.piso) / K, vOut = (38.6 - S.piso) / K; // el ventanal de afuera: de 1,0 a 6,5 m del piso
  const ABRE = 1.15;
  const mPared = mat('#2a2f3a', 0.6, 0.2), mPiso = mat('#1b1a1f', 0.8), mTrim = mat(C.azul, 0.4, 0.3);
  const pared = new THREE.Mesh(new THREE.CylinderGeometry(R, R, alto, 64, 1, true, Math.PI + ABRE, Math.PI * 2 - ABRE * 2), mPared);
  pared.material.side = THREE.DoubleSide; pared.position.y = alto / 2; g.add(pared);
  for (const [a, b] of [[0, vIn], [vOut, alto]]) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(R, R, b - a, 40, 1, true, Math.PI - ABRE, ABRE * 2), mPared);
    seg.material.side = THREE.DoubleSide; seg.position.y = (a + b) / 2; g.add(seg);
  }
  const mParal = mat('#1b1f27', 0.5, 0.6);
  for (let k = -6; k <= 6; k++) { const a = Math.PI + k * (ABRE / 6.4); g.add(caja(0.1, vOut - vIn, 0.16, mParal, Math.sin(a) * (R - 0.05), (vIn + vOut) / 2, Math.cos(a) * (R - 0.05))); }
  const pisoM = new THREE.Mesh(new THREE.CircleGeometry(R, 64), mPiso); pisoM.rotation.x = -Math.PI / 2; g.add(pisoM);
  const techoM = new THREE.Mesh(new THREE.CircleGeometry(R, 64), mPared); techoM.rotation.x = Math.PI / 2; techoM.position.y = alto; g.add(techoM);
  for (const r of [5.5, 9.5]) { const aro = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 128), new THREE.MeshBasicMaterial({ color: '#9fc3ff' })); aro.rotation.x = Math.PI / 2; aro.position.y = alto - 0.08; g.add(aro); }
  // consola curva bajo el ventanal con pantallas (datos reales)
  const consola = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.5, R - 0.5, 0.95, 48, 1, false, Math.PI - ABRE * 0.95, ABRE * 1.9), mat('#2b2622', 0.5, 0.3));
  consola.position.y = 0.48; g.add(consola);
  const textos = [
    (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); dibujarPlaneta(x, W * 0.5, H * 0.55, H * 0.24); x.fillStyle = C.mant; x.font = fuente(500, H * 0.11); x.fillText('DESTINO · SATURNOID', W * 0.06, H * 0.16); },
    (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); x.fillStyle = C.azul; x.font = fuente(500, H * 0.11); x.fillText('PASAJEROS A BORDO', W * 0.06, H * 0.18); x.fillStyle = C.mant; x.font = fuente(800, H * 0.36, 'Panchang'); x.fillText(String(info.pasajeros ?? 0), W * 0.06, H * 0.62); x.fillStyle = C.azul; x.font = fuente(500, H * 0.1); x.fillText(info.lineaMeta || '', W * 0.06, H * 0.86); },
    (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); x.fillStyle = C.azul; x.font = fuente(500, H * 0.11); x.fillText('ESTADO DE LA NAVE', W * 0.06, H * 0.18); x.fillStyle = info.nivel > 0 ? '#ffb15c' : C.mant; x.font = fuente(500, H * 0.15); x.fillText((info.nivelNombre || '').toUpperCase(), W * 0.06, H * 0.5); for (let i = 0; i < 3; i++) { x.fillStyle = i < info.nivel ? '#ff8a3d' : 'rgba(199,216,238,.25)'; x.fillRect(W * (0.06 + i * 0.3), H * 0.68, W * 0.26, H * 0.12); } },
  ];
  const ponerPantalla = (p, a) => { p.position.copy(P(R - 0.85, a, 1.08)); p.lookAt(0, 1.6, 0); p.rotateX(-0.6); g.add(p); };
  textos.forEach((d, i) => ponerPantalla(cartel(1.0, 0.56, d, { px: 360 }), Math.PI + (i - 1) * 0.11));
  // más puestos de la consola a los lados (radar y rumbo), iguales en todos los interiores
  for (const k of [-3, -2, 2, 3]) ponerPantalla(pantallaComun('cab-radar', 1.0, 0.56, (x, W, H) => {
    x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(159,195,255,.55)'; x.lineWidth = 3;
    for (const r of [0.15, 0.28, 0.41]) { x.beginPath(); x.arc(W * 0.3, H * 0.55, H * r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath(); x.moveTo(W * 0.3, H * 0.55); x.lineTo(W * 0.3 + H * 0.4, H * 0.3); x.stroke();
    x.fillStyle = C.azul; x.font = fuente(500, H * 0.1); x.fillText('RUMBO', W * 0.6, H * 0.3); x.fillStyle = C.mant; x.font = fuente(500, H * 0.13); x.fillText('SATURNOID', W * 0.6, H * 0.5);
    x.fillStyle = C.azul; x.font = fuente(500, H * 0.09); x.fillText('ÓRBITA ESTABLE', W * 0.6, H * 0.7);
  }, { px: 300 }), Math.PI + k * 0.11);
  // mesa del centro con el holograma del planeta
  const mesa = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.9, 40), mat('#232833', 0.4, 0.5)); mesa.position.y = 0.45; g.add(mesa);
  const holoM = new THREE.MeshBasicMaterial({ color: '#7fb0d9', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
  const holo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), holoM); holo.position.y = 1.55; g.add(holo);
  const holoAro = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 6, 48), new THREE.MeshBasicMaterial({ color: C.mant, transparent: true, opacity: 0.7, toneMapped: false }));
  holoAro.position.y = 1.55; holoAro.rotation.set(Math.PI / 2 - 0.35, 0, 0.2); g.add(holoAro);
  // asientos: fila de adelante (C-02, C-03, C-01, C-04, C-05) y fila de atrás elevada (C-06…C-10), mirando al ventanal
  const mAsiento = mat('#3a2418', 0.55), mAcento = mat(C.azul, 0.4);
  const lugares = {};
  const filaA = ['C-02', 'C-03', 'C-01', 'C-04', 'C-05'], filaB = ['C-06', 'C-07', 'C-08', 'C-09', 'C-10'];
  const poner = (cod, a, r, alza) => {
    const base = P(r, a, alza);
    const rotY = a - Math.PI / 2;
    const s = new THREE.Group(); s.position.copy(base); s.rotation.y = rotY; g.add(s);
    s.add(caja(0.62, 0.14, 0.6, mAsiento, 0.05, 0.36, 0, 0.05));
    s.add(caja(0.14, 0.68, 0.6, mAsiento, -0.24, 0.73, 0, 0.05)); // respaldo bajo: al girar se ve el puente
    s.add(caja(0.16, 0.06, 0.62, mAcento, -0.24, 1.08, 0));
    s.add(caja(0.3, 0.36, 0.3, mat('#222', 0.5, 0.6), 0, 0.17, 0));
    lugares[cod] = { pos: base.clone().add(V(0, 0.42, 0)), rotY, a };
  };
  filaA.forEach((c, i) => poner(c, Math.PI + (i - 2) * 0.17, 8.6, 0));
  filaB.forEach((c, i) => poner(c, Math.PI + (i - 2) * 0.22, 6.6, 0.45));
  const tarima = new THREE.Mesh(new THREE.CylinderGeometry(7.3, 7.3, 0.45, 48, 1, false, Math.PI - 0.6, 1.2), mPiso); tarima.position.y = 0.225; g.add(tarima);
  const borde = new THREE.Mesh(new THREE.CylinderGeometry(7.32, 7.32, 0.04, 48, 1, true, Math.PI - 0.6, 1.2), mTrim); borde.position.y = 0.45; g.add(borde);
  for (const [cod, l] of Object.entries(lugares)) {
    if (cod === asiento) continue;
    const oc = cod === 'C-01' ? { usuario: info.investigadora || 'La investigadora', rol: 'INVESTIGADORA' } : ocupantes.get(cod);
    sentar(g, oc, { pos: l.pos, rotY: l.rotY, clase: 'cabina', traje: cod === 'C-01' ? C.mant : '#cfd8e6', detalle: cod === 'C-01' ? C.tinto : '#3c5a80', tag: cod === 'C-01' ? 'investigadora' : 'cabina' });
  }
  // pared del fondo: la placa de la tripulación fundadora (con los nombres reales) y la escotilla
  const nombres = [info.investigadora || 'La investigadora', ...['C-02', 'C-03', 'C-04', 'C-05', 'C-06', 'C-07', 'C-08', 'C-09', 'C-10'].map((k) => ocupantes.get(k)?.usuario).filter(Boolean).map((u) => '@' + u)];
  const placa = cartel(6.0, 3.0, (x, W, H) => {
    x.fillStyle = '#141a24'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(199,216,238,.5)'; x.lineWidth = 6; x.strokeRect(12, 12, W - 24, H - 24);
    x.textAlign = 'center'; x.fillStyle = C.mant; x.font = fuente(800, H * 0.085, 'Panchang'); x.fillText('TRIPULACIÓN FUNDADORA', W / 2, H * 0.17);
    x.fillStyle = C.azul; x.font = fuente(500, H * 0.05); x.fillText('NAVE SATURNOID · NOID', W / 2, H * 0.26);
    nombres.forEach((t, i) => { const col = i < 5 ? 0 : 1, fila = i % 5; x.fillStyle = i === 0 ? C.mant : C.azul; x.font = fuente(500, H * 0.062); x.fillText(t, W * (0.3 + col * 0.4), H * (0.42 + fila * 0.11)); });
  }, { px: 170 });
  placa.position.copy(P(R - 0.08, 0, 3.4)); placa.lookAt(0, 3.4, 0); g.add(placa);
  const escotilla = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), mat('#3a404c', 0.4, 0.6));
  escotilla.position.copy(P(R - 0.06, 0.55, 1.4)); escotilla.lookAt(0, 1.4, 0); g.add(escotilla);
  luzM(o, 0, '#bcd4ff', 26, 26, V(0, alto - 1.2, -4)); luzM(o, 1, '#9fc3ff', 3, 9, V(0, 1.8, 0));
  const yo = lugares[asiento] || lugares['C-02'];
  const cabeza = yo.pos.clone().add(V(Math.sin(yo.a) * 0.08, 0.84, Math.cos(yo.a) * 0.08));
  const centro = haciaPlaneta(cabeza).lerp(P(30, Math.PI + (yo.a - Math.PI) * 0.4, 9), 0.5);
  const n = o.aNave;
  return {
    grupo: g,
    ruta: [V(0, 37.6, -16), V(0, 37.5, -4.4), V(0, 37.45, -3.6), n(cabeza.clone().add(V(0, 0.6, 0))), n(cabeza)],
    miras: [V(0, 37.4, 0), V(0, 37.3, 0), n(V(cabeza.x * 0.5, 1.2, cabeza.z * 0.5)), n(cabeza.clone().multiplyScalar(2.2).setY(3.5)), n(centro)],
    pov: { pos: n(cabeza), centro: n(centro), izq: n(V(-14, 1.2, -2.5)), der: n(V(14, 1.2, -2.5)) },
    propio: { pos: yo.pos, rotY: yo.rotY, traje: '#cfd8e6', detalle: '#3c5a80' }, techo: alto - 0.5,
    actualizar(t) { holo.rotation.y = t * 0.25; holoM.opacity = 0.4 + 0.06 * Math.sin(t * 1.3); },
  };
}

// ---------- CLASE ANILLO (una cúpula de cristal por suite, sobre el anillo) ----------
// Cada suite es una cúpula de 2,9 m: cama, poltrona mirando al anillo y al planeta, mesa del chef y jardín.
// Se ven todas las cúpulas del anillo, cada una con su pasajero si la suite está ocupada.
function anillo(o) {
  const { asiento, ocupantes, ocupados } = o;
  const g = enPiso(o, ANILLO_Y + 0.012);
  const a0 = leerAsiento(asiento); const yo = cupulaDeSuite(a0.i);
  const circ = CUPULAS.circulos; const RCU = CUPULAS.radio / K;
  const angYo = (2 * Math.PI * yo.j) / circ[yo.circulo].n;
  const rr = mulberry32(semilla(asiento));
  const mMadera = mat('#6b4426', 0.6), mOro = mat(C.oro, 0.3, 0.8);
  // la suite i se ve en su círculo, en el lugar que le toca respecto a la del pasajero (que queda en π, hacia -z)
  const ubicar = (i) => {
    const c = cupulaDeSuite(i), n = circ[c.circulo].n;
    const k = Math.round(((2 * Math.PI * c.j) / n - angYo) * n / (2 * Math.PI));
    const a = Math.PI + (k / n) * 2 * Math.PI, r = circ[c.circulo].r / K;
    return { a, r, centro: P(r, a), marco: lugar(P(r, a), a - Math.PI) }; // en el marco de la cúpula, -z mira hacia afuera
  };
  // muebles de cada cúpula (en el marco de la cúpula): cama del lado de la nave, poltrona del lado de afuera
  const piezas = {
    alfombra: { g: new THREE.CircleGeometry(RCU - 0.06, 32).rotateX(-Math.PI / 2), m: new THREE.Matrix4().makeTranslation(0, 0.01, 0), mat: mat('#d9c7a2', 0.95) },
    cama: { ...pieza(1.9, 0.38, 0.95, 0, 0.19, 0.45, { radio: 0.05 }), mat: mMadera },
    colchon: { ...pieza(1.85, 0.14, 0.9, 0, 0.45, 0.45, { radio: 0.06 }), mat: mat('#f4ead6', 0.9) },
    cobija: { ...pieza(1.1, 0.06, 0.92, -0.35, 0.54, 0.45, { radio: 0.03 }), mat: mat(C.tinto, 0.85) },
    almohada: { ...pieza(0.4, 0.13, 0.55, 0.68, 0.58, 0.45, { radio: 0.06 }), mat: mat(C.mant, 0.9) },
    poltrona: { ...pieza(0.66, 0.24, 0.66, 0, 0.3, -0.5, { radio: 0.08 }), mat: mat(C.mant, 0.8) },
    respaldo: { ...pieza(0.66, 0.66, 0.16, 0, 0.66, -0.16, { rx: 0.32, radio: 0.07 }), mat: mat(C.mant, 0.8) },
  };
  const todas = [], ocupadas = [], cerca = [];
  let suites = 0;
  for (let i = 0; i < TOTAL_CUPULAS; i++) {
    const cod = codigoAsiento('anillo', i), u = ubicar(i);
    todas.push(u.marco);
    if (cod === asiento.toUpperCase()) continue;
    if (ocupados ? ocupados.has(cod) : i < 100) {
      suites++;
      // sentado en la poltrona, mirando hacia afuera (al anillo y al planeta)
      const L = u.marco.clone().multiply(lugar(V(0, 0.42, -0.45), Math.PI / 2));
      (u.centro.distanceTo(P(circ[yo.circulo].r / K, Math.PI)) < 7 ? cerca : ocupadas).push(L);
      const oc = ocupantes.get(cod);
      if (oc) { const nt = crearNametag(oc.usuario, 'oro'); nt.position.copy(u.centro).add(V(0, 1.6, 0)); g.add(nt); }
    }
  }
  for (const p of Object.values(piezas)) g.add(repetir(p.g, p.mat, todas, p.m));
  g.add(crearMultitud(cerca, { traje: '#f1e6cc', detalle: C.oro, semilla: semilla(asiento) }));
  g.add(crearMultitud(ocupadas, { traje: '#f1e6cc', detalle: C.oro, liviana: true, semilla: semilla(asiento) + 1, piezas: ['torso', 'casco', 'visor', 'franja', 'brazo'] }));

  // la suite del pasajero: mesa del chef, jardín y placa (en el marco de su cúpula)
  const mia = ubicar(a0.i), s = new THREE.Group(); s.position.copy(mia.centro); s.rotation.y = mia.a - Math.PI; g.add(s);
  const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 24), mMadera); mesa.position.set(0.72, 0.62, -0.62); s.add(mesa);
  const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8), mOro); pata.position.set(0.72, 0.31, -0.62); s.add(pata);
  const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.02, 24), mat('#ffffff', 0.3)); plato.position.set(0.68, 0.65, -0.58); s.add(plato);
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), mat(['#c0592f', '#7aa04a', '#f2c14e', '#a33', '#e8d3a0'][k], 0.6)); b.position.set(0.68 + (rr() - 0.5) * 0.11, 0.675, -0.58 + (rr() - 0.5) * 0.11); s.add(b); }
  const campana = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d9dde3', 0.15, 1)); campana.position.set(0.82, 0.72, -0.72); campana.rotation.z = 1.1; s.add(campana);
  const copa = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.006, 0.01], [0.006, 0.09], [0.04, 0.12], [0.045, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 16), mat('#f7f2ff', 0.05, 0.1, { transparent: true, opacity: 0.55 }));
  copa.position.set(0.56, 0.64, -0.72); s.add(copa);
  s.add(caja(0.36, 0.38, 0.7, mMadera, -0.86, 0.19, -0.45, 0.03)); // jardinera con plantas y un arbolito
  for (let k = 0; k < 14; k++) {
    const h = 0.18 + rr() * 0.4;
    const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.05 + rr() * 0.045, h, 6), mat(['#2f6b34', '#3f8a3e', '#5aa050', '#2b5a2f'][k % 4], 0.8));
    hoja.position.set(-0.86 + (rr() - 0.5) * 0.26, 0.38 + h / 2, -0.45 + (rr() - 0.5) * 0.6); hoja.rotation.set((rr() - 0.5) * 0.6, 0, (rr() - 0.5) * 0.6); s.add(hoja);
  }
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.6, 8), mMadera); tronco.position.set(-0.9, 0.68, -0.25); s.add(tronco);
  const copaArbol = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat('#3f7d3a', 0.85)); copaArbol.position.set(-0.9, 1.06, -0.25); s.add(copaArbol);
  const placa = cartel(0.8, 0.3, (x, W, H) => {
    x.fillStyle = '#2a1a10'; x.fillRect(0, 0, W, H); x.strokeStyle = C.oro; x.lineWidth = 6; x.strokeRect(6, 6, W - 12, H - 12);
    x.fillStyle = C.oro; x.textAlign = 'center'; x.font = fuente(800, H * 0.3, 'Panchang'); x.fillText(`SUITE ${asiento}`, W / 2, H * 0.48);
    x.font = fuente(500, H * 0.15); x.fillText('GRAVEDAD COMPLETA · MENÚ DEL CHEF', W / 2, H * 0.78);
  }, { px: 400 });
  placa.position.set(0, 0.62, 0.96); s.add(placa); // al pie de la cama, se ve al mirar atrás

  luzM(o, 0, '#ffd7a0', 0.8, 7, mia.centro.clone().add(V(0, 1.9, 0.5))); // en lo alto de la cúpula, sobre la cama (no encima del casco)
  luzM(o, 1, '#ffc27a', 3, 16, P(mia.r, Math.PI + 0.12, 5));
  const cabeza = mia.centro.clone().add(V(0, 1.22, -0.5));
  const centro = haciaPlaneta(cabeza, 24);
  const n = o.aNave, rU = mia.r * K;
  return {
    grupo: g,
    ruta: [V(0, ANILLO_Y + 3.4, -(rU + 7)), V(0, ANILLO_Y + 1.8, -(rU + 2.4)), V(0, ANILLO_Y + 0.95, -(rU + 0.95)), n(cabeza.clone().add(V(0, 0.12, -0.2))), n(cabeza)],
    miras: [V(0, ANILLO_Y + 0.5, -rU), V(0, ANILLO_Y + 0.4, -rU), V(0, ANILLO_Y + 0.3, -rU + 0.4), n(cabeza.clone().add(V(0.4, -0.2, -2))), n(centro)],
    pov: { pos: n(cabeza), centro: n(centro), izq: n(cabeza.clone().add(V(-12, -1.0, 3))), der: n(cabeza.clone().add(V(12, -1.0, 3))) },
    suites,
    propio: { pos: mia.centro.clone().add(V(0, 0.42, -0.45)), rotY: Math.PI / 2, traje: '#f1e6cc', detalle: C.oro },
    techo: 1.7, distTercera: 1.1, // al verse, la cámara se queda dentro de la cúpula (afuera, los vidrios se ven lechosos)
    actualizar() {},
  };
}

// ---------- ÓRBITA, LUNA y TURISTA: pisos circulares de filas ----------
// Las filas van de la ventana hacia el núcleo y dan la vuelta al piso; todos miran hacia la fila 1 (hacia +x en el
// asiento del pasajero). dist: distancia de cada columna a la pared (m). Clase Luna es una Órbita de noche
// (5 por fila: 2 junto a la ventana, pasillo y 3, techo de estrellas, manta y chocolate). Turista no tiene ventanas:
// tiene una ventanita al motor en el piso del pasillo cada 3 filas.
const DISENO = {
  orbita: { dist: [0.55, 1.25, 2.55, 3.25], corte: 2, porPiso: 38, filas: 75, vuelta: true },
  luna: { dist: [0.5, 1.15, 2.6, 3.25, 3.9], corte: 2, porPiso: 40, filas: 40, vuelta: true },
  turista: { dist: [0.4, 0.88, 1.36, 2.54, 3.02, 3.5], corte: 3, porPiso: 67, filas: 67, paso: 0.78 },
};
const VENTANAS = { orbita: { n: 28, ancho: 1.6, alto: 1.7, y: 1.4 }, luna: { n: 28, ancho: 1.05, alto: 1.1, y: 1.38 } };

function filas(clase, o) {
  const { asiento, ocupantes, usuario, ocupados } = o;
  const esT = clase === 'turista', esL = clase === 'luna', esO = clase === 'orbita';
  const D = DISENO[clase], c = CLASES[clase], a0 = leerAsiento(asiento), S = SECCIONES[clase];
  const pisoN = esO && a0.fila > D.porPiso ? 1 : 0;
  const g = enPiso(o, esO ? S.pisos[pisoN] : S.piso);
  const alto = S.alto, animar = [];
  const primera = pisoN * D.porPiso + 1, ultima = Math.min(D.filas, primera + D.porPiso - 1);
  const rPas = RW - (D.dist[D.corte - 1] + D.dist[D.corte]) / 2; // radio del pasillo
  const DA = D.vuelta ? (Math.PI * 2) / D.porPiso : D.paso / rPas; // ángulo entre filas
  const angulo = (f) => {
    let d = f - a0.fila;
    if (D.vuelta) { const N = D.porPiso; d = ((((d + N / 2) % N) + N) % N) - N / 2; }
    return Math.PI + d * DA;
  };
  const aH = Math.PI - DA / 2; // hueco entre tu fila y la de adelante
  // la ventana queda frente a tu fila (por ella se ve el planeta y por ella entra la cámara); Turista no tiene ventanas
  const aV = VENTANAS[clase] ? Math.PI : aH;
  const mPared = esT ? '#5b5750' : esL ? '#2a2b52' : '#ddd4c2';
  const mPiso = esT ? mat('#3a3631', 0.95) : esL ? mat('#3b2a3a', 0.98) : mat('#5d6470', 0.95);
  const r = mulberry32(semilla(asiento));

  // --- casco del piso: pared exterior (con ventanas en Órbita y Luna), piso, techo y núcleo ---
  const V_ = VENTANAS[clase];
  const per = (2 * Math.PI * RW) / (V_ ? V_.n : 32);
  const texPared = texturaVuelta(`pared-${clase}`, 128, Math.round(128 * alto / per), V_ ? V_.n : 32, (x, W, H) => {
    x.fillStyle = mPared; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, H * 0.92, W, H * 0.08); x.fillRect(W - 3, 0, 3, H); // zócalo y junta de paneles
    if (!V_) return;
    const cx = W / 2, cy = H * (1 - V_.y / alto), rx = (V_.ancho / per) * W / 2, ry = (V_.alto / alto) * H / 2;
    x.fillStyle = esL ? '#c9a45a' : '#2c3038'; x.beginPath(); x.ellipse(cx, cy, rx * 1.14, ry * 1.12, 0, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill();
  });
  const matPared = new THREE.MeshStandardMaterial({ map: texPared, roughness: 0.85, side: THREE.BackSide, alphaTest: 0.5 });
  const nV = V_ ? V_.n : 32;
  const pared = new THREE.Mesh(new THREE.CylinderGeometry(RW, RW, alto, nV * 4, 1, true, aV - Math.PI / nV, Math.PI * 2), matPared);
  pared.position.y = alto / 2; g.add(pared);
  if (V_) {
    const vidrio = new THREE.Mesh(new THREE.CylinderGeometry(RW - 0.04, RW - 0.04, V_.alto * 1.1, nV * 4, 1, true),
      new THREE.MeshStandardMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.06, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
    vidrio.position.y = V_.y; g.add(vidrio);
  }
  const corona = (r1, r2, m, y, abajo) => { const a = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 128, 1), m); a.rotation.x = abajo ? -Math.PI / 2 : Math.PI / 2; a.position.y = y; g.add(a); return a; };
  corona(RN, RW, mPiso, 0, true);
  corona(rPas - 0.32, rPas + 0.32, mat(esT ? '#2d2a26' : esL ? '#4a3550' : '#47505e', 0.9), 0.004, true); // alfombra del pasillo
  corona(RN + 0.4, RN + 1.6, mat(esT ? '#2d2a26' : esL ? '#4a3550' : '#47505e', 0.9), 0.004, true); // pasillo del núcleo
  if (esL) corona(RN, RW, materialCieloLuna(), alto, false); // techo de estrellas, de pared a pared
  else corona(RN, RW, mat(mPared, 0.85, 0, { emissive: new THREE.Color(mPared).multiplyScalar(esT ? 0.12 : 0.3) }), alto, false); // techo claro, no café
  // núcleo: ascensor y escaleras, con el letrero de la clase (4 veces alrededor)
  const perN = (2 * Math.PI * RN) / 4;
  const texN = texturaVuelta(`nucleo-${clase}-${pisoN}`, 1024, Math.round(1024 * alto / perN), 4, (x, W, H) => {
    x.fillStyle = esT ? '#4D0C10' : esL ? '#16143a' : '#1d2633'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(W * 0.04, H * 0.2, W * 0.22, H * 0.8); // puerta del ascensor
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(W * 0.149, H * 0.2, 2, H * 0.8);
    x.textAlign = 'center'; x.fillStyle = C.mant; x.font = fuente(500, H * 0.045); x.fillText('ASCENSOR', W * 0.15, H * 0.16);
    const cx = W * 0.63;
    if (esT) {
      x.fillStyle = C.oro; x.font = fuente(800, H * 0.075, 'Panchang'); x.fillText('CADA EPISODIO', cx, H * 0.2);
      x.font = fuente(800, H * 0.12, 'Panchang'); x.fillText('3 DE AQUÍ', cx, H * 0.34);
      x.font = fuente(800, H * 0.068, 'Panchang'); x.fillText('SUBEN A CLASE ANILLO', cx, H * 0.45);
      x.fillStyle = '#f2c14e'; x.fillRect(W * 0.32, H * 0.55, W * 0.62, H * 0.09); x.fillRect(W * 0.32, H * 0.67, W * 0.62, H * 0.09);
      x.fillStyle = '#1e1209'; x.font = fuente(500, H * 0.045); x.fillText('RUIDO DE MOTORES: INCLUIDO', cx, H * 0.61); x.fillText('BARRAS DE PROTEÍNA · SABOR: SÍ', cx, H * 0.73);
      x.fillStyle = '#f2e6c8'; x.font = fuente(500, H * 0.042); x.fillText('BAÑO: 1 PARA 200 · AL FONDO', cx, H * 0.86);
    } else {
      if (esL) dibujarLuna(x, cx, H * 0.32, H * 0.14); else dibujarPlaneta(x, cx, H * 0.33, H * 0.12);
      x.fillStyle = esL ? LAVANDA : C.plata; x.font = fuente(800, H * 0.085, 'Panchang'); x.fillText(esL ? 'CLASE LUNA' : 'CLASE ÓRBITA', cx, H * 0.62);
      x.fillStyle = esL ? '#f6c9a0' : C.azul; x.font = fuente(500, H * 0.05);
      x.fillText(esO ? `PISO ${pisoN + 1} DE 2 · FILAS ${primera} A ${ultima}` : `FILAS 1 A ${D.filas}`, cx, H * 0.74);
    }
  });
  const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(RN, RN, alto, 64, 1, true, Math.PI - Math.PI / 4), new THREE.MeshStandardMaterial({ map: texN, roughness: 0.7 }));
  nucleo.position.y = alto / 2; g.add(nucleo);
  // luces del techo: líneas que siguen la curva del piso
  if (!esT) for (const rl of esL ? [RN + 0.25] : [rPas, RN + 1.0]) {
    const l = new THREE.Mesh(new THREE.TorusGeometry(rl, 0.03, 4, 192), new THREE.MeshBasicMaterial({ color: '#fff3dc', toneMapped: false }));
    l.rotation.x = Math.PI / 2; l.position.y = alto - 0.03; g.add(l);
  }

  // --- asientos, pasajeros y nametags ---
  const asientosTodos = [], conPantalla = [], cerca = [], lejos = [];
  // la fila de adelante (en un piso de vuelta completa, la de adelante de la primera es la última)
  const filaAdelante = a0.fila - 1 >= primera ? a0.fila - 1 : D.vuelta && ultima - primera + 1 === D.porPiso ? ultima : null;
  const extras = []; // asientos con algo encima (bandeja, manta…)
  let lugarPropio = null, rPropio = 0, miPantalla = null;
  const hip = esT ? 0.48 : 0.52;
  const escAsiento = esL ? V(1, 1, 0.93) : UNO;
  const limite = o.calidad === 'baja' ? 16 : Infinity;
  for (let f = primera; f <= ultima; f++) {
    const a = angulo(f), d = Math.round((a - Math.PI) / DA);
    if (Math.abs(d) > limite) continue;
    for (let col = 0; col < c.porFila; col++) {
      const cod = codigoAsiento(clase, (f - 1) * c.porFila + col);
      const rad = RW - D.dist[col];
      const L = lugar(P(rad, a), a - Math.PI, escAsiento);
      asientosTodos.push(L);
      // la pantalla del asiento de adelante, en tu columna, dice tu nombre
      if (f === filaAdelante && col === a0.col) miPantalla = L; else conPantalla.push(L);
      const sentado = lugar(P(rad, a, hip), a - Math.PI);
      if (cod === asiento.toUpperCase()) { lugarPropio = P(rad, a, hip); rPropio = rad; extras.push(L); continue; }
      if (!(ocupados ? ocupados.has(cod) : true)) continue;
      extras.push(L);
      (Math.abs(d) <= 3 ? cerca : lejos).push(sentado);
      const oc = ocupantes.get(cod);
      if (oc && Math.abs(d) <= 1) { const nt = crearNametag(oc.usuario, tagDe(clase)); nt.position.copy(P(rad, a, hip + 1.08 + (col % 2) * 0.13)); g.add(nt); }
    }
  }
  const mA = esT ? mat('#6f6a62', 0.85) : mat('#8e949e', 0.45, 0.35), mB = esT ? mat('#6d665c', 0.9) : esL ? mat('#b7a6e8', 0.5) : mat(C.azul, 0.5);
  const partes = esT
    ? [[pieza(0.42, 0.08, 0.44, 0.05, 0.44, 0, { radio: 0.02 }), mA], [pieza(0.06, 0.62, 0.44, -0.17, 0.78, 0, { radio: 0.02 }), mA],
      [pieza(0.1, 0.44, 0.06, 0, 0.22, 0), mat('#3a3631', 0.8)], [pieza(0.02, 0.12, 0.05, -0.21, 0.66, 0.08), mat('#c9a227', 0.6)]] // barra de proteína en el bolsillo
    : [[pieza(0.62, 0.14, 0.62, 0.08, 0.46, 0, { radio: 0.06 }), mA], [pieza(0.12, 0.78, 0.62, -0.26, 0.89, 0, { rz: 0.18, radio: 0.06 }), mA],
      [pieza(0.14, 0.08, 0.64, -0.31, 1.27, 0, { radio: 0.03 }), mB], [pieza(0.5, 0.1, 0.1, 0.06, 0.66, 0.3, { radio: 0.03 }), mB], [pieza(0.5, 0.1, 0.1, 0.06, 0.66, -0.3, { radio: 0.03 }), mB]];
  for (const [p, m] of partes) g.add(repetir(p.g, m, asientosTodos, p.m));
  if (!esT) {
    // pantalla en el respaldo (mira hacia la fila de atrás); la del asiento de adelante dice tu nombre
    const pantallaTex = (txt, sub) => (x, W, H) => {
      x.fillStyle = esL ? '#0c0d26' : '#0b1220'; x.fillRect(0, 0, W, H);
      if (esL) dibujarLuna(x, W * 0.5, H * 0.4, H * 0.18); else dibujarPlaneta(x, W * 0.5, H * 0.42, H * 0.18);
      x.fillStyle = esL ? LAVANDA : C.plata; x.textAlign = 'center'; x.font = fuente(500, H * 0.12); x.fillText(txt, W / 2, H * 0.78);
      x.font = fuente(500, H * 0.09); x.fillStyle = esL ? '#f6c9a0' : C.azul; x.fillText(sub, W / 2, H * 0.92);
    };
    const enRespaldo = new THREE.Matrix4().compose(V(-0.35, 1.0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), UNO);
    const comun = esL ? pantallaComun('luna', 0.36, 0.24, pantallaTex('CLASE LUNA', 'CHOCOLATE: LISTO'), { px: 500 }) : pantallaComun('orbita', 0.36, 0.24, pantallaTex('SATURNOID', 'CLASE ÓRBITA'), { px: 500 });
    g.add(repetir(comun.geometry, comun.material, conPantalla, enRespaldo));
    if (miPantalla) {
      const pan = cartel(0.36, 0.24, pantallaTex(`@${usuario}`, `ASIENTO ${asiento}`), { px: 500 });
      pan.applyMatrix4(_m.multiplyMatrices(miPantalla, enRespaldo)); g.add(pan);
    }
  }
  if (esO) { // comida caliente en la bandeja
    g.add(repetir(new THREE.BoxGeometry(0.26, 0.02, 0.36), mat('#dddddd', 0.4), extras, new THREE.Matrix4().makeTranslation(0.38, 0.74, 0)));
    g.add(repetir(new THREE.CylinderGeometry(0.08, 0.07, 0.03, 18), mat('#ffffff', 0.3), extras, new THREE.Matrix4().makeTranslation(0.38, 0.77, -0.06)));
    g.add(repetir(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c0592f', 0.6), extras, new THREE.Matrix4().makeTranslation(0.38, 0.78, -0.06)));
  }
  if (esL) { // manta tejida doblada en el asiento y una taza de chocolate caliente en el apoyabrazos
    const G = geosFilas(), mManta = materialManta(), mTaza = mat('#f4ede0', 0.35), mChoco = mat('#4a2412', 0.4);
    g.add(repetir(G.manta, mManta, asientosTodos, new THREE.Matrix4().makeTranslation(0.1, 0.55, 0)));
    g.add(repetir(G.mantaCaida, mManta, asientosTodos, new THREE.Matrix4().makeTranslation(0.32, 0.46, 0)));
    g.add(repetir(G.taza, mTaza, extras, new THREE.Matrix4().makeTranslation(0.12, 0.75, 0.3)));
    g.add(repetir(G.choco, mChoco, extras, new THREE.Matrix4().makeTranslation(0.12, 0.786, 0.3)));
    // vapor en las tazas de cerca
    const mVapor = new THREE.MeshBasicMaterial({ map: texturaVapor(), transparent: true, depthWrite: false, opacity: 0.3, side: THREE.DoubleSide, forceSinglePass: true });
    animar.push((t) => { mVapor.opacity = 0.22 + 0.1 * Math.sin(t * 1.7); });
    for (let df = -1; df <= 1; df++) for (let col = 0; col < c.porFila; col++) {
      const f = a0.fila + df; if (f < primera || f > ultima || (col + f) % 2) continue;
      const a = angulo(f), base = P(RW - D.dist[col], a);
      for (const giro of [0, Math.PI / 2]) {
        const v = new THREE.Mesh(G.vapor, mVapor); v.applyMatrix4(lugar(base, a - Math.PI, escAsiento).multiply(lugar(V(0.12, 0.89, 0.3), giro))); g.add(v);
      }
    }
    // techo de estrellas: marco de latón, nervios y focos cálidos en el borde
    const laton = mat('#c9a45a', 0.55, 0.45); // mate: sin destellos junto a la luz
    for (const rl of [RN + 0.6, (RN + RW) / 2, RW - 0.3]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rl, 0.035, 5, 192), laton); t.rotation.x = Math.PI / 2; t.position.y = alto - 0.03; g.add(t); }
    const nervios = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; nervios.push(lugar(P((RN + RW) / 2, a, alto - 0.03), a - Math.PI / 2)); }
    g.add(repetir(new THREE.BoxGeometry(RW - RN, 0.05, 0.05), laton, nervios));
    const G2 = geosFilas(), mFocos = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: '#ffd08a', toneMapped: false }));
    const focos = [[], []]; const nF = Math.round((2 * Math.PI * (RW - 0.5)) / 0.55);
    for (let k = 0; k < nF; k++) { const a = (k / nF) * Math.PI * 2; focos[k % 2].push(lugar(P(RW - 0.5, a, alto - 0.08))); }
    focos.forEach((l, i) => g.add(repetir(G2.foco, mFocos[i], l)));
    animar.push((t) => mFocos.forEach((m, i) => m.color.setRGB(1, 0.82, 0.55).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.1 + i * 2.4))));
  }
  // pasajeros: de cerca con todo el detalle; de lejos, livianos (sin piernas: las tapan los asientos)
  const traje = esT ? '#b0602e' : '#9aa3ae', detalle = esT ? '#4a220e' : esL ? '#7d6bc4' : C.azul;
  g.add(crearMultitud(cerca, { traje, detalle, semilla: semilla(asiento) }));
  g.add(crearMultitud(lejos, { traje, detalle, liviana: true, semilla: semilla(asiento) + 7, piezas: ['torso', 'casco', 'visor', 'franja', 'brazo'] }));

  // --- Turista: tubos que parpadean, tuberías, ventanitas al motor, "ventana no incluida" y el baño al fondo ---
  let tuboMat = null, luzFuego = null;
  if (esT) {
    tuboMat = new THREE.MeshBasicMaterial({ color: '#e8f4ff' });
    const tubos = []; const nT = Math.round((2 * Math.PI * rPas) / 2.3);
    for (let k = 0; k < nT; k++) { const a = Math.PI + (k / nT) * Math.PI * 2; tubos.push(lugar(P(rPas, a, alto - 0.05), a - Math.PI)); }
    g.add(repetir(new THREE.BoxGeometry(1.2, 0.05, 0.08), tuboMat, tubos));
    for (let k = 0; k < 4; k++) {
      const tubo = new THREE.Mesh(new THREE.TorusGeometry(RW - 0.18 - (k % 2) * 0.12, 0.05 + k * 0.012, 8, 160), mat(['#7a6e5f', '#8c3a2e', '#6b6f73', '#a8873f'][k], 0.5, 0.5));
      tubo.rotation.x = Math.PI / 2; tubo.position.y = alto - 0.12 - k * 0.11; g.add(tubo);
    }
    // ventanitas al motor encendido, en el piso del pasillo cada 3 filas (una, entre tu fila y la de adelante)
    const uFuego = { uT: { value: 0 } };
    const matFuego = new THREE.ShaderMaterial({
      uniforms: uFuego, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uT; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vUv - 0.5; float r = length(p)*2.0; float a = atan(p.y, p.x);
          float rem = n(vec2(a*3.0 + uT*2.5, r*5.0 - uT*7.0)) * 0.6 + n(vec2(a*7.0 - uT*4.0, r*11.0 - uT*13.0)) * 0.4;
          float calor = clamp(1.25 - r*1.1 + rem*0.55, 0.0, 1.6);
          vec3 c = mix(vec3(0.35,0.05,0.0), vec3(1.0,0.45,0.08), smoothstep(0.2,0.8,calor));
          c = mix(c, vec3(1.0,0.92,0.6), smoothstep(0.95,1.4,calor));
          c *= 1.0 - smoothstep(0.92,1.0,r)*0.6;
          gl_FragColor = vec4(c*1.6, 1.0);
        }`,
    });
    const gFuego = new THREE.CircleGeometry(0.3, 48).rotateX(-Math.PI / 2);
    const laton = mat('#c9a45a', 0.35, 0.8);
    const aros = [];
    for (let m = -30; m <= 30; m++) {
      const fila = a0.fila + 3 * m; if (fila < 1 || fila > ultima) continue;
      const aG = angulo(fila) - DA / 2;
      const fuego = new THREE.Mesh(gFuego, matFuego); fuego.position.copy(P(rPas, aG, 0.006)); g.add(fuego);
      aros.push(lugar(P(rPas, aG, 0.02)));
    }
    g.add(repetir(new THREE.TorusGeometry(0.31, 0.035, 10, 40).rotateX(Math.PI / 2), laton, aros));
    const geoTornillo = new THREE.SphereGeometry(0.014, 8, 6), motor = P(rPas, aH, 0);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const tor = new THREE.Mesh(geoTornillo, laton); tor.position.copy(motor).add(V(Math.cos(a) * 0.31, 0.05, Math.sin(a) * 0.31)); g.add(tor); }
    const placa = pantallaComun('t-placa', 0.62, 0.11, (x, W, H) => { x.fillStyle = '#c9a45a'; x.fillRect(0, 0, W, H); x.fillStyle = '#2a1608'; x.textAlign = 'center'; x.font = fuente(500, H * 0.5); x.fillText('★ VISTA AL MOTOR ★', W / 2, H * 0.68); }, { px: 1000 });
    placa.material.color.setScalar(0.85);
    placa.applyMatrix4(lugar(P(rPas, aH, 0.008), aH - Math.PI).multiply(new THREE.Matrix4().compose(V(-0.45, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2)), UNO)));
    g.add(placa);
    luzFuego = luzM(o, 1, '#ff8a3d', 0.35, 3.5, P(rPas, aH, 0.35));
    animar.push((t) => { uFuego.uT.value = t; luzFuego.intensity = 0.35 * (0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3)); });
    // "aquí iría una ventana" (la de Turista está en el piso), en la pared cada 6 filas
    const falsa = pantallaComun('t-falsa', 1.1, 0.7, (x, W, H) => {
      x.fillStyle = '#5b5750'; x.fillRect(0, 0, W, H);
      x.setLineDash([18, 12]); x.strokeStyle = '#f2e6c8'; x.lineWidth = 6; x.beginPath(); x.ellipse(W / 2, H / 2, W * 0.36, H * 0.38, 0, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#f2e6c8'; x.textAlign = 'center'; x.font = fuente(500, H * 0.1); x.fillText('VENTANA:', W / 2, H * 0.42); x.fillText('NO INCLUIDA', W / 2, H * 0.56);
      x.fillStyle = C.oro; x.font = fuente(500, H * 0.065); x.fillText('LA TUYA ESTÁ EN EL PISO ↓', W / 2, H * 0.7);
    }, { emisivo: false, px: 300 });
    const falsas = []; for (let f = 1; f <= ultima; f += 6) { const a = angulo(f) - DA / 2; falsas.push(lugar(P(RW - 0.03, a, 1.45), a + Math.PI)); }
    g.add(repetir(falsa.geometry, falsa.material, falsas));
    // el baño (1 para 200) cierra la vuelta: después de la fila 67 y antes de la fila 1
    const muro = (a, mira, clave, dibujar) => {
      const m = pantallaComun(clave, RW - RN, alto, dibujar, { emisivo: false, px: 120 });
      m.applyMatrix4(lugar(P((RW + RN) / 2, a, alto / 2), a + mira)); m.material.side = THREE.DoubleSide; g.add(m);
    };
    const letrero = (x, W, H, l1, l2, l3) => {
      x.fillStyle = '#5b5750'; x.fillRect(0, 0, W, H); x.fillStyle = '#4a4640'; x.fillRect(W * 0.55, H * 0.18, W * 0.16, H * 0.82);
      x.fillStyle = '#111'; x.fillRect(W * 0.12, H * 0.22, W * 0.34, H * 0.3);
      x.fillStyle = '#ff4b3e'; x.textAlign = 'center'; x.font = fuente(500, H * 0.1); x.fillText(l1, W * 0.29, H * 0.35); x.font = fuente(500, H * 0.07); x.fillText(l2, W * 0.29, H * 0.46);
      x.fillStyle = '#f2e6c8'; x.font = fuente(500, H * 0.05); x.fillText(l3, W * 0.63, H * 0.14);
    };
    muro(angulo(ultima) + DA * 0.6, -Math.PI / 2, 't-bano', (x, W, H) => letrero(x, W, H, 'BAÑO 1/200', 'FILA: 147', 'BAÑO'));
    muro(angulo(1) - DA * 0.6, Math.PI / 2, 't-bodega', (x, W, H) => letrero(x, W, H, 'FILA 1', 'NO HAY MÁS', 'BODEGA'));
  }

  // --- luces: una en el eje (alumbra parejo toda la vuelta, sin sombras) y otra cerca de tu asiento ---
  const BASE_LUZ = esT ? 10 : esL ? 7 : 12;
  const luzT = luzM(o, 0, esT ? '#dfefff' : esL ? '#ffc98a' : '#f6f1e8', BASE_LUZ, 24, V(0, esT ? alto - 0.3 : 1.9, 0));
  if (esL) luzM(o, 1, '#9fb2ff', 0.35, 7, P(rPas, Math.PI + 0.1, alto - 0.3));
  else if (esO) luzM(o, 1, '#fff3dc', 0.18, 6, P(rPas, Math.PI + 0.05, alto - 0.2));

  // --- cámara: entra por la ventana del hueco de adelante, pasa sobre las cabezas y se sienta ---
  // en π el "adelante" del asiento es +x; la cabeza un poco erguida: al girar se ve por encima del respaldo
  const cabeza = lugarPropio.clone().add(V(0.05, esT ? 0.9 : 0.88, 0));
  const adelante = P(rPas - 0.4, Math.PI - 0.6, 1.1), atras = P(rPas - 0.4, Math.PI + 0.6, 1.1);
  const ventana = haciaPlaneta(cabeza, 26);
  let pov;
  if (esT) pov = { centro: P(rPas, Math.PI - 0.45, 1.15), izq: P(rPas, aH, 0.05), der: atras };
  else if (esL) pov = { centro: P(rPas - 1.2, Math.PI - 0.3, 2.3), izq: ventana, der: atras };
  else pov = { centro: ventana, izq: adelante, der: atras };
  const yV = Math.min(alto - 0.45, 1.95);
  const yE = V_ ? V_.y + V_.alto * 0.3 : 1.6; // entra por la parte alta de la ventana, sobre las cabezas
  const ruta = [P(RW + 22, aV, 2.6), P(RW + 3.5, aV, yE), P(RW - 0.7, aV, yE), P(rPropio + 0.15, (aV + aH) / 2, yV),
    P(rPropio, Math.PI - 0.012, cabeza.y + 0.15), cabeza];
  const miras = [V(0, 1.5, 0), V(0, 1.4, 0), P(rPropio, aH - 0.08, 1.0), P(rPropio, Math.PI, 0.6), pov.centro.clone().lerp(adelante, 0.5), pov.centro];
  const n = o.aNave;
  return {
    grupo: g, ruta: ruta.map(n), miras: miras.map(n),
    pov: { pos: n(cabeza), centro: n(pov.centro), izq: n(pov.izq), der: n(pov.der) },
    sacudida: esT ? 0.006 : 0,
    propio: { pos: lugarPropio, rotY: 0, traje, detalle }, techo: alto - 0.15,
    actualizar(t) {
      for (const f of animar) f(t);
      if (!esT) return;
      // parpadeo determinista: casi siempre prendido, con cortes cortos
      const f = Math.sin(t * 13.1) + Math.sin(t * 7.3 + 1.2) + Math.sin(t * 29.7 + 0.4);
      const on = f > -1.9 ? 1 : 0.15;
      luzT.intensity = BASE_LUZ * on * (0.92 + 0.08 * temblor(t, 9));
      tuboMat.color.setScalar(on > 0.5 ? 0.95 : 0.2);
    },
  };
}

// ---------- entrada ----------
// opciones: { asiento, usuario, ocupantes: Map(codigo → { usuario }), ocupados?: Set(codigo), calidad?,
//             info: { pasajeros, investigadora, nivel, nivelNombre, lineaMeta } }
// ocupados: los asientos con dueño de esa clase (los demás se ven vacíos). Sin él, la clase se ve llena (videos).
export function crearInterior(clase, opciones) {
  const o = { ocupantes: new Map(), info: {}, ...opciones };
  const r = clase === 'cabina' ? cabina(o) : clase === 'anillo' ? anillo(o) : filas(clase, o);
  r.clase = clase;
  // los nametags tienen tamaño fijo en pantalla: se les quita la escala del interior
  r.etiquetas = []; r.grupo.traverse((n) => { if (n.isSprite) { n.scale.divideScalar(K); r.etiquetas.push(n); } });
  // el pasajero que buscó, sentado en su asiento con su nametag "TÚ": solo se ve al verse desde afuera (r.verme)
  if (r.propio) {
    const { pos, rotY, traje, detalle } = r.propio;
    const yo = new THREE.Group(); yo.visible = false;
    const p = crearPasajero(traje, detalle); p.position.copy(pos); p.rotation.y = rotY; yo.add(p);
    const nt = crearNametag(o.usuario || 'tú', 'tu', { etiqueta: 'TÚ' }); nt.scale.divideScalar(K); nt.position.copy(pos).add(V(0, 1.14, 0)); yo.add(nt);
    r.grupo.add(yo);
    r.verme = (k) => { yo.visible = k > 0.15; nt.material.opacity = clamp((k - 0.15) / 0.5); };
  }
  if (r.pov) {
    r.pov.techo = Number.isFinite(r.techo) ? o.aNave(V(0, r.techo, 0)).y : null;
    if (r.distTercera) r.pov.distTercera = r.distTercera * K;
  }
  r.liberar = () => {
    for (const l of o.luces || []) l.intensity = 0;
    r.grupo.traverse((n) => {
      if (n.userData.liberar) n.userData.liberar();
      if (n.isInstancedMesh) n.dispose();
      if (n.geometry && !n.geometry.userData?.compartida) n.geometry.dispose?.();
      if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { if (m.userData.compartida) return; if (!m.map?.userData.compartida) m.map?.dispose(); m.dispose(); }); }
    });
    r.grupo.removeFromParent();
  };
  return r;
}
