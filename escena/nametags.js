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

const geo = {};
function geos() {
  if (geo.torso) return geo;
  geo.torso = new THREE.CapsuleGeometry(0.19, 0.32, 4, 12);
  geo.casco = new THREE.SphereGeometry(0.17, 20, 14);
  geo.visor = new THREE.SphereGeometry(0.135, 20, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.4);
  geo.muslo = new THREE.CapsuleGeometry(0.085, 0.3, 4, 8);
  geo.brazo = new THREE.CapsuleGeometry(0.065, 0.3, 4, 8);
  for (const k in geo) geo[k].userData.compartida = true;
  return geo;
}
const matVisor = new THREE.MeshStandardMaterial({ color: '#0f1724', roughness: 0.08, metalness: 0.9, emissive: new THREE.Color('#29486e'), emissiveIntensity: 0.35 });
matVisor.userData.compartida = true;

// Pasajero sentado mirando a +x local. Origen = asiento (cadera), cabeza a ~0.75 m.
export function crearPasajero(colorTraje = '#d9d2c3', colorDetalle = C.tinto) {
  const g = geos();
  const traje = new THREE.MeshStandardMaterial({ color: colorTraje, roughness: 0.7 });
  const detalle = new THREE.MeshStandardMaterial({ color: colorDetalle, roughness: 0.6 });
  const p = new THREE.Group();
  const torso = new THREE.Mesh(g.torso, traje); torso.position.set(-0.04, 0.33, 0); torso.rotation.z = 0.12; p.add(torso);
  const casco = new THREE.Mesh(g.casco, traje); casco.position.set(0.0, 0.76, 0); p.add(casco);
  const visor = new THREE.Mesh(g.visor, matVisor); visor.position.copy(casco.position); visor.rotation.y = Math.PI; visor.scale.setScalar(1.3); p.add(visor);
  const franja = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 20), detalle); franja.position.set(0, 0.62, 0); franja.rotation.x = Math.PI / 2; p.add(franja);
  for (const z of [-0.1, 0.1]) {
    const m = new THREE.Mesh(g.muslo, traje); m.position.set(0.2, 0.05, z); m.rotation.z = Math.PI / 2; p.add(m);
    const pierna = new THREE.Mesh(g.muslo, traje); pierna.position.set(0.4, -0.2, z); p.add(pierna);
    const b = new THREE.Mesh(g.brazo, traje); b.position.set(0.08, 0.3, z * 2.3); b.rotation.z = 0.9; p.add(b);
  }
  return p;
}
