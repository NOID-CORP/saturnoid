// Lo que cada pasajero lleva en las manos (lo que comentó en el reel): fuego, gato, celular, audífonos…
// crearObjeto(clave) devuelve un grupo en el marco del pasajero sentado (mira a +x, origen en la cadera, metros),
// o null si la clave no existe. Las manos quedan en x ≈ 0,26, y ≈ 0,18, z ≈ ±0,23.
// Si el objeto se mueve (el fuego, el corazón), trae userData.animar(t): determinista, el tiempo entra como parámetro.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
function malla(geo, m, pos = [0, 0, 0], rot = [0, 0, 0], esc = [1, 1, 1]) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(...pos); o.rotation.set(...rot); o.scale.set(...esc);
  return o;
}
const caja = (w, h, d, r = 0) => (r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
const esfera = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);

// Llama en forma de gota (torno): base redonda y punta arriba.
function gota(alto, ancho) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    pts.push(new THREE.Vector2(ancho * Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - k) ** 0.6, k * alto));
  }
  return new THREE.LatheGeometry(pts, 14);
}

// Llamas (gotas aditivas que titilan). lugares: [x, y, z, escala] en el marco del pasajero.
function llamas(lugares) {
  const g = new THREE.Group();
  const capas = [['#ff4a12', 0.3, 0.085, 0.9], ['#ff9a1f', 0.22, 0.062, 0.95], ['#ffe9a3', 0.13, 0.036, 1]];
  const lista = [];
  for (const [x, y, z, k = 1] of lugares) {
    const l = new THREE.Group(); l.position.set(x, y, z); l.userData.k = k;
    for (const [color, alto, ancho, op] of capas) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      l.add(malla(gota(alto, ancho), m));
    }
    const brillo = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    l.add(malla(esfera(0.11, 12, 8), brillo, [0, 0.08, 0]));
    g.add(l); lista.push(l);
  }
  g.userData.animar = (t) => lista.forEach((l, i) => {
    const f = Math.sin(t * 11 + i * 2.1) * 0.5 + Math.sin(t * 17.3 + i) * 0.3 + Math.sin(t * 5.1 + i * 4) * 0.2;
    const k = l.userData.k;
    l.scale.set(k * (1 - f * 0.08), k * (1 + f * 0.18), k * (1 - f * 0.08));
    l.rotation.set(Math.sin(t * 6.3 + i) * 0.12, t * 1.5 + i, Math.sin(t * 7.7 + i * 3) * 0.12);
  });
  return g;
}

// Fuego en las manos: una llama sobre cada palma.
const fuego = () => llamas([[0.27, 0.22, -0.2, 1.35], [0.27, 0.22, 0.2, 1.35]]);

// Gato o perro sentado en las piernas, mirando hacia adelante.
function animal(perro) {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0);
  const pelo = mat(perro ? '#b7834f' : '#e0913f', 0.85), claro = mat(perro ? '#f1e2c8' : '#f7ead6', 0.85), oscuro = mat('#1d1611', 0.4);
  g.add(malla(esfera(0.1), pelo, [0, 0.08, 0], [0, 0, 0.3], [1.15, 1, 0.85]));       // cuerpo
  g.add(malla(esfera(0.07), claro, [0.06, 0.08, 0], [0, 0, 0], [0.6, 0.9, 0.7]));      // pecho
  g.add(malla(esfera(0.075), pelo, [0.07, 0.2, 0]));                                    // cabeza
  g.add(malla(esfera(0.035), claro, [0.13, 0.18, 0], [0, 0, 0], perro ? [1.4, 0.9, 1] : [0.9, 0.8, 1])); // hocico
  g.add(malla(esfera(0.012, 8, 6), oscuro, [perro ? 0.18 : 0.16, 0.19, 0]));            // nariz
  for (const z of [-0.03, 0.03]) g.add(malla(esfera(0.012, 8, 6), oscuro, [0.13, 0.225, z])); // ojos
  for (const z of [-0.045, 0.045]) {
    if (perro) g.add(malla(caja(0.03, 0.08, 0.02, 0.008), mat('#7a5232', 0.85), [0.05, 0.19, z * 1.3], [0.2 * Math.sign(z), 0, 0.15]));
    else g.add(malla(new THREE.ConeGeometry(0.028, 0.06, 4), pelo, [0.06, 0.27, z], [z > 0 ? 0.25 : -0.25, 0, 0]));
  }
  const cola = malla(new THREE.TorusGeometry(0.07, 0.016, 6, 12, Math.PI * 0.9), pelo, [-0.1, 0.1, 0.05], [0, 0.4, 1.2]);
  g.add(cola);
  if (!perro) g.add(malla(new THREE.TorusGeometry(0.05, 0.008, 6, 14), mat('#c22b2b', 0.5), [0.07, 0.14, 0], [Math.PI / 2, 0.3, 0])); // collar
  g.userData.animar = (t) => { cola.rotation.y = 0.4 + Math.sin(t * (perro ? 9 : 2.2)) * (perro ? 0.5 : 0.25); };
  return g;
}

function celular() {
  const g = new THREE.Group(); g.position.set(0.3, 0.36, 0.08); g.rotation.set(0, Math.PI / 2, -0.35);
  g.add(malla(caja(0.085, 0.17, 0.012, 0.008), mat('#202227', 0.35, 0.5)));
  const pantalla = new THREE.MeshBasicMaterial({ color: '#7fb6ff', toneMapped: false });
  g.add(malla(new THREE.PlaneGeometry(0.075, 0.155), pantalla, [0, 0, -0.0065], [0, Math.PI, 0]));
  g.userData.animar = (t) => pantalla.color.setHSL(0.6 + 0.05 * Math.sin(t * 0.7), 0.8, 0.68);
  return g;
}

// Audífonos de diadema puestos sobre el casco.
function audifonos() {
  const g = new THREE.Group(); g.position.set(0, 0.76, 0);
  // de color (naranja NOID): negros se perdían contra el visor oscuro
  const color = mat('#ff6a3d', 0.4, 0.1), cojin = mat('#1c1c22', 0.7);
  g.add(malla(new THREE.TorusGeometry(0.19, 0.022, 8, 28, Math.PI), color, [0, 0, 0], [0, Math.PI / 2, 0], [1, 1.08, 1]));
  for (const z of [-0.19, 0.19]) {
    g.add(malla(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), color, [0, -0.02, z + Math.sign(z) * 0.012], [Math.PI / 2, 0, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), cojin, [0, -0.02, z - Math.sign(z) * 0.02], [Math.PI / 2, 0, 0]));
  }
  return g;
}

function computador() {
  const g = new THREE.Group(); g.position.set(0.3, 0.17, 0);
  const alu = mat('#c9ccd3', 0.35, 0.7);
  g.add(malla(caja(0.22, 0.014, 0.3, 0.006), alu));
  const tapa = new THREE.Group(); tapa.position.set(0.11, 0.007, 0); tapa.rotation.z = 1.75; g.add(tapa);
  tapa.add(malla(caja(0.22, 0.01, 0.3, 0.006), alu, [-0.11, 0, 0]));
  tapa.add(malla(new THREE.PlaneGeometry(0.2, 0.28), new THREE.MeshBasicMaterial({ color: '#9fd0ff', toneMapped: false }), [-0.11, -0.006, 0], [Math.PI / 2, 0, 0]));
  return g;
}

function carro() {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0);
  const rojo = mat('#d6332b', 0.3, 0.4), vidrio = mat('#22303f', 0.1, 0.8), llanta = mat('#151515', 0.8);
  g.add(malla(caja(0.3, 0.07, 0.15, 0.02), rojo, [0, 0.045, 0]));
  g.add(malla(caja(0.16, 0.06, 0.13, 0.02), vidrio, [-0.02, 0.1, 0]));
  for (const x of [-0.1, 0.1]) for (const z of [-0.075, 0.075]) g.add(malla(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14), llanta, [x, 0.02, z], [Math.PI / 2, 0, 0]));
  for (const z of [-0.045, 0.045]) g.add(malla(esfera(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false }), [0.15, 0.05, z]));
  return g;
}

function cama() {
  const g = new THREE.Group(); g.position.set(0.3, 0.17, 0);
  const madera = mat('#7b4a2a', 0.7);
  g.add(malla(caja(0.32, 0.04, 0.2, 0.01), madera));
  g.add(malla(caja(0.02, 0.12, 0.2, 0.008), madera, [-0.16, 0.05, 0]));
  g.add(malla(caja(0.3, 0.04, 0.19, 0.015), mat('#f4efe6', 0.9), [0, 0.04, 0]));
  g.add(malla(caja(0.2, 0.025, 0.195, 0.01), mat('#5a74c8', 0.9), [0.05, 0.065, 0]));
  g.add(malla(caja(0.07, 0.03, 0.15, 0.014), mat('#ffffff', 0.9), [-0.11, 0.07, 0]));
  return g;
}

function corazon() {
  const g = new THREE.Group(); g.position.set(0.3, 0.38, 0);
  const s = new THREE.Shape();
  s.moveTo(0, -0.07); s.bezierCurveTo(0.09, 0, 0.07, 0.07, 0.035, 0.07); s.bezierCurveTo(0.012, 0.07, 0, 0.05, 0, 0.04);
  s.bezierCurveTo(0, 0.05, -0.012, 0.07, -0.035, 0.07); s.bezierCurveTo(-0.07, 0.07, -0.09, 0, 0, -0.07);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 10 });
  geo.center();
  const c = malla(geo, mat('#e8344e', 0.35, 0.1, { emissive: new THREE.Color('#7a0d1e'), emissiveIntensity: 0.6 }), [0, 0, 0], [0, Math.PI / 2, 0], [1.3, 1.3, 1.3]);
  g.add(c);
  g.userData.animar = (t) => { const k = 1 + 0.08 * Math.max(0, Math.sin(t * 5)) ** 4; c.scale.setScalar(1.3 * k); g.position.y = 0.38 + 0.01 * Math.sin(t * 1.6); g.rotation.y = Math.sin(t * 0.8) * 0.5; };
  return g;
}

function libro() {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0); g.rotation.z = 0.5;
  g.add(malla(caja(0.16, 0.035, 0.22, 0.005), mat('#2f5d8a', 0.7)));
  g.add(malla(caja(0.15, 0.03, 0.205), mat('#f3ead6', 0.9), [0.006, 0, 0]));
  return g;
}

function comida() {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0);
  g.add(malla(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16), mat('#f2ede4', 0.4), [0, 0.05, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.004, 16), mat('#4a2a17', 0.2), [0, 0.096, 0]));
  g.add(malla(new THREE.TorusGeometry(0.025, 0.008, 6, 12, Math.PI), mat('#f2ede4', 0.4), [0, 0.05, 0.045], [0, 0, -Math.PI / 2]));
  return g;
}

function planta() {
  const g = new THREE.Group(); g.position.set(0.3, 0.18, 0);
  g.add(malla(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 14), mat('#c0643a', 0.8), [0, 0.045, 0]));
  const hoja = mat('#3f9a4f', 0.7);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(malla(esfera(0.04, 10, 6), hoja, [Math.cos(a) * 0.03, 0.13 + (i % 2) * 0.03, Math.sin(a) * 0.03], [0, -a, 0.6], [1.6, 0.35, 0.7])); }
  return g;
}

function musica() {
  const g = new THREE.Group(); g.position.set(0.28, 0.25, 0); g.rotation.set(0.9, 0, 0.3);
  const madera = mat('#c2803f', 0.5);
  g.add(malla(esfera(0.09, 16, 10), madera, [0, -0.06, 0], [0, 0, 0], [1, 1, 0.35]));
  g.add(malla(esfera(0.07, 16, 10), madera, [0, 0.05, 0], [0, 0, 0], [1, 1, 0.35]));
  g.add(malla(new THREE.CircleGeometry(0.028, 16), mat('#1b120c', 0.8), [0, 0.0, 0.026]));
  g.add(malla(caja(0.03, 0.26, 0.015), mat('#3a2616', 0.6), [0, 0.22, 0]));
  return g;
}

// Balón de fútbol. colores: [cuero, parches] (bucaros = Atlético Bucaramanga, amarillo y verde).
function balon(cuero = '#f5f5f0', parches = '#1a1a1a') {
  const g = new THREE.Group(); g.position.set(0.3, 0.27, 0);
  g.add(malla(new THREE.IcosahedronGeometry(0.1, 1), mat(cuero, 0.5, 0, { flatShading: true })));
  const m = mat(parches, 0.5);
  for (const p of [[0.1, 0, 0], [0, 0.1, 0], [0, 0, 0.1], [0, 0, -0.1], [-0.06, 0.06, 0.05], [0.05, -0.06, -0.06], [-0.1, 0, 0]]) g.add(malla(new THREE.IcosahedronGeometry(0.03, 0), m, p.map((v) => v * 0.97)));
  g.userData.animar = (t) => { g.rotation.y = t * 0.9; }; // gira en las manos, como haciendo dominadas
  return g;
}

function maleta() {
  const g = new THREE.Group(); g.position.set(0.3, 0.17, 0);
  g.add(malla(caja(0.14, 0.2, 0.26, 0.02), mat('#8a5a2b', 0.7), [0, 0.1, 0]));
  g.add(malla(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), mat('#2b1a0e', 0.6), [0, 0.2, 0], [0, Math.PI / 2, 0]));
  for (const z of [-0.07, 0.07]) g.add(malla(caja(0.145, 0.205, 0.015), mat('#d9b25a', 0.5, 0.5), [0, 0.1, z]));
  return g;
}

const FABRICAS = {
  fuego, gato: () => animal(false), perro: () => animal(true), celular, audifonos, computador, carro, cama, corazon,
  libro, comida, planta, musica, balon: () => balon(), bucaros: () => balon('#f7d117', '#127a3a'), maleta,
};

// Dónde va la llama cuando el objeto está prendido («computador+fuego», «balon+fuego»): encima del objeto.
const LLAMA_ENCIMA = { computador: [0.32, 0.2, 0, 0.9], balon: [0.3, 0.33, 0, 0.75], bucaros: [0.3, 0.33, 0, 0.75], celular: [0.3, 0.47, 0.08, 0.5],
  carro: [0.3, 0.3, 0, 0.7], cama: [0.3, 0.26, 0, 0.8], libro: [0.3, 0.27, 0, 0.7], maleta: [0.3, 0.4, 0, 0.7], musica: [0.3, 0.32, 0, 0.6],
  audifonos: [0, 0.98, 0, 0.6], gato: [0.37, 0.45, 0, 0.5], perro: [0.37, 0.45, 0, 0.5], planta: [0.3, 0.38, 0, 0.6], comida: [0.3, 0.32, 0, 0.5],
  corazon: [0.3, 0.45, 0, 0.6] };

// Tamaño caricatura: un poco más grandes que en la vida real, para que se vean desde la cámara.
const TAMANO = 1.4;

// clave: una de FABRICAS, o dos unidas con + (la segunda solo puede ser fuego: el objeto en llamas).
export function crearObjeto(clave) {
  const [a, b] = String(clave || '').split('+');
  const f = FABRICAS[a];
  if (!f) return null;
  const g = new THREE.Group(); g.name = `objeto:${clave}`;
  const anim = [];
  const o = f();
  // el fuego y los audífonos ya van a su medida; lo demás, más grande y un poco más arriba (se ve sobre las piernas)
  if (a !== 'fuego' && a !== 'audifonos') { o.scale.multiplyScalar(TAMANO); o.position.y += 0.08; }
  g.add(o); if (o.userData.animar) anim.push(o.userData.animar);
  if (b === 'fuego' && a !== 'fuego') {
    const [x, y, z, k] = LLAMA_ENCIMA[a] || [0.3, 0.35, 0, 0.7];
    const l = llamas([[x, y + (y - 0.17) * (TAMANO - 1) + (a === 'audifonos' ? 0 : 0.08), z, k * 1.5]]); g.add(l); anim.push(l.userData.animar);
  }
  // solo el grupo de arriba lleva animarObjeto: crearInterior los busca por ahí (sin llamar dos veces a las piezas)
  if (anim.length) g.userData.animarObjeto = (t) => { for (const fn of anim) fn(t); };
  return g;
}

// Pone el objeto de un pasajero: dentro de su grupo (pasajero suelto) o en la matriz de su asiento (multitudes).
export function ponerObjeto(destino, clave, matriz = null) {
  const o = crearObjeto(clave);
  if (!o) return null;
  if (!matriz) { destino.add(o); return o; }
  const envoltura = new THREE.Group();
  matriz.decompose(envoltura.position, envoltura.quaternion, envoltura.scale);
  envoltura.add(o); destino.add(envoltura);
  return envoltura;
}
