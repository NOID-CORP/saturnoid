// Cámaras: funciones puras (entra el tiempo, sale posición + mirada). Sirven igual para la web y para un video.
import * as THREE from 'three';
import { clamp, io, lerp, suave } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Portada: la nave en la plataforma con Saturnoid detrás. Deriva lenta alrededor de la nave.
export function camaraPortada(t, aspecto = 1) {
  const vertical = aspecto < 0.85;
  const R = vertical ? 96 : 82;
  const ang = 0.3 + 0.08 * Math.sin(t * 0.045);
  const pos = V(Math.sin(ang) * R, 5.5 + 1.2 * Math.sin(t * 0.06), Math.cos(ang) * R);
  const mira = V(0, vertical ? 29 : 28, 0);
  return { pos, mira, fov: vertical ? 58 : 42 };
}

// Ruta del vuelo: desde donde está la cámara, rodea la nave por la derecha y entra por la ventana de la clase.
export function armarVuelo(desde, interior) {
  const y = interior.ruta[0].y;
  const puntos = [desde.pos.clone(), V(36, y + 6, 12), V(30, y + 3, -28), ...interior.ruta];
  const miras = [desde.mira.clone(), V(0, y + 2, 0), V(0, y, 0), ...interior.miras];
  return {
    pos: new THREE.CatmullRomCurve3(puntos, false, 'centripetal'),
    mira: new THREE.CatmullRomCurve3(miras, false, 'centripetal'),
  };
}

// p de 0 a 1 (ya con su curva de velocidad) → posición y mirada.
export function camaraVuelo(p, vuelo) {
  const k = io(clamp(p));
  return { pos: vuelo.pos.getPoint(k), mira: vuelo.mira.getPoint(k) };
}

function angulos(desde, hacia) {
  const d = hacia.clone().sub(desde);
  return { yaw: Math.atan2(d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}
function angLerp(a, b, k) {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// Pitch absoluto permitido desde el asiento (más allá se ve el techo o el piso de frente).
const PITCH_MIN = -1.1, PITCH_MAX = 1.2;

// Recorrido automático al llegar al asiento (frente → izquierda → derecha → frente), como desvío de la mirada al
// frente: { yaw, pitch } en radianes. tl = segundos desde que llegó.
export function recorridoPOV(tl, pov) {
  const c = angulos(pov.pos, pov.centro), iz = angulos(pov.pos, pov.izq), de = angulos(pov.pos, pov.der);
  let yaw = c.yaw, pitch = c.pitch;
  const tramos = [[1.0, 2.6, c, iz], [3.4, 5.6, iz, de], [6.4, 8.0, de, c]];
  for (const [a, b, A, B] of tramos) {
    if (tl >= a) { const k = suave(clamp((tl - a) / (b - a))); yaw = angLerp(A.yaw, B.yaw, k); pitch = lerp(A.pitch, B.pitch, k); }
  }
  return { yaw: angLerp(0, yaw - c.yaw, 1), pitch: pitch - c.pitch };
}

// Cuánto se puede subir o bajar la mirada desde el frente de este asiento (deja margen para el balanceo).
export function limitesPOV(pov) {
  const c = angulos(pov.pos, pov.centro);
  return [PITCH_MIN + 0.03 - c.pitch, PITCH_MAX - 0.03 - c.pitch];
}

// Desde el asiento. tl = segundos desde que llegó.
// arrastre = { yaw, pitch, activo } en radianes, desvío de la mirada al frente. Con activo = false se suma al
// recorrido automático; con activo = true reemplaza al recorrido (la web lo usa así: js/mirada.js ya lo incluye).
export function camaraPOV(tl, pov, arrastre = { yaw: 0, pitch: 0, activo: false }) {
  const c = angulos(pov.pos, pov.centro);
  let yaw = c.yaw, pitch = c.pitch;
  if (!arrastre.activo) { const r = recorridoPOV(tl, pov); yaw += r.yaw; pitch += r.pitch; }
  yaw += arrastre.yaw + Math.sin(tl * 0.35) * 0.015;
  pitch = clamp(pitch + arrastre.pitch + Math.sin(tl * 0.5) * 0.008, PITCH_MIN, PITCH_MAX);
  const dir = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  return { pos: pov.pos.clone(), mira: pov.pos.clone().add(dir.multiplyScalar(5)) };
}

// Verse sentado: la cámara gira alrededor de la cabeza del pasajero (detrás, arriba y un poco de lado) con la misma
// mirada que desde el asiento: arrastrar a los lados le da la vuelta; arriba/abajo sube o baja la cámara.
// dist en unidades de la nave (0,62 ≈ 1,5 m adentro). pov.techo (si existe) es la altura máxima de la cámara.
export function camaraTercera(tl, pov, arrastre = { yaw: 0, pitch: 0 }, dist = 0.62) {
  const c = angulos(pov.pos, pov.centro);
  const yaw = c.yaw + arrastre.yaw, pitch = c.pitch + arrastre.pitch;
  const elev = clamp(0.62 - pitch * 0.9, 0.25, 1.2);
  const az = yaw + 0.45; // un poco de lado: se ve el casco y el visor, no solo la nuca
  const pos = pov.pos.clone().add(V(-Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist));
  if (pov.techo != null && pos.y > pov.techo) pos.y = pov.techo;
  const mira = pov.pos.clone().add(V(Math.sin(yaw) * dist * 0.35, -0.03, -Math.cos(yaw) * dist * 0.35));
  return { pos, mira };
}

// Orientación del celular (deviceorientation: alpha, beta, gamma en grados; ángulo de la pantalla en radianes) →
// hacia dónde mira la parte de atrás del celular, como { yaw, pitch } del mundo. Misma convención que camaraPOV.
// El yaw sale de la dirección horizontal "de frente" aunque el celular esté casi acostado (ahí la parte de atrás
// mira al piso y el yaw se volvería loco): se combina con hacia dónde apunta el borde de arriba de la pantalla.
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2); // la cámara mira por la parte de atrás, no hacia arriba
const _z = V(0, 0, 1), _f = V(0, 0, 0), _u = V(0, 0, 0);
export function miradaSensor(alpha, beta, gamma, anguloPantalla = 0) {
  const r = THREE.MathUtils.degToRad;
  _e.set(r(beta), r(alpha), -r(gamma), 'YXZ');
  _q.setFromEuler(_e).multiply(_q1).multiply(_q0.setFromAxisAngle(_z, -anguloPantalla));
  _f.set(0, 0, -1).applyQuaternion(_q); // de frente
  _u.set(0, 1, 0).applyQuaternion(_q);  // borde de arriba de la pantalla
  // sin giro lateral, f_h − f.y·u_h apunta exactamente al yaw (y nunca se anula, ni con el celular acostado)
  const hx = _f.x - _f.y * _u.x, hz = _f.z - _f.y * _u.z;
  return { yaw: Math.atan2(hx, -hz), pitch: Math.atan2(_f.y, Math.hypot(_f.x, _f.z)) };
}
