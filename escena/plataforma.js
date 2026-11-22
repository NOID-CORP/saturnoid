// Suelo de noche, plataforma de lanzamiento, torre con brazos, mástiles de luces y montañas al fondo.
import * as THREE from 'three';
import { mulberry32, lienzo, C } from './util.js';

function ruido2(seed) {
  const r = mulberry32(seed); const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const g = (x, y) => P[((y & 255) << 8) | (x & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function texturaPlataforma() {
  const cv = lienzo(1024, 1024); const x = cv.getContext('2d');
  x.fillStyle = '#4a443e'; x.fillRect(0, 0, 1024, 1024);
  const r = mulberry32(31);
  for (let i = 0; i < 2600; i++) { // manchas del concreto
    x.fillStyle = `rgba(${r() < 0.5 ? '20,16,12' : '120,110,96'},${r() * 0.07})`;
    const s = 4 + r() * 40; x.fillRect(r() * 1024, r() * 1024, s, s);
  }
  x.strokeStyle = 'rgba(25,20,16,.55)'; x.lineWidth = 3;
  for (let i = 0; i <= 1024; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1024); x.moveTo(0, i); x.lineTo(1024, i); x.stroke(); }
  x.translate(512, 512);
  x.strokeStyle = C.mant; x.globalAlpha = 0.85; x.lineWidth = 10;
  x.beginPath(); x.arc(0, 0, 330, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 360, 0, Math.PI * 2); x.stroke();
  // franjas de seguridad en tinto y mantequilla
  for (let i = 0; i < 48; i++) {
    x.save(); x.rotate((i / 48) * Math.PI * 2);
    x.fillStyle = i % 2 ? C.tintoClaro : C.mant; x.globalAlpha = 0.8;
    x.fillRect(395, -22, 70, 44); x.restore();
  }
  x.globalAlpha = 0.9; x.fillStyle = C.mant; x.font = '700 64px "DM Mono", monospace'; x.textAlign = 'center';
  x.fillText('SATURNOID · PLATAFORMA 1', 0, 250);
  x.rotate(Math.PI); x.fillText('NOID', 0, 250);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function crearPlataforma({ calidad = 'media' } = {}) {
  const grupo = new THREE.Group();
  const n = ruido2(5);

  // Suelo rocoso con relieve (plano cerca de la plataforma).
  const seg = calidad === 'baja' ? 90 : 150;
  const gSuelo = new THREE.PlaneGeometry(1400, 1400, seg, seg); gSuelo.rotateX(-Math.PI / 2);
  const p = gSuelo.attributes.position; const col = new Float32Array(p.count * 3);
  const base = new THREE.Color('#1c130c'), claro = new THREE.Color('#4a3424'), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Z = p.getZ(i); const d = Math.hypot(X, Z);
    const k = Math.min(1, Math.max(0, (d - 34) / 90));
    const h = (n(X * 0.02, Z * 0.02) * 9 + n(X * 0.08, Z * 0.08) * 2.2 - 5) * k + Math.max(0, d - 420) * 0.12;
    p.setY(i, h);
    tmp.copy(base).lerp(claro, n(X * 0.05 + 40, Z * 0.05) * 0.8); col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  gSuelo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gSuelo.computeVertexNormals();
  const suelo = new THREE.Mesh(gSuelo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  suelo.receiveShadow = true;
  grupo.add(suelo);

  // Rocas sueltas (dan profundidad al suelo).
  const nR = calidad === 'baja' ? 260 : 520; const rr = mulberry32(77);
  const rocas = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#3a2a1d', roughness: 0.95, flatShading: true }), nR);
  const mR = new THREE.Matrix4(), qR = new THREE.Quaternion(), eR = new THREE.Euler();
  for (let i = 0; i < nR; i++) {
    const a = rr() * Math.PI * 2, d = 26 + Math.pow(rr(), 1.6) * 260;
    const X = Math.cos(a) * d, Z = Math.sin(a) * d, s = 0.15 + Math.pow(rr(), 3) * 1.1;
    const k = Math.min(1, Math.max(0, (d - 34) / 90));
    const y = (n(X * 0.02, Z * 0.02) * 9 + n(X * 0.08, Z * 0.08) * 2.2 - 5) * k;
    eR.set(rr() * 3, rr() * 3, rr() * 3); qR.setFromEuler(eR);
    mR.compose(new THREE.Vector3(X, y + s * 0.3, Z), qR, new THREE.Vector3(s, s * (0.5 + rr() * 0.5), s * (0.7 + rr() * 0.6)));
    rocas.setMatrixAt(i, mR);
  }
  rocas.receiveShadow = true; grupo.add(rocas);

  // Plataforma.
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(19, 20.5, 1.2, 64),
    [new THREE.MeshStandardMaterial({ color: '#3b352f', roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ map: texturaPlataforma(), roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: '#3b352f' })]);
  plat.position.y = 0.6; plat.receiveShadow = true;
  grupo.add(plat);
  const foso = new THREE.Mesh(new THREE.CircleGeometry(6.2, 48), new THREE.MeshBasicMaterial({ color: '#0b0806' }));
  foso.rotation.x = -Math.PI / 2; foso.position.y = 1.21; grupo.add(foso);

  // Torre de servicio: estructura de celosía (una sola InstancedMesh).
  const metal = new THREE.MeshStandardMaterial({ color: '#6e2a22', roughness: 0.6, metalness: 0.4 });
  const piezas = [];
  const TX = 11.5, TZ = 2.0, A = 1.9, ALTO = 45, PASO = 2.2;
  const viga = (a, b, g = 0.22) => piezas.push({ a, b, g });
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) viga([TX + dx * A / 2, 1.2, TZ + dz * A / 2], [TX + dx * A / 2, ALTO, TZ + dz * A / 2], 0.13);
  for (let y = 1.2 + PASO; y < ALTO; y += PASO) {
    const esq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = esq[k], [bx, bz] = esq[(k + 1) % 4];
      viga([TX + ax * A / 2, y, TZ + az * A / 2], [TX + bx * A / 2, y, TZ + bz * A / 2], 0.08);
      viga([TX + ax * A / 2, y - PASO, TZ + az * A / 2], [TX + bx * A / 2, y, TZ + bz * A / 2], 0.05);
    }
  }
  // brazos hacia la nave (a la altura de la cabina y de la clase Anillo)
  for (const y of [30.5, 41]) {
    viga([TX - A / 2, y, TZ - 0.45], [5.4, y, 0.75], 0.12); viga([TX - A / 2, y, TZ + 0.45], [5.4, y, 1.45], 0.12);
    viga([TX - A / 2, y + 1.3, TZ], [5.6, y + 1.3, 1.1], 0.07);
  }
  const gV = new THREE.BoxGeometry(1, 1, 1);
  const torre = new THREE.InstancedMesh(gV, metal, piezas.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  piezas.forEach((pz, i) => {
    va.fromArray(pz.a); vb.fromArray(pz.b);
    const L = va.distanceTo(vb); const dir = vb.clone().sub(va).normalize();
    q.setFromUnitVectors(up, dir);
    m.compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(pz.g, L, pz.g));
    torre.setMatrixAt(i, m);
  });
  torre.castShadow = true; grupo.add(torre);
  // pasarelas de los brazos
  for (const y of [30.5, 41]) {
    const pas = new THREE.Mesh(new THREE.BoxGeometry(TX - 5.4, 0.12, 0.8), new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.8 }));
    pas.position.set((TX + 5.4) / 2 - 0.5, y - 0.06, 1.1); grupo.add(pas);
  }

  // Balizas rojas que titilan (la de arriba de la torre y las de los mástiles).
  const balizas = [];
  const matBaliza = () => new THREE.MeshBasicMaterial({ color: '#ff3b30' });
  const addBaliza = (x, y, z, fase) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), matBaliza()); b.position.set(x, y, z);
    b.userData.fase = fase; grupo.add(b); balizas.push(b);
  };
  addBaliza(TX, ALTO + 0.3, TZ, 0);

  // Mástiles de reflectores alrededor (las luces que bañan la nave van en mundo.js).
  const mastiles = [];
  const MAST = [[-26, -14], [24, -22], [-22, 24], [28, 18]];
  MAST.forEach(([x, z], i) => {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 8, 6), metal);
    poste.position.set(x, 4, z); grupo.add(poste);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.22), new THREE.MeshStandardMaterial({ color: '#222' }));
    cab.position.set(x, 8.1, z); cab.lookAt(0, 26, 0); grupo.add(cab);
    const foco = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.38), new THREE.MeshBasicMaterial({ color: '#fff3d6' }));
    foco.position.copy(cab.position); foco.lookAt(0, 26, 0); foco.translateZ(0.12); grupo.add(foco);
    addBaliza(x, 8.5, z, i * 0.7 + 0.3);
    mastiles.push(new THREE.Vector3(x, 8.1, z));
  });

  // Montañas al fondo (siluetas).
  const rm = mulberry32(12); const pts = [];
  const NM = 140;
  for (let i = 0; i <= NM; i++) {
    const a = (i / NM) * Math.PI * 2;
    const h = 18 + rm() * 26 + Math.sin(a * 3) * 10;
    pts.push(a, h);
  }
  const gm = new THREE.BufferGeometry(); const vm = [];
  for (let i = 0; i < NM; i++) {
    const [a0, h0, a1, h1] = [pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]];
    const R = 560;
    const p0 = [Math.cos(a0) * R, -5, Math.sin(a0) * R], p1 = [Math.cos(a1) * R, -5, Math.sin(a1) * R];
    const q0 = [Math.cos(a0) * R, h0 + 40, Math.sin(a0) * R], q1 = [Math.cos(a1) * R, h1 + 40, Math.sin(a1) * R];
    vm.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
  }
  gm.setAttribute('position', new THREE.Float32BufferAttribute(vm, 3)); gm.computeVertexNormals();
  grupo.add(new THREE.Mesh(gm, new THREE.MeshBasicMaterial({ color: '#0d0b10', side: THREE.DoubleSide, fog: false })));

  return {
    grupo, mastiles,
    actualizar(t) {
      for (const b of balizas) {
        const on = ((t * 0.8 + b.userData.fase) % 1) < 0.18;
        b.material.color.set(on ? '#ff4b3e' : '#3a0d0b');
      }
    },
  };
}
