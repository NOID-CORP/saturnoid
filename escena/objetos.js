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

// Moto eléctrica «Vainilla Cacao» (la de nazmend0za, 27-nov; foto de referencia: scooter blanco y negro con detalles
// verde limón). De juguete, sobre las piernas con el frente hacia adelante (+x): desde «Verme sentado» se ve de perfil.
// Se arma con el largo en z (atrás −z, adelante +z) y se gira. Sin marcas ni logos.
function moto() {
  const g = new THREE.Group(); g.position.set(0.36, 0.22, 0); g.rotation.y = Math.PI / 2;
  const blanco = mat('#f5f5f2', 0.25, 0.05, { clearcoat: 0.8 }), negro = mat('#17181b', 0.45, 0.2), limon = mat('#c6f03c', 0.4, 0, { emissive: new THREE.Color('#3a4a08'), emissiveIntensity: 0.4 });
  const llanta = mat('#121214', 0.85), metal = mat('#c8ccd4', 0.3, 0.9);
  for (const z of [-0.13, 0.13]) {                                                       // ruedas negras con rayos
    g.add(malla(new THREE.TorusGeometry(0.05, 0.02, 10, 24), llanta, [0, 0, z], [0, Math.PI / 2, 0]));
    g.add(malla(new THREE.CylinderGeometry(0.034, 0.034, 0.022, 5), negro, [0, 0, z], [0, 0, Math.PI / 2]));
    g.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), metal, [0, 0, z], [0, 0, Math.PI / 2]));
  }
  g.add(malla(caja(0.07, 0.03, 0.17, 0.012), negro, [0, 0.03, 0.0]));                   // piso negro
  g.add(malla(caja(0.075, 0.07, 0.15, 0.025), negro, [0, 0.05, -0.1]));                  // motor / bajo de la cola
  const cola = malla(caja(0.07, 0.06, 0.16, 0.025), blanco, [0, 0.105, -0.09], [-0.22, 0, 0]); g.add(cola);   // carenado blanco de la cola (sube atrás)
  g.add(malla(caja(0.062, 0.025, 0.15, 0.012), negro, [0, 0.145, -0.07], [-0.08, 0, 0])); // asiento negro largo
  g.add(malla(caja(0.074, 0.012, 0.09, 0.004), limon, [0, 0.09, -0.11], [-0.22, 0, 0]));  // franja verde limón
  g.add(malla(caja(0.02, 0.02, 0.012, 0.004), mat('#e2262b', 0.3, 0, { emissive: new THREE.Color('#7a0a0a'), emissiveIntensity: 0.8 }), [0, 0.12, -0.17]));  // stop
  // frente: escudo alto en punta (blanco arriba, negro abajo) y horquilla
  g.add(malla(caja(0.068, 0.16, 0.045, 0.02), blanco, [0, 0.11, 0.105], [-0.3, 0, 0]));
  g.add(malla(caja(0.07, 0.07, 0.048, 0.018), negro, [0, 0.055, 0.12], [-0.3, 0, 0]));
  g.add(malla(caja(0.072, 0.03, 0.03, 0.008), limon, [0, 0.07, 0.137], [-0.3, 0, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), negro, [0, 0.06, 0.15], [-0.3, 0, 0]));
  g.add(malla(caja(0.05, 0.025, 0.05, 0.01), blanco, [0, 0.055, 0.15]));                  // salpicadera delantera
  g.add(malla(new THREE.CylinderGeometry(0.007, 0.007, 0.13, 8), negro, [0, 0.215, 0.115], [0, 0, Math.PI / 2]));   // manubrio
  for (const x of [-0.06, 0.06]) {
    g.add(malla(new THREE.CylinderGeometry(0.011, 0.011, 0.028, 10), negro, [x, 0.215, 0.115], [0, 0, Math.PI / 2]));  // puños
    g.add(malla(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 6), negro, [x * 0.8, 0.25, 0.11]));                       // espejos
    g.add(malla(caja(0.02, 0.012, 0.03, 0.005), negro, [x * 0.8, 0.282, 0.11]));
  }
  const farol = new THREE.MeshBasicMaterial({ color: '#fff6d8', toneMapped: false });
  g.add(malla(caja(0.04, 0.014, 0.01, 0.004), farol, [0, 0.19, 0.137], [-0.3, 0, 0]));
  g.userData.animar = (t) => { farol.color.setHSL(0.12, 1, 0.86 + 0.05 * Math.sin(t * 3)); };
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

// Comida = una hamburguesa gigante.
function comida() {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0);
  const pan = mat('#d9953f', 0.6);
  g.add(malla(new THREE.CylinderGeometry(0.085, 0.08, 0.03, 20), pan, [0, 0.015, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), mat('#5a2e1a', 0.8), [0, 0.045, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.095, 0.095, 0.008, 6), mat('#f6c23a', 0.5), [0, 0.063, 0], [0, 0.3, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.097, 0.092, 0.012, 20), mat('#58a83c', 0.7), [0, 0.072, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 20), mat('#d23a2c', 0.6), [0, 0.084, 0]));
  const tapa = malla(new THREE.SphereGeometry(0.088, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), pan, [0, 0.09, 0], [0, 0, 0], [1, 0.6, 1]); g.add(tapa);
  for (let k = 0; k < 7; k++) { const a = k * 2.4; g.add(malla(esfera(0.006, 6, 4), mat('#f8ecc8', 0.6), [Math.cos(a) * 0.05, 0.135 + (k % 2) * 0.006, Math.sin(a) * 0.05], [0, 0, 0], [1.6, 0.6, 1])); }
  return g;
}

// Lata de energizante (para no dormirse en el viaje).
function lata() {
  const g = new THREE.Group(); g.position.set(0.3, 0.3, 0.06); g.rotation.z = -0.2;
  g.add(malla(new THREE.CylinderGeometry(0.035, 0.035, 0.15, 20), mat('#2a4fa8', 0.35, 0.6)));
  g.add(malla(new THREE.CylinderGeometry(0.0355, 0.0355, 0.05, 20), mat('#c8ccd4', 0.3, 0.9)));
  g.add(malla(new THREE.CylinderGeometry(0.03, 0.035, 0.012, 20), mat('#c8ccd4', 0.3, 0.9), [0, 0.081, 0]));
  g.add(malla(esfera(0.02, 10, 8), mat('#e8333a', 0.5), [0.033, 0, 0], [0, 0, 0], [0.3, 1, 1]));
  return g;
}

function planta() {
  const g = new THREE.Group(); g.position.set(0.3, 0.18, 0);
  g.add(malla(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 14), mat('#c0643a', 0.8), [0, 0.045, 0]));
  const hoja = mat('#3f9a4f', 0.7);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(malla(esfera(0.04, 10, 6), hoja, [Math.cos(a) * 0.03, 0.13 + (i % 2) * 0.03, Math.sin(a) * 0.03], [0, -a, 0.6], [1.6, 0.35, 0.7])); }
  return g;
}

function musica(bajo = false) {
  const g = new THREE.Group(); g.position.set(0.28, 0.25, 0); g.rotation.set(0.9, 0, 0.3);
  const madera = mat(bajo ? '#b3202a' : '#c2803f', bajo ? 0.25 : 0.5, bajo ? 0.2 : 0);
  g.add(malla(esfera(0.09, 16, 10), madera, [0, -0.06, 0], [0, 0, 0], [1, 1, 0.35]));
  g.add(malla(esfera(0.07, 16, 10), madera, [0, 0.05, 0], [0, 0, 0], [1, 1, 0.35]));
  g.add(malla(new THREE.CircleGeometry(0.028, 16), mat('#1b120c', 0.8), [0, 0.0, 0.026]));
  g.add(malla(caja(0.03, bajo ? 0.36 : 0.26, 0.015), mat('#3a2616', 0.6), [0, bajo ? 0.27 : 0.22, 0]));
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

// La Tierra entera, girando despacio (para el que se lleva «el mundo entero»).
function mundo() {
  const g = new THREE.Group(); g.position.set(0.3, 0.3, 0);
  const tierra = new THREE.Group(); tierra.rotation.z = 0.4; g.add(tierra);
  tierra.add(malla(esfera(0.11, 24, 16), mat('#2f6fd1', 0.45, 0.1)));
  const verde = mat('#4fae4a', 0.8), nube = mat('#ffffff', 0.9);
  const manchas = [[0.4, 0.3, 1.3, 0.05], [2.1, -0.2, 1.1, 0.045], [3.6, 0.5, 0.9, 0.04], [4.9, -0.5, 1.2, 0.05], [1.2, -0.9, 0.8, 0.03], [5.6, 0.95, 0.7, 0.03]];
  for (const [lon, lat, ancho, r] of manchas) {
    const d = V(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const m = malla(esfera(r, 10, 8), verde, d.clone().multiplyScalar(0.098).toArray());
    m.scale.set(ancho, ancho * 0.8, ancho); m.lookAt(d.clone().multiplyScalar(2)); m.scale.z = 0.35; tierra.add(m);
  }
  for (const [lon, lat] of [[1, 0.6], [2.8, -0.4], [4.3, 0.2]]) {
    const d = V(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const c = malla(esfera(0.03, 10, 8), nube, d.clone().multiplyScalar(0.112).toArray()); c.lookAt(d.clone().multiplyScalar(2)); c.scale.set(1.6, 0.7, 0.3); tierra.add(c);
  }
  g.userData.animar = (t) => { tierra.rotation.y = t * 0.6; };
  return g;
}

function herramientas() {
  const g = new THREE.Group(); g.position.set(0.3, 0.17, 0);
  const rojo = mat('#c8312b', 0.45, 0.3), acero = mat('#b9bec7', 0.3, 0.9);
  g.add(malla(caja(0.15, 0.11, 0.28, 0.012), rojo, [0, 0.055, 0]));
  g.add(malla(caja(0.155, 0.02, 0.285, 0.006), mat('#8f1f1b', 0.5, 0.3), [0, 0.1, 0]));
  g.add(malla(new THREE.TorusGeometry(0.045, 0.01, 6, 14, Math.PI), mat('#222', 0.6), [0, 0.11, 0], [0, Math.PI / 2, 0]));
  // una llave inglesa y un destornillador asomados
  const llave = new THREE.Group(); llave.position.set(0.02, 0.12, 0.08); llave.rotation.set(0.25, 0, -0.3); g.add(llave);
  llave.add(malla(caja(0.018, 0.16, 0.01), acero, [0, 0.06, 0]));
  llave.add(malla(new THREE.TorusGeometry(0.022, 0.009, 6, 12, Math.PI * 1.4), acero, [0, 0.15, 0], [0, 0, -0.7]));
  const dest = new THREE.Group(); dest.position.set(-0.02, 0.11, -0.08); dest.rotation.set(-0.3, 0, 0.25); g.add(dest);
  dest.add(malla(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 10), mat('#f2c14e', 0.5), [0, 0.035, 0]));
  dest.add(malla(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 8), acero, [0, 0.11, 0]));
  return g;
}

// Micrófono dorado de reguetonero, cerca del visor (para el que se lleva a Maluma).
function microfono() {
  const g = new THREE.Group(); g.position.set(0.3, 0.42, 0.08); g.rotation.set(0.3, 0, 0.55);
  const oro = mat('#e8b93a', 0.25, 0.9);
  g.add(malla(new THREE.CylinderGeometry(0.018, 0.012, 0.16, 14), oro, [0, -0.06, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.024, 0.02, 0.025, 14), mat('#1a1a1a', 0.5), [0, 0.03, 0]));
  g.add(malla(esfera(0.035, 14, 10), mat('#d9d9d9', 0.35, 0.9, { wireframe: true }), [0, 0.07, 0]));
  g.add(malla(esfera(0.032, 14, 10), mat('#3a3a3a', 0.6), [0, 0.07, 0]));
  const brillo = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  g.add(malla(esfera(0.06, 10, 8), brillo, [0, 0.07, 0]));
  g.userData.animar = (t) => { brillo.opacity = 0.18 + 0.12 * Math.max(0, Math.sin(t * 4)); };
  return g;
}

// Su tanque de oxígeno «de confianza» (aunque el traje ya trae aire): bala verde de hospital, manómetro y la manguera
// conectada al casco. La aguja tiembla. Medidas para el casco en (0, 0.76, 0) tras escalar ×1,4 y subir 0,08.
function oxigeno() {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0.04);
  const verde = mat('#2f9e5b', 0.45, 0.3), acero = mat('#c8ccd4', 0.3, 0.9);
  g.add(malla(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 22), verde, [0, 0.1, 0]));
  g.add(malla(new THREE.SphereGeometry(0.045, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), verde, [0, 0.2, 0], [0, 0, 0], [1, 0.7, 1]));
  g.add(malla(new THREE.CylinderGeometry(0.046, 0.046, 0.04, 22), mat('#f4f1ea', 0.6), [0, 0.11, 0]));   // etiqueta
  g.add(malla(new THREE.CylinderGeometry(0.014, 0.018, 0.035, 12), acero, [0, 0.245, 0]));             // válvula
  g.add(malla(new THREE.TorusGeometry(0.018, 0.005, 6, 14), acero, [0, 0.265, 0], [Math.PI / 2, 0, 0])); // perilla
  const reloj = new THREE.Group(); reloj.position.set(0.028, 0.245, 0); reloj.rotation.z = -Math.PI / 2; g.add(reloj);
  reloj.add(malla(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 18), acero));
  reloj.add(malla(new THREE.CylinderGeometry(0.018, 0.018, 0.002, 18), mat('#ffffff', 0.4), [0, 0.007, 0]));
  const aguja = malla(caja(0.003, 0.002, 0.016), mat('#e8333a', 0.5), [0, 0.009, 0]); reloj.add(aguja);
  const curva = new THREE.CatmullRomCurve3([V(0, 0.27, 0), V(-0.02, 0.33, -0.05), V(-0.08, 0.33, -0.06), V(-0.1, 0.29, -0.03)]);
  g.add(malla(new THREE.TubeGeometry(curva, 20, 0.006, 6), mat('#e9eef2', 0.5, 0, { transparent: true, opacity: 0.85 })));
  g.userData.animar = (t) => { aguja.rotation.y = 0.6 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.05; };
  return g;
}

// Un par de tenis en las manos (por si en Saturnoid hay dónde caminar): negros con suela blanca y franja naranja
// (blancos se perdían contra el traje).
function zapatos() {
  const g = new THREE.Group(); g.position.set(0.3, 0.2, 0);
  const suela = mat('#f2f0ea', 0.7), tela = mat('#23232b', 0.6), franja = mat('#ff6a3d', 0.5), cordon = mat('#f4f4f0', 0.6);
  for (const z of [-0.075, 0.075]) {
    const s = new THREE.Group(); s.position.set(0, 0, z); s.rotation.y = z > 0 ? -0.12 : 0.12; g.add(s);
    s.add(malla(caja(0.24, 0.035, 0.085, 0.015), suela, [0, 0.018, 0]));
    s.add(malla(caja(0.17, 0.07, 0.078, 0.03), tela, [-0.025, 0.07, 0]));
    s.add(malla(esfera(0.042, 14, 10), tela, [0.07, 0.05, 0], [0, 0, 0], [1.3, 0.75, 0.95]));   // punta
    s.add(malla(caja(0.1, 0.02, 0.081, 0.008), franja, [-0.02, 0.06, 0], [0, 0, 0.35]));
    s.add(malla(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16), tela, [-0.075, 0.11, 0]));  // cuello del tenis
    for (let k = 0; k < 3; k++) s.add(malla(caja(0.008, 0.006, 0.05), cordon, [0.0 + k * 0.025, 0.106 - k * 0.008, 0], [0, 0, -0.3]));
  }
  return g;
}

// Su infaltable: una tinta de labios roja, destapada y lista (la tapa en la otra mano). Brilla un poco.
function labial() {
  const g = new THREE.Group(); g.position.set(0.3, 0.28, 0.08); g.rotation.set(0.2, 0, -0.35);
  const oro = mat('#e8b93a', 0.25, 0.9), rojo = mat('#c8102e', 0.25, 0.1);
  g.add(malla(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 20), oro, [0, 0, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 20), mat('#1a1a1a', 0.4), [0, 0.04, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 20), rojo, [0, 0.07, 0]));
  const punta = malla(new THREE.CylinderGeometry(0.0, 0.018, 0.03, 20, 1, false), rojo, [0.005, 0.108, 0], [0, 0, -0.5], [1, 1, 0.9]); g.add(punta);
  g.add(malla(new THREE.CylinderGeometry(0.026, 0.026, 0.075, 20), oro, [0.02, -0.02, -0.17], [0, 0, 0.5]));   // la tapa, en la otra mano
  const brillo = new THREE.MeshBasicMaterial({ color: '#ff5470', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  g.add(malla(esfera(0.045, 10, 8), brillo, [0, 0.09, 0]));
  g.userData.animar = (t) => { brillo.opacity = 0.15 + 0.12 * Math.max(0, Math.sin(t * 3.5)); };
  return g;
}

// Piano de cola entero… en las piernas, con el teclado hacia afuera (toca para el público).
function piano() {
  const g = new THREE.Group(); g.position.set(0.3, 0.17, 0); g.rotation.y = Math.PI;
  const negro = mat('#111114', 0.15, 0.4);
  const forma = new THREE.Shape();
  forma.moveTo(-0.13, -0.12); forma.lineTo(0.13, -0.12); forma.lineTo(0.13, 0.0);
  forma.bezierCurveTo(0.13, 0.1, 0.04, 0.09, 0.02, 0.18); forma.bezierCurveTo(0.0, 0.26, -0.13, 0.25, -0.13, 0.14); forma.lineTo(-0.13, -0.12);
  // la forma va en el plano del piso: x = ancho (a lo largo del teclado, eje z del pasajero), y = largo (hacia el pasajero)
  const cuerpo = malla(new THREE.ExtrudeGeometry(forma, { depth: 0.07, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }), negro, [0, 0.12, 0], [Math.PI / 2, 0, -Math.PI / 2]);
  g.add(cuerpo);
  const interior = malla(new THREE.ShapeGeometry(forma), mat('#c99a3e', 0.4, 0.6), [0, 0.127, 0], [-Math.PI / 2, 0, -Math.PI / 2], [0.9, 0.9, 1]);
  g.add(interior);
  // teclado (en -x local: tras girar el grupo, queda mirando hacia afuera)
  g.add(malla(caja(0.06, 0.022, 0.27, 0.004), mat('#f6f3ec', 0.4), [0.15, 0.1, 0]));
  for (let k = 0; k < 10; k++) if (k % 7 !== 2 && k % 7 !== 6) g.add(malla(caja(0.034, 0.014, 0.012), negro, [0.145, 0.115, -0.115 + k * 0.026]));
  g.add(malla(caja(0.02, 0.06, 0.28, 0.004), negro, [0.18, 0.1, 0])); // borde del teclado
  for (const [x, z] of [[0.14, -0.11], [0.14, 0.11], [-0.12, 0.02]]) g.add(malla(new THREE.CylinderGeometry(0.01, 0.007, 0.08, 8), negro, [x, 0.04, z]));
  return g;
}

// Cámara de fotos réflex en las manos, con el lente hacia afuera (para el que se lleva su cámara).
function camara() {
  const g = new THREE.Group(); g.position.set(0.3, 0.3, 0);
  const negro = mat('#1c1c20', 0.45, 0.2), metal = mat('#c8ccd4', 0.3, 0.9);
  g.add(malla(caja(0.08, 0.1, 0.17, 0.015), negro));                                                  // cuerpo
  g.add(malla(caja(0.06, 0.04, 0.06, 0.01), negro, [-0.005, 0.065, 0]));                               // visor
  g.add(malla(new THREE.CylinderGeometry(0.04, 0.042, 0.07, 22), negro, [0.07, 0, 0], [0, 0, Math.PI / 2]));   // lente
  g.add(malla(new THREE.TorusGeometry(0.041, 0.005, 6, 22), metal, [0.105, 0, 0], [0, Math.PI / 2, 0]));
  g.add(malla(new THREE.CircleGeometry(0.032, 22), mat('#1d3550', 0.05, 0.9), [0.106, 0, 0], [0, Math.PI / 2, 0]));
  g.add(malla(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 12), mat('#c8312b', 0.4), [0, 0.056, 0.06]));       // disparador
  const flash = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  g.add(malla(esfera(0.06, 10, 8), flash, [0.02, 0.07, 0]));
  g.userData.animar = (t) => { const k = (t % 4.5) / 4.5; flash.opacity = k < 0.025 ? 0.9 : 0; };    // un flash cada 4,5 s
  return g;
}

// Mordekaiser (League of Legends) en versión tierna, para @manutegaming: la armadura va encima del traje del pasajero.
// Lo que lo hace reconocible (comparado con la imagen del juego que mandó DON, 27-nov): acero verde azulado, yelmo alto
// con dos cuernos de cuchilla y ojos turquesa, hombreras enormes con cuchillas curvas, líneas turquesa en el peto,
// faldón rojo oscuro con punta en zigzag, guanteletes con garras y la maza Nightfall con fuego turquesa. No es un objeto en las piernas: es el disfraz
// entero, por eso no se escala con TAMANO (las piezas ya van a la medida del pasajero: casco en (0, 0.76, 0), r 0,17).
function mordekaiser() {
  const g = new THREE.Group();
  // acero verde azulado (no negro) con brillo turquesa, como el de League of Legends
  const acero = mat('#22302f', 0.3, 0.85), acero2 = mat('#36494a', 0.26, 0.9), filo = mat('#9fb7b4', 0.2, 0.95);
  const brilla = new THREE.MeshBasicMaterial({ color: '#3ff2d6', toneMapped: false });
  const halo = () => new THREE.MeshBasicMaterial({ color: '#2fe8cf', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const rojo = mat('#5c1220', 0.75, 0.05, { side: THREE.DoubleSide });
  const cuchilla = (ancho, alto, grueso = 0.03) => {   // cuña afilada (para cuernos, púas grandes y garras)
    const s = new THREE.Shape(); s.moveTo(-ancho / 2, 0); s.quadraticCurveTo(-ancho * 0.1, alto * 0.55, ancho * 0.12, alto); s.quadraticCurveTo(ancho * 0.18, alto * 0.45, ancho / 2, 0); s.lineTo(-ancho / 2, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: grueso, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 6 }); geo.translate(0, 0, -grueso / 2); return geo;
  };
  // ── casco: yelmo alto y anguloso con dos cuernos de cuchilla y la ranura turquesa ──
  const casco = new THREE.Group(); casco.name = 'casco'; casco.position.set(0, 0.78, 0); g.add(casco);
  casco.add(malla(esfera(0.19, 24, 18), acero, [0, 0, 0], [0, 0, 0], [1, 1.12, 0.95]));
  casco.add(malla(new THREE.ConeGeometry(0.2, 0.2, 4), acero2, [0.02, 0.17, 0], [0, Math.PI / 4, 0], [1, 1, 0.8]));   // cresta en punta
  casco.add(malla(new THREE.SphereGeometry(0.185, 20, 12, -Math.PI * 0.3, Math.PI * 0.6, Math.PI * 0.42, Math.PI * 0.3), mat('#0b1112', 0.4, 0.6), [0.012, 0, 0], [0, Math.PI / 2, 0], [1, 1.12, 0.95]));  // la sombra de la cara
  casco.add(malla(new THREE.ConeGeometry(0.035, 0.16, 4), acero2, [0.19, 0.07, 0], [0, Math.PI / 4, 0]));               // nasal
  for (const z of [-1, 1]) {
    casco.add(malla(cuchilla(0.1, 0.34), acero2, [-0.02, 0.16, z * 0.11], [0, 0, z * 0.0], [1, 1, 1]).rotateX(-z * 0.25));   // cuernos
    casco.add(malla(cuchilla(0.07, 0.14, 0.02), acero2, [0.1, -0.12, z * 0.15], [Math.PI, 0, 0]).rotateY(z * 0.6));      // mentón en punta
  }
  // la ranura: ojos turquesa en una T delgada (la cara no se ve: solo la luz)
  const ojos = new THREE.Group(); ojos.position.set(0.198, 0.0, 0); ojos.rotation.y = Math.PI / 2; casco.add(ojos);
  for (const z of [-1, 1]) ojos.add(malla(new THREE.PlaneGeometry(0.06, 0.016), brilla, [z * 0.04, 0.02, 0], [0, 0, z * -0.25]));
  ojos.add(malla(new THREE.PlaneGeometry(0.012, 0.08), brilla, [0, -0.03, 0]));
  const haloO = halo(); ojos.add(malla(new THREE.CircleGeometry(0.06, 20), haloO, [0, 0.0, 0.003], [0, 0, 0], [1.4, 0.8, 1]));
  // ── peto anguloso con las líneas turquesa en curva y el faldón rojo ──
  g.add(malla(caja(0.3, 0.38, 0.44, 0.08), acero, [-0.01, 0.37, 0], [0, 0, 0.1]));
  g.add(malla(new THREE.ConeGeometry(0.16, 0.2, 4), acero2, [0.12, 0.46, 0], [0, Math.PI / 4, -Math.PI / 2 + 0.1], [1, 1, 0.5]));  // quilla
  for (const z of [-1, 1]) {
    const c = malla(new THREE.TorusGeometry(0.1, 0.009, 6, 20, Math.PI * 0.75), brilla, [0.155, 0.4, z * 0.08], [0, Math.PI / 2, z > 0 ? -0.4 : Math.PI + 0.4]); g.add(c);
  }
  const gema = malla(new THREE.OctahedronGeometry(0.03), brilla, [0.17, 0.5, 0]); g.add(gema);
  g.add(malla(caja(0.2, 0.06, 0.46, 0.02), acero2, [-0.01, 0.15, 0]));                      // cinturón
  // faldón: dos tiras rojas con la punta en zigzag, adelante, colgando hasta las rodillas
  const sF = new THREE.Shape(); sF.moveTo(-0.12, 0); sF.lineTo(0.12, 0); sF.lineTo(0.1, -0.26); sF.lineTo(0.05, -0.2); sF.lineTo(0, -0.32); sF.lineTo(-0.05, -0.2); sF.lineTo(-0.1, -0.26); sF.lineTo(-0.12, 0);
  const faldon = malla(new THREE.ShapeGeometry(sF), rojo, [0.12, 0.13, 0], [0, Math.PI / 2, 0]); g.add(faldon);
  // ── hombreras enormes con tres cuchillas curvas hacia arriba y afuera ──
  for (const z of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(-0.02, 0.58, z * 0.27); g.add(h);
    h.add(malla(esfera(0.13, 16, 12), acero, [0, 0, 0], [0, 0, 0], [1.1, 0.75, 1]));
    h.add(malla(caja(0.26, 0.05, 0.2, 0.02), acero2, [0, -0.06, z * 0.03], [z * 0.3, 0, 0]));
    for (let k = 0; k < 3; k++) {
      const b = malla(cuchilla(0.13, 0.28 + (k === 1 ? 0.1 : 0)), acero2, [(k - 1) * 0.09, 0.05, z * 0.07]);
      b.rotation.set(z * (0.6 + k * 0.1), Math.PI / 2, 0); h.add(b);
    }
    h.add(malla(new THREE.TorusGeometry(0.11, 0.008, 6, 20, Math.PI), brilla, [0, -0.02, z * 0.02], [Math.PI / 2, 0, 0]));
  }
  // ── guanteletes con garras ──
  for (const z of [-0.23, 0.23]) {
    g.add(malla(caja(0.13, 0.11, 0.12, 0.03), acero, [0.25, 0.18, z]));
    for (const d of [-0.035, 0, 0.035]) g.add(malla(new THREE.ConeGeometry(0.012, 0.06, 6), filo, [0.33, 0.15, z + d], [0, 0, -Math.PI / 2 - 0.3]));
    g.add(malla(cuchilla(0.05, 0.08, 0.02), acero2, [0.22, 0.24, z], [0, Math.PI / 2, 0]));
  }
  // ── la maza Nightfall: mango largo, cabeza con aletas y fuego turquesa (hacia afuera: no tapa la cara) ──
  const maza = new THREE.Group(); maza.position.set(0.27, 0.18, 0.25); maza.rotation.set(0.62, 0, -0.12); g.add(maza);
  maza.add(malla(new THREE.CylinderGeometry(0.017, 0.017, 0.74, 10), acero2, [0, 0.3, 0]));
  for (const y of [0.12, 0.5]) maza.add(malla(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10), brilla, [0, y, 0]));
  const cabeza = new THREE.Group(); cabeza.position.set(0, 0.74, 0); maza.add(cabeza);
  cabeza.add(malla(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8), acero));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const f = malla(cuchilla(0.12, 0.08, 0.02), acero2, [Math.cos(a) * 0.06, -0.06, Math.sin(a) * 0.06]); f.rotation.set(0, -a, -Math.PI / 2); cabeza.add(f); }
  cabeza.add(malla(new THREE.ConeGeometry(0.04, 0.12, 6), filo, [0, 0.13, 0]));
  const haloM = halo(); cabeza.add(malla(esfera(0.1, 14, 10), haloM));
  const fuegoVerde = new THREE.Group(); fuegoVerde.position.y = 0.04; cabeza.add(fuegoVerde);
  for (const [color, alto, ancho, op] of [['#18d6b4', 0.22, 0.07, 0.8], ['#7dfbe6', 0.14, 0.045, 0.9], ['#eafffb', 0.07, 0.022, 1]]) fuegoVerde.add(malla(gota(alto, ancho), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  g.userData.animar = (tt) => {
    const k = 0.5 + 0.5 * Math.sin(tt * 2.4);
    haloO.opacity = 0.12 + 0.12 * k; haloM.opacity = 0.14 + 0.18 * k; gema.scale.setScalar(1 + 0.18 * k); gema.rotation.y = tt;
    const f = Math.sin(tt * 11) * 0.5 + Math.sin(tt * 17.3) * 0.3;
    fuegoVerde.scale.set(1 - f * 0.08, 1 + f * 0.2, 1 - f * 0.08); fuegoVerde.rotation.y = tt * 1.5;
    faldon.rotation.z = Math.sin(tt * 1.7) * 0.06;
  };
  return g;
}

const FABRICAS = {
  mordekaiser, camara, moto,
  fuego, gato: () => animal(false), perro: () => animal(true), celular, audifonos, computador, carro, cama, corazon,
  libro, comida, planta, musica, balon: () => balon(), bucaros: () => balon('#f7d117', '#127a3a'), maleta,
  mundo, herramientas, microfono, piano, lata, bajo: () => musica(true), oxigeno, zapatos, labial,
};

// Dónde va la llama cuando el objeto está prendido («computador+fuego», «balon+fuego»): encima del objeto.
const LLAMA_ENCIMA = { camara: [0.3, 0.42, 0, 0.6], moto: [0.3, 0.38, 0, 0.6], computador: [0.32, 0.2, 0, 0.9], balon: [0.3, 0.33, 0, 0.75], bucaros: [0.3, 0.33, 0, 0.75], celular: [0.3, 0.47, 0.08, 0.5],
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
  if (a !== 'fuego' && a !== 'audifonos' && a !== 'mordekaiser') { o.scale.multiplyScalar(TAMANO); o.position.y += 0.08; }
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
