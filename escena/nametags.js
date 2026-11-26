// Nametags estilo Minecraft: rectángulo oscuro semitransparente, texto claro, siempre mirando a la cámara.
// Color del texto por clase: dorado (Anillo), plateado (Órbita), lavanda (Luna), azul (cabina), blanco (Turista).
// También los pasajeros: figura sentada con casco y visor (sin caras: en los videos las caras fallaban).
import * as THREE from 'three';
import { lienzo, C } from './util.js';

const ESTILOS = {
  oro: { texto: '#F6C453', borde: 'rgba(246,196,83,.55)' },
  plata: { texto: '#E3E8EF', borde: 'rgba(227,232,239,.45)' },
  lavanda: { texto: '#CDBCFF', borde: 'rgba(205,188,255,.5)' },
  cabina: { texto: C.azul, borde: 'rgba(199,216,238,.45)' },
  turista: { texto: '#FFFFFF', borde: null },
  investigadora: { texto: C.mant, borde: 'rgba(250,236,178,.6)' },
  tu: { texto: '#1e1209', fondo: 'rgba(250,236,178,.95)', borde: null },
};

export function crearNametag(texto, estilo = 'turista', { alto = 0.05, etiqueta = null, fijo = true } = {}) {
  const e = ESTILOS[estilo] || ESTILOS.turista;
  const px = 64, padX = 26, padY = 14;
  const medir = lienzo(8, 8).getContext('2d');
  medir.font = `500 ${px}px "DM Mono", monospace`;
  const anchoTexto = Math.ceil(medir.measureText(texto).width);
  let anchoEtq = 0;
  if (etiqueta) { medir.font = `500 ${px * 0.45}px "DM Mono", monospace`; anchoEtq = Math.ceil(medir.measureText(etiqueta).width); }
  const W = Math.max(anchoTexto, anchoEtq) + padX * 2, H = px + padY * 2 + (etiqueta ? px * 0.6 : 0);
  const cv = lienzo(W, H), x = cv.getContext('2d');
  x.fillStyle = e.fondo || 'rgba(0,0,0,.52)'; x.fillRect(0, 0, W, H);
  if (e.borde) { x.strokeStyle = e.borde; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, H - 4); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (etiqueta) {
    x.font = `500 ${px * 0.45}px "DM Mono", monospace`; x.fillStyle = e.texto; x.globalAlpha = 0.8;
    x.fillText(etiqueta, W / 2, padY + px * 0.3); x.globalAlpha = 1;
  }
  x.font = `500 ${px}px "DM Mono", monospace`; x.fillStyle = e.texto;
  x.fillText(texto, W / 2, H - padY - px / 2 + 4);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, sizeAttenuation: !fijo, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(alto * (W / H) * (H / (px + padY * 2)), alto * (H / (px + padY * 2)), 1);
  s.renderOrder = 20;
  s.userData.liberar = () => { tex.dispose(); mat.dispose(); };
  return s;
}

// Geometrías del pasajero: detalladas (de cerca) y livianas (multitudes lejanas: ~6 veces menos triángulos).
const geo = {}, geoL = {};
function geos(liviana = false) {
  const G = liviana ? geoL : geo;
  if (G.torso) return G;
  const [cap, rad, esf, esfV] = liviana ? [1, 6, [9, 6], [9, 4]] : [4, 12, [20, 14], [20, 12]];
  G.torso = new THREE.CapsuleGeometry(0.19, 0.32, cap, rad);
  G.casco = new THREE.SphereGeometry(0.17, ...esf);
  G.visor = new THREE.SphereGeometry(0.135, ...esfV, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.4);
  G.muslo = new THREE.CapsuleGeometry(0.085, 0.3, liviana ? 1 : 4, liviana ? 5 : 8);
  G.brazo = new THREE.CapsuleGeometry(0.065, 0.3, liviana ? 1 : 4, liviana ? 5 : 8);
  G.franja = new THREE.TorusGeometry(0.17, 0.02, liviana ? 4 : 6, liviana ? 10 : 20);
  for (const k in G) G[k].userData.compartida = true;
  return G;
}
const matVisor = new THREE.MeshStandardMaterial({ color: '#0f1724', roughness: 0.08, metalness: 0.9, emissive: new THREE.Color('#29486e'), emissiveIntensity: 0.35 });
matVisor.userData.compartida = true;

// Las piezas del pasajero sentado (mirando a +x local, origen = asiento a la altura de la cadera, cabeza a ~0,75 m).
// Las usan igual el pasajero suelto y las multitudes: así son idénticos.
// [geometría, material ('traje' | 'detalle' | 'visor'), posición, rotación, escala]
const PIEZAS = [
  ['torso', 'traje', [-0.04, 0.33, 0], [0, 0, 0.12]],
  ['casco', 'traje', [0, 0.76, 0]],
  ['visor', 'visor', [0, 0.76, 0], [0, Math.PI, 0], 1.3],
  ['franja', 'detalle', [0, 0.62, 0], [Math.PI / 2, 0, 0]],
  ...[-0.1, 0.1].flatMap((z) => [
    ['muslo', 'traje', [0.2, 0.05, z], [0, 0, Math.PI / 2]],
    ['muslo', 'traje', [0.4, -0.2, z]],
    ['brazo', 'traje', [0.08, 0.3, z * 2.3], [0, 0, 0.9]],
  ]),
];
const matrizPieza = ([, , p, r = [0, 0, 0], e = 1]) => new THREE.Matrix4().compose(
  new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(e, e, e));

export function crearPasajero(colorTraje = '#d9d2c3', colorDetalle = C.tinto) {
  const g = geos();
  const mats = { traje: new THREE.MeshStandardMaterial({ color: colorTraje, roughness: 0.7 }), detalle: new THREE.MeshStandardMaterial({ color: colorDetalle, roughness: 0.6 }), visor: matVisor };
  const p = new THREE.Group();
  for (const pz of PIEZAS) {
    const m = new THREE.Mesh(g[pz[0]], mats[pz[1]]);
    matrizPieza(pz).decompose(m.position, m.quaternion, m.scale);
    p.add(m);
  }
  return p;
}

/**
 * Muchos pasajeros sentados en pocos dibujos (una malla instanciada por pieza).
 * lugares: Matrix4 de cada asiento (cadera, mirando a +x). Cada traje varía un poco de tono (no son clones).
 * liviana: geometría con menos triángulos, para los que están lejos.
 */
export function crearMultitud(lugares, { traje = '#d9d2c3', detalle = C.tinto, liviana = false, semilla = 1, piezas = null } = {}) {
  const grupo = new THREE.Group();
  if (!lugares.length) return grupo;
  const g = geos(liviana);
  const mats = { traje: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), detalle: new THREE.MeshStandardMaterial({ color: detalle, roughness: 0.6 }), visor: matVisor };
  const base = new THREE.Color(traje), c = new THREE.Color(), m = new THREE.Matrix4();
  let h = semilla >>> 0;
  const azar = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return h / 4294967296; };
  const tonos = lugares.map(() => { const k = 0.86 + azar() * 0.2; return c.copy(base).multiplyScalar(k).offsetHSL((azar() - 0.5) * 0.03, 0, 0).clone(); });
  // de lejos las piernas casi nunca se ven (las tapan los asientos): se pueden omitir con piezas
  const usar = PIEZAS.filter((pz) => !piezas || piezas.includes(pz[0]));
  // una malla por pieza distinta (los dos muslos y las dos piernas van en la misma)
  const porClave = new Map();
  for (const pz of usar) { const k = `${pz[0]}|${pz[1]}`; if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(matrizPieza(pz)); }
  for (const [k, locales] of porClave) {
    const [nombre, tipo] = k.split('|');
    const im = new THREE.InstancedMesh(g[nombre], mats[tipo], lugares.length * locales.length);
    let n = 0;
    lugares.forEach((L, i) => {
      for (const loc of locales) {
        im.setMatrixAt(n, m.multiplyMatrices(L, loc));
        if (tipo === 'traje') im.setColorAt(n, tonos[i]);
        n++;
      }
    });
    im.computeBoundingSphere();
    grupo.add(im);
  }
  return grupo;
}
