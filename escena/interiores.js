// Interior de cada clase, construido alrededor del asiento buscado, con los vecinos de verdad y sus nametags.
// Todo va en coordenadas de la nave (se agrega a nave.cuerpo, así vibra con ella). Las ventanas miran a -z.
// crearInterior(clase, opciones) → { grupo, ruta, miras, pov, actualizar(t), liberar() }
//   ruta/miras: puntos (afuera → adentro → asiento) y a dónde mira la cámara en cada uno.
//   pov: { pos, centro, izq, der }: la cabeza del pasajero y las tres miradas del recorrido automático.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { crearNametag, crearPasajero } from './nametags.js';
import { SECCIONES } from './nave.js';
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

function tagDe(clase) { return CLASES[clase].tag; }

// Coloca un pasajero (si el asiento tiene dueño conocido) con su nametag encima.
function sentar(grupo, ocupante, { pos, rotY, clase, traje, detalle, alturaTag = 1.12, tag }) {
  if (!ocupante) return null;
  const p = crearPasajero(traje, detalle); p.position.copy(pos); p.rotation.y = rotY; grupo.add(p);
  const nt = crearNametag(ocupante.etiqueta || ocupante.usuario, tag || tagDe(clase), { etiqueta: ocupante.rol || null });
  nt.position.copy(pos).add(V(0, alturaTag, 0)); grupo.add(nt);
  return p;
}

// ---------- CABINA DE MANDO ----------
function cabina({ asiento, ocupantes, info }) {
  const g = new THREE.Group(); const S = SECCIONES.cabina; const R = 4.75;
  const piso = S.piso, techo = S.techo, vIn = 36.3, vOut = 38.7; const ABRE = 1.15;
  const mPared = mat('#2a2f3a', 0.6, 0.2), mPiso = mat('#1b1a1f', 0.8), mTrim = mat(C.azul, 0.4, 0.3);
  // pared con el ventanal hacia -z
  const pared = new THREE.Mesh(new THREE.CylinderGeometry(R, R, techo - piso, 48, 1, true, Math.PI + ABRE, Math.PI * 2 - ABRE * 2), mPared);
  pared.material.side = THREE.DoubleSide; pared.position.y = (piso + techo) / 2; g.add(pared);
  for (const [a, b] of [[piso, vIn], [vOut, techo]]) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(R, R, b - a, 32, 1, true, Math.PI - ABRE, ABRE * 2), mPared);
    seg.material.side = THREE.DoubleSide; seg.position.y = (a + b) / 2; g.add(seg);
  }
  for (let k = -3; k <= 3; k++) { // parales del ventanal
    const a = Math.PI + k * (ABRE / 3.2);
    g.add(caja(0.045, vOut - vIn, 0.08, mat('#1b1f27', 0.5, 0.6), Math.sin(a) * (R - 0.02), (vIn + vOut) / 2, Math.cos(a) * (R - 0.02)));
  }
  const pisoM = new THREE.Mesh(new THREE.CircleGeometry(R, 48), mPiso); pisoM.rotation.x = -Math.PI / 2; pisoM.position.y = piso; g.add(pisoM);
  const techoM = new THREE.Mesh(new THREE.CircleGeometry(R, 48), mPared); techoM.rotation.x = Math.PI / 2; techoM.position.y = techo; g.add(techoM);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: '#9fc3ff' }));
  aro.rotation.x = Math.PI / 2; aro.position.y = techo - 0.06; g.add(aro);
  // consola curva bajo el ventanal con pantallas (datos reales)
  const consola = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.35, 0.95, 32, 1, false, Math.PI - ABRE * 0.95, ABRE * 1.9), mat('#2b2622', 0.5, 0.3));
  consola.position.y = piso + 0.48; g.add(consola);
  const textos = [
    (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); dibujarPlaneta(x, W * 0.5, H * 0.55, H * 0.24); x.fillStyle = C.mant; x.font = fuente(500, H * 0.11); x.fillText('DESTINO · SATURNOID', W * 0.06, H * 0.16); },
    (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); x.fillStyle = C.azul; x.font = fuente(500, H * 0.11); x.fillText('PASAJEROS A BORDO', W * 0.06, H * 0.18); x.fillStyle = C.mant; x.font = fuente(800, H * 0.36, 'Panchang'); x.fillText(String(info.pasajeros ?? 0), W * 0.06, H * 0.62); x.fillStyle = C.azul; x.font = fuente(500, H * 0.1); x.fillText(info.lineaMeta || '', W * 0.06, H * 0.86); },
    (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); x.fillStyle = C.azul; x.font = fuente(500, H * 0.11); x.fillText('ESTADO DE LA NAVE', W * 0.06, H * 0.18); x.fillStyle = info.nivel > 0 ? '#ffb15c' : C.mant; x.font = fuente(500, H * 0.15); x.fillText((info.nivelNombre || '').toUpperCase(), W * 0.06, H * 0.5); for (let i = 0; i < 3; i++) { x.fillStyle = i < info.nivel ? '#ff8a3d' : 'rgba(199,216,238,.25)'; x.fillRect(W * (0.06 + i * 0.3), H * 0.68, W * 0.26, H * 0.12); } },
  ];
  textos.forEach((d, i) => {
    const a = Math.PI + (i - 1) * 0.55;
    const p = cartel(1.15, 0.65, d, { px: 360 });
    p.position.set(Math.sin(a) * 4.15, piso + 1.25, Math.cos(a) * 4.15);
    p.lookAt(0, piso + 1.6, 0); p.rotateX(-0.35); g.add(p);
  });
  // asientos: fila de adelante (C-02, C-03, C-01, C-04, C-05) y fila de atrás elevada (C-06…C-10)
  const mAsiento = mat('#3a2418', 0.55), mAcento = mat(C.azul, 0.4);
  const lugares = {};
  const filaA = ['C-02', 'C-03', 'C-01', 'C-04', 'C-05'], filaB = ['C-06', 'C-07', 'C-08', 'C-09', 'C-10'];
  const poner = (cod, a, r, alto) => {
    const base = V(Math.sin(a) * r, piso + alto, Math.cos(a) * r);
    const rotY = a - Math.PI / 2;
    const s = new THREE.Group(); s.position.copy(base); s.rotation.y = rotY; g.add(s);
    s.add(caja(0.62, 0.14, 0.6, mAsiento, 0.05, 0.36, 0, 0.05));
    s.add(caja(0.14, 0.82, 0.6, mAsiento, -0.24, 0.8, 0, 0.05));
    s.add(caja(0.16, 0.06, 0.62, mAcento, -0.24, 1.22, 0));
    s.add(caja(0.3, 0.36, 0.3, mat('#222', 0.5, 0.6), 0, 0.17, 0));
    lugares[cod] = { pos: base.clone().add(V(0, 0.42, 0)), rotY, a };
    if (alto > 0) { const tarima = caja(0.9, alto, 0.9, mPiso, base.x, piso + alto / 2, base.z); tarima.rotation.y = rotY; g.add(tarima); }
  };
  filaA.forEach((c, i) => poner(c, Math.PI + (i - 2) * 0.33, 3.0, 0));
  filaB.forEach((c, i) => poner(c, Math.PI + (i - 2) * 0.4, 1.55, 0.4));
  for (const [cod, l] of Object.entries(lugares)) {
    if (cod === asiento) continue;
    const o = cod === 'C-01' ? { usuario: info.investigadora || 'La investigadora', rol: 'INVESTIGADORA' } : ocupantes.get(cod);
    sentar(g, o, { pos: l.pos, rotY: l.rotY, clase: 'cabina', traje: cod === 'C-01' ? C.mant : '#cfd8e6', detalle: cod === 'C-01' ? C.tinto : '#3c5a80', tag: cod === 'C-01' ? 'investigadora' : 'cabina' });
  }
  const luz = new THREE.PointLight('#bcd4ff', 3.5, 12, 2); luz.position.set(0, techo - 0.4, -1); g.add(luz);
  const yo = lugares[asiento] || lugares['C-02'];
  const cabeza = yo.pos.clone().add(V(Math.sin(yo.a) * 0.05, 0.78, Math.cos(yo.a) * 0.05));
  const centro = V(Math.sin(Math.PI + (yo.a - Math.PI) * 0.4) * 12, 38.6, Math.cos(Math.PI + (yo.a - Math.PI) * 0.4) * 12);
  return {
    grupo: g,
    ruta: [V(0, 37.6, -16), V(0, 37.5, -4.4), V(0, 37.6, -2.2), cabeza.clone().add(V(0, 0.4, 0)), cabeza],
    miras: [V(0, 37.4, 0), V(0, 37.3, 0), V(0, 36.6, 3), V(cabeza.x * 2.2, 37.4, cabeza.z * 2.2), centro],
    pov: { pos: cabeza, centro, izq: V(-6, 36.4, -1), der: V(6, 36.4, -1) },
    actualizar() {},
  };
}

// ---------- CLASE ANILLO (suite con cúpula) ----------
function anillo({ asiento, ocupantes, info, usuario }) {
  const g = new THREE.Group(); const S = SECCIONES.anillo; const piso = S.piso, techo = S.techo;
  const PASO = (Math.PI * 2) / 12; const a0 = leerAsiento(asiento);
  const mPared = mat('#efe3c8', 0.75), mOro = mat(C.oro, 0.3, 0.8), mMadera = mat('#6b4426', 0.6), mPiso = mat('#d9c7a2', 0.95);
  const rr = mulberry32(semilla(asiento));
  // piso, techo con luz indirecta, columna central y parte alta de la pared (abajo queda abierto hacia cada cúpula)
  const anilloGeo = new THREE.RingGeometry(1.5, 4.9, 64, 1);
  const pisoM = new THREE.Mesh(anilloGeo, mPiso); pisoM.rotation.x = -Math.PI / 2; pisoM.position.y = piso; g.add(pisoM);
  const techoM = new THREE.Mesh(anilloGeo, mPared); techoM.rotation.x = Math.PI / 2; techoM.position.y = techo; g.add(techoM);
  const cove = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.04, 6, 96), new THREE.MeshBasicMaterial({ color: '#ffd59a' }));
  cove.rotation.x = Math.PI / 2; cove.position.y = techo - 0.08; g.add(cove);
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, techo - piso, 32, 1, true), mat('#3a2418', 0.5, 0.2));
  columna.material.side = THREE.DoubleSide; columna.position.y = (piso + techo) / 2; g.add(columna);
  const dintel = new THREE.Mesh(new THREE.CylinderGeometry(4.88, 4.88, techo - 30.9, 64, 1, true), mPared);
  dintel.material.side = THREE.DoubleSide; dintel.position.y = (30.9 + techo) / 2; g.add(dintel);
  const zocalo = new THREE.Mesh(new THREE.CylinderGeometry(4.88, 4.88, 0.25, 64, 1, true), mOro);
  zocalo.material.side = THREE.DoubleSide; zocalo.position.y = 30.85; g.add(zocalo);

  const lugares = [];
  for (let d = -2; d <= 2; d++) {
    const i = a0.i + d; if (i < 0) continue;
    const cod = codigoAsiento('anillo', i);
    const a = Math.PI + d * PASO; // la suite propia queda hacia -z
    const s = new THREE.Group(); s.rotation.y = a - Math.PI; g.add(s); // en este marco, "afuera" es -z
    // pilares y mamparas de vidrio esmerilado a cada lado
    for (const lado of [-1, 1]) {
      const b = lado * PASO / 2;
      const mampara = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.25), new THREE.MeshStandardMaterial({ color: '#f6eedc', transparent: true, opacity: 0.22, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
      mampara.position.set(Math.sin(b) * -3.2, piso + 1.62, Math.cos(b) * -3.2); mampara.rotation.y = b + Math.PI / 2; s.add(mampara);
      const marco = caja(0.06, 3.25, 0.06, mOro, Math.sin(b) * -4.85, piso + 1.62, Math.cos(b) * -4.85); s.add(marco);
    }
    // cama con cobija tinto y almohadas mantequilla
    s.add(caja(1.05, 0.42, 2.0, mMadera, -0.42, piso + 0.21, -3.05, 0.06));
    s.add(caja(1.0, 0.16, 1.95, mat('#f4ead6', 0.9), -0.42, piso + 0.5, -3.05, 0.07));
    s.add(caja(1.02, 0.08, 1.2, mat(C.tinto, 0.85), -0.42, piso + 0.6, -3.45, 0.04));
    s.add(caja(0.42, 0.14, 0.28, mat(C.mant, 0.9), -0.62, piso + 0.66, -2.2, 0.06));
    s.add(caja(0.42, 0.14, 0.28, mat(C.mant, 0.9), -0.2, piso + 0.66, -2.2, 0.06));
    s.add(caja(1.1, 0.9, 0.08, mMadera, -0.42, piso + 0.85, -2.02, 0.03));
    // mesa del chef: plato, campana de plata, copa
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), mMadera); mesa.position.set(0.55, piso + 0.72, -3.75); s.add(mesa);
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 8), mOro); pata.position.set(0.55, piso + 0.36, -3.75); s.add(pata);
    const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.02, 24), mat('#ffffff', 0.3)); plato.position.set(0.5, piso + 0.75, -3.7); s.add(plato);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(['#c0592f', '#7aa04a', '#f2c14e', '#a33', '#e8d3a0'][k], 0.6)); b.position.set(0.5 + (rr() - 0.5) * 0.12, piso + 0.78, -3.7 + (rr() - 0.5) * 0.12); s.add(b); }
    const campana = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d9dde3', 0.15, 1));
    campana.position.set(0.68, piso + 0.83, -3.86); campana.rotation.z = 1.1; s.add(campana);
    const copa = new THREE.Mesh(new THREE.LatheGeometry([V(0, 0, 0), V(0.035, 0, 0), V(0.006, 0.01, 0), V(0.006, 0.09, 0), V(0.04, 0.12, 0), V(0.045, 0.19, 0)].map((v) => new THREE.Vector2(v.x, v.y)), 16), mat('#f7f2ff', 0.05, 0.1, { transparent: true, opacity: 0.55 }));
    copa.position.set(0.36, piso + 0.74, -3.85); s.add(copa);
    // jardín: jardinera con plantas y un arbolito
    s.add(caja(0.42, 0.42, 1.0, mMadera, 0.72, piso + 0.21, -2.45, 0.03));
    for (let k = 0; k < 16; k++) {
      const h = 0.2 + rr() * 0.45;
      const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.06 + rr() * 0.05, h, 6), mat(['#2f6b34', '#3f8a3e', '#5aa050', '#2b5a2f'][k % 4], 0.8));
      hoja.position.set(0.72 + (rr() - 0.5) * 0.3, piso + 0.42 + h / 2, -2.45 + (rr() - 0.5) * 0.85); hoja.rotation.set((rr() - 0.5) * 0.6, 0, (rr() - 0.5) * 0.6); s.add(hoja);
    }
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.7, 8), mMadera); tronco.position.set(0.85, piso + 0.75, -2.15); s.add(tronco);
    const copaArbol = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), mat('#3f7d3a', 0.85)); copaArbol.position.set(0.85, piso + 1.2, -2.15); s.add(copaArbol);
    // poltrona dentro de la cúpula (sobre el anillo exterior)
    s.add(caja(0.7, 0.2, 1.1, mat(C.mant, 0.8), 0, 27.5, -6.2, 0.08));
    const resp = caja(0.7, 0.6, 0.18, mat(C.mant, 0.8), 0, 27.8, -5.7, 0.08); resp.rotation.x = -0.5; s.add(resp);
    // lámpara de noche
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd28a' })); lamp.position.set(-1.05, piso + 1.05, -2.25); s.add(lamp);
    // placa
    if (d === 0) {
      const placa = cartel(0.9, 0.36, (x, W, H) => {
        x.fillStyle = '#2a1a10'; x.fillRect(0, 0, W, H); x.strokeStyle = C.oro; x.lineWidth = 6; x.strokeRect(6, 6, W - 12, H - 12);
        x.fillStyle = C.oro; x.textAlign = 'center'; x.font = fuente(800, H * 0.3, 'Panchang'); x.fillText(`SUITE ${cod}`, W / 2, H * 0.48);
        x.font = fuente(500, H * 0.15); x.fillText('GRAVEDAD COMPLETA · MENÚ DEL CHEF', W / 2, H * 0.78);
      }, { px: 400 });
      placa.position.set(0.0, 31.55, -4.8); placa.lookAt(0, 31.55, 0); s.add(placa);
    }
    const local = V(-0.42, piso + 0.55, -3.0);
    lugares.push({ cod, d, s, local });
    if (d !== 0) {
      const o = ocupantes.get(cod);
      if (o) {
        const p = crearPasajero('#f1e6cc', C.oro); p.position.copy(local); p.rotation.y = -Math.PI / 2 + Math.PI; s.add(p);
        const nt = crearNametag(o.usuario, 'oro'); nt.position.copy(local).add(V(0, 1.15, 0)); s.add(nt);
      }
    }
  }
  const luz = new THREE.PointLight('#ffd7a0', 3.2, 9, 2); luz.position.set(0, techo - 0.5, -3); g.add(luz);
  const luz2 = new THREE.PointLight('#ffc27a', 1.0, 5, 2); luz2.position.set(0.6, piso + 1.2, -3.5); g.add(luz2);
  const cabeza = V(-0.42, piso + 1.35, -2.45);
  return {
    grupo: g,
    ruta: [V(0, 30.8, -19), V(0, 29.6, -8.8), V(0, 29.0, -5.6), V(-0.2, 29.0, -3.6), cabeza],
    miras: [V(0, 28.6, -6), V(0, 28.7, 0), V(-0.3, 28.6, 0), V(-0.4, 28.0, -1), V(0.1, 29.6, -12)],
    pov: { pos: cabeza, centro: V(0.15, 31.0, -12), izq: V(-6.5, 28.2, -3.2), der: V(6.5, 28.2, -3.2) },
    actualizar() {},
  };
}

// ---------- ÓRBITA y TURISTA (filas) ----------
function filas(clase, { asiento, ocupantes, info, usuario }) {
  const g = new THREE.Group(); const S = SECCIONES[clase]; const piso = S.piso, techo = S.techo;
  const esT = clase === 'turista'; const c = CLASES[clase]; const a0 = leerAsiento(asiento);
  const PASO = esT ? 0.78 : 1.2; const X0 = -3.0, X1 = 3.0, Z0 = esT ? -3.95 : -4.0, Z1 = -0.05;
  const colZ = esT ? [-3.55, -3.07, -2.59, -1.41, -0.93, -0.45] : [-3.45, -2.75, -1.45, -0.75];
  const mPared = esT ? mat('#5b5750', 0.9) : mat('#e9e1d0', 0.8), mPiso = esT ? mat('#3a3631', 0.95) : mat('#5d6470', 0.95);
  const r = mulberry32(semilla(asiento));
  // caja del salón
  const ancho = X1 - X0, fondo = Z1 - Z0, alto = techo - piso;
  g.add(caja(ancho, 0.05, fondo, mPiso, 0, piso - 0.025, (Z0 + Z1) / 2));
  g.add(caja(ancho, 0.05, fondo, mPared, 0, techo + 0.025, (Z0 + Z1) / 2));
  g.add(caja(ancho, alto, 0.05, mPared, 0, (piso + techo) / 2, Z1));
  g.add(caja(0.05, alto, fondo, mPared, X1, (piso + techo) / 2, (Z0 + Z1) / 2));
  g.add(caja(0.05, alto, fondo, mPared, X0, (piso + techo) / 2, (Z0 + Z1) / 2));
  if (esT) {
    g.add(caja(ancho, alto, 0.05, mPared, 0, (piso + techo) / 2, Z0)); // sin ventana
    // tubos y ductos
    for (let k = 0; k < 4; k++) {
      const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + k * 0.012, 0.05 + k * 0.012, ancho, 10), mat(['#7a6e5f', '#8c3a2e', '#6b6f73', '#a8873f'][k], 0.5, 0.5));
      tubo.rotation.z = Math.PI / 2; tubo.position.set(0, techo - 0.12 - k * 0.13, Z0 + 0.12 + (k % 2) * 0.1); g.add(tubo);
    }
    g.add(caja(ancho, 0.22, 0.3, mat('#4a4640', 0.7, 0.4), 0, techo - 0.15, (Z0 + Z1) / 2));
    // "aquí iría una ventana"
    const falsa = cartel(1.1, 0.7, (x, W, H) => {
      x.fillStyle = '#5b5750'; x.fillRect(0, 0, W, H);
      x.setLineDash([18, 12]); x.strokeStyle = '#f2e6c8'; x.lineWidth = 6; x.beginPath(); x.ellipse(W / 2, H / 2, W * 0.36, H * 0.38, 0, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#f2e6c8'; x.textAlign = 'center'; x.font = fuente(500, H * 0.1); x.fillText('VENTANA:', W / 2, H * 0.45); x.fillText('NO INCLUIDA', W / 2, H * 0.6);
    }, { emisivo: false, px: 300 });
    falsa.position.set(0.4, piso + 1.45, Z0 + 0.03); g.add(falsa);
  } else {
    // ventana compartida: banda abierta con vidrio y parales
    const vIn = piso + 1.0, vOut = piso + 2.9;
    g.add(caja(ancho, vIn - piso, 0.05, mPared, 0, (piso + vIn) / 2, Z0));
    g.add(caja(ancho, techo - vOut, 0.05, mPared, 0, (vOut + techo) / 2, Z0));
    for (let x = X0; x <= X1 + 0.01; x += 1.0) g.add(caja(0.06, vOut - vIn, 0.09, mat('#2c3038', 0.6, 0.3), x, (vIn + vOut) / 2, Z0));
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(ancho, vOut - vIn), new THREE.MeshStandardMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.07, roughness: 0.05, depthWrite: false }));
    vidrio.position.set(0, (vIn + vOut) / 2, Z0 + 0.01); g.add(vidrio);
    for (let x = X0 + 0.3; x < X1; x += 1.5) g.add(caja(0.9, 0.03, 0.12, new THREE.MeshBasicMaterial({ color: '#fff3dc' }), x, techo - 0.03, -2.1));
  }
  // pared de adelante (+x): cartel de la clase
  const frente = cartel(fondo * 0.92, alto * (esT ? 0.5 : 0.62), (x, W, H) => {
    x.fillStyle = esT ? '#4D0C10' : '#1d2633'; x.fillRect(0, 0, W, H);
    x.textAlign = 'center';
    if (esT) {
      x.fillStyle = C.oro; x.font = fuente(800, H * 0.13, 'Panchang'); x.fillText('CADA EPISODIO', W / 2, H * 0.26);
      x.font = fuente(800, H * 0.2, 'Panchang'); x.fillText('3 DE AQUÍ', W / 2, H * 0.5);
      x.font = fuente(800, H * 0.13, 'Panchang'); x.fillText('SUBEN A CLASE ANILLO', W / 2, H * 0.7);
      x.fillStyle = '#f2e6c8'; x.font = fuente(500, H * 0.07); x.fillText('BAÑO: 1 PARA 200 · AL FONDO', W / 2, H * 0.9);
    } else {
      dibujarPlaneta(x, W * 0.5, H * 0.45, H * 0.17);
      x.fillStyle = C.plata; x.font = fuente(800, H * 0.11, 'Panchang'); x.fillText('CLASE ÓRBITA', W / 2, H * 0.86);
    }
  }, { px: 260 });
  frente.position.set(X1 - 0.03, piso + alto * (esT ? 0.7 : 0.55), (Z0 + Z1) / 2); frente.rotation.y = -Math.PI / 2; g.add(frente);
  if (esT) {
    const avisos = [['RUIDO DE MOTORES: INCLUIDO', 1.7, -0.08, 1.4], ['BARRAS DE PROTEÍNA · SABOR: SÍ', -1.6, -0.08, 1.5]];
    for (const [txt, x0, zz, w] of avisos) {
      const a = cartel(w, 0.22, (x, W, H) => { x.fillStyle = '#f2c14e'; x.fillRect(0, 0, W, H); x.fillStyle = '#1e1209'; x.textAlign = 'center'; x.font = fuente(500, H * 0.42); x.fillText(txt, W / 2, H * 0.64); }, { emisivo: false, px: 300 });
      a.position.set(x0, piso + 1.85, Z1 + zz); a.rotation.y = Math.PI; g.add(a);
    }
    const bano = cartel(0.9, 0.34, (x, W, H) => { x.fillStyle = '#111'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff4b3e'; x.textAlign = 'center'; x.font = fuente(500, H * 0.32); x.fillText('BAÑO 1/200', W / 2, H * 0.42); x.font = fuente(500, H * 0.24); x.fillText('FILA: 147', W / 2, H * 0.8); }, { px: 300 });
    bano.position.set(-1.7, piso + 1.75, Z0 + 0.03); g.add(bano);
  }
  // filas de asientos (la del pasajero y dos adelante/atrás). Fila 1 va adelante (+x).
  const mA = esT ? mat('#6f6a62', 0.85) : mat('#8e949e', 0.45, 0.35), mB = esT ? mat('#6d665c', 0.9) : mat(C.azul, 0.5);
  const pantallaTex = (txt, sub) => (x, W, H) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, W, H); dibujarPlaneta(x, W * 0.5, H * 0.42, H * 0.18); x.fillStyle = C.plata; x.textAlign = 'center'; x.font = fuente(500, H * 0.12); x.fillText(txt, W / 2, H * 0.78); x.font = fuente(500, H * 0.09); x.fillStyle = C.azul; x.fillText(sub, W / 2, H * 0.92); };
  let lugarPropio = null;
  for (let df = -2; df <= 2; df++) {
    const fila = a0.fila + df; if (fila < 1) continue;
    const xf = -df * PASO; // fila menor = más adelante (+x)
    if (xf > X1 - 0.5 || xf < X0 + 0.3) continue;
    for (let col = 0; col < c.porFila; col++) {
      const cod = codigoAsiento(clase, (fila - 1) * c.porFila + col);
      const z = colZ[col];
      const s = new THREE.Group(); s.position.set(xf, piso, z); g.add(s);
      if (esT) {
        s.add(caja(0.42, 0.08, 0.44, mA, 0.05, 0.44, 0, 0.02));
        s.add(caja(0.06, 0.62, 0.44, mA, -0.17, 0.78, 0, 0.02));
        s.add(caja(0.1, 0.44, 0.06, mat('#3a3631', 0.8), 0.0, 0.22, 0));
        // barra de proteína en el bolsillo del asiento de adelante (se ve desde atrás)
        s.add(caja(0.02, 0.12, 0.05, mat('#c9a227', 0.6), -0.21, 0.66, 0.08));
      } else {
        s.add(caja(0.62, 0.14, 0.62, mA, 0.08, 0.46, 0, 0.06));
        const resp = caja(0.12, 0.9, 0.62, mA, -0.26, 0.95, 0, 0.06); resp.rotation.z = 0.18; s.add(resp);
        s.add(caja(0.14, 0.08, 0.64, mB, -0.33, 1.38, 0, 0.03));
        s.add(caja(0.5, 0.1, 0.1, mB, 0.06, 0.66, 0.3, 0.03)); s.add(caja(0.5, 0.1, 0.1, mB, 0.06, 0.66, -0.3, 0.03));
        // pantalla propia en el respaldo (mira hacia la fila de atrás)
        const esMia = df === -1 && col === a0.col;
        const pan = cartel(0.36, 0.24, esMia ? pantallaTex(`@${usuario}`, `ASIENTO ${asiento}`) : pantallaTex('SATURNOID', 'CLASE ÓRBITA'), { px: 500 });
        pan.position.set(-0.36, 1.08, 0); pan.rotation.y = -Math.PI / 2; pan.rotation.x = 0; s.add(pan);
        // comida caliente en la bandeja
        if (df >= 0) {
          const bandeja = caja(0.26, 0.02, 0.36, mat('#ddd', 0.4), 0.38, 0.74, 0); s.add(bandeja);
          const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.03, 18), mat('#fff', 0.3)); plato.position.set(0.38, 0.77, -0.06); s.add(plato);
          const comida = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c0592f', 0.6)); comida.position.set(0.38, 0.78, -0.06); s.add(comida);
        }
      }
      const sentado = V(xf, piso + (esT ? 0.48 : 0.52), z);
      if (cod === asiento) { lugarPropio = sentado; continue; }
      const o = ocupantes.get(cod);
      if (o) {
        const p = crearPasajero(esT ? '#b0602e' : '#9aa3ae', esT ? '#4a220e' : C.azul); p.position.copy(sentado); g.add(p);
        if (Math.abs(df) <= 1) { const nt = crearNametag(o.usuario, tagDe(clase)); nt.position.copy(sentado).add(V(0, 1.08 + (col % 2) * 0.13, 0)); g.add(nt); }
      }
    }
  }
  // luz: en turista, un tubo que parpadea
  const tubo = caja(1.4, 0.05, 0.08, new THREE.MeshBasicMaterial({ color: esT ? '#e8f4ff' : '#fff3dc' }), 0, techo - 0.05, -2.0);
  g.add(tubo);
  const BASE_LUZ = esT ? 1.4 : 2.0;
  const luz = new THREE.PointLight(esT ? '#dfefff' : '#f6f1e8', BASE_LUZ, 9, 2); luz.position.set(0, techo - 0.1, -2.0); g.add(luz);
  const cabeza = lugarPropio.clone().add(V(-0.05, esT ? 0.9 : 0.8, 0));
  const pasillo = esT ? -2.0 : -2.1;
  const huecoX = esT ? PASO / 2 : PASO / 2;
  const yViaje = esT ? techo - 0.5 : piso + 1.95;
  const entrada = esT ? V(huecoX, piso + 1.5, -6) : V(huecoX, piso + 1.9, -5.2);
  const ruta = [
    V(huecoX, piso + 1.9, -15), entrada,
    V(huecoX, yViaje, Z0 + 0.5), V(huecoX, yViaje, cabeza.z), V(cabeza.x + 0.15, cabeza.y + 0.15, cabeza.z), cabeza,
  ];
  const miras = [
    V(0, piso + 1.5, 0), V(huecoX, piso + 1.4, 0), V(huecoX, piso + 1.0, cabeza.z), V(cabeza.x, piso + 0.6, cabeza.z),
    V(3, cabeza.y - 0.1, cabeza.z), V(3, cabeza.y - 0.12, esT ? cabeza.z : (cabeza.z - 0.9)),
  ];
  const centro = esT ? V(3, cabeza.y + 0.05, (Z0 + Z1) / 2) : V(cabeza.x - 0.6, cabeza.y + 0.9, Z0 - 3.0);
  return {
    grupo: g, ruta, miras,
    pov: esT
      ? { pos: cabeza, centro, izq: V(cabeza.x + 0.4, cabeza.y - 0.15, Z0 - 2), der: V(cabeza.x + 0.4, cabeza.y - 0.15, Z1 + 2) }
      : { pos: cabeza, centro, izq: V(cabeza.x + 2.4, cabeza.y + 0.15, Z0 + 0.2), der: V(cabeza.x + 2.0, cabeza.y + 0.1, Z1 + 1.5) },
    sacudida: esT ? 0.006 : 0,
    actualizar(t) {
      if (!esT) return;
      // parpadeo determinista: casi siempre prendido, con cortes cortos
      const f = Math.sin(t * 13.1) + Math.sin(t * 7.3 + 1.2) + Math.sin(t * 29.7 + 0.4);
      const on = f > -1.9 ? 1 : 0.15;
      luz.intensity = BASE_LUZ * on * (0.92 + 0.08 * temblor(t, 9));
      tubo.material.color.setScalar(on > 0.5 ? 0.95 : 0.2);
    },
  };
}

// ---------- entrada ----------
// opciones: { asiento, usuario, ocupantes: Map(codigo → { usuario }), info: { pasajeros, investigadora, nivel, nivelNombre, lineaMeta } }
export function crearInterior(clase, opciones) {
  const o = { ocupantes: new Map(), info: {}, ...opciones };
  const r = clase === 'cabina' ? cabina(o) : clase === 'anillo' ? anillo(o) : filas(clase, o);
  r.clase = clase;
  r.liberar = () => {
    r.grupo.traverse((n) => {
      if (n.userData.liberar) n.userData.liberar();
      if (n.geometry && !n.geometry.userData?.compartida) n.geometry.dispose?.();
      if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { if (m.userData.compartida) return; m.map?.dispose(); m.dispose(); }); }
    });
    r.grupo.removeFromParent();
  };
  return r;
}
