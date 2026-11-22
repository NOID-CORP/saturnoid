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

// Desde el asiento. tl = segundos desde que llegó. Recorrido automático: frente → izquierda → derecha → frente.
// arrastre = { yaw, pitch } en radianes (lo que la persona movió con el dedo); si arrastró, el recorrido se detiene.
export function camaraPOV(tl, pov, arrastre = { yaw: 0, pitch: 0, activo: false }) {
  const c = angulos(pov.pos, pov.centro), iz = angulos(pov.pos, pov.izq), de = angulos(pov.pos, pov.der);
  let yaw = c.yaw, pitch = c.pitch;
  if (!arrastre.activo) {
    const tramos = [[1.0, 2.6, c, iz], [3.4, 5.6, iz, de], [6.4, 8.0, de, c]];
    for (const [a, b, A, B] of tramos) {
      if (tl >= a) { const k = suave(clamp((tl - a) / (b - a))); yaw = angLerp(A.yaw, B.yaw, k); pitch = lerp(A.pitch, B.pitch, k); }
    }
  }
  yaw += arrastre.yaw + Math.sin(tl * 0.35) * 0.015;
  pitch = clamp(pitch + arrastre.pitch + Math.sin(tl * 0.5) * 0.008, -1.1, 1.2);
  const dir = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  return { pos: pov.pos.clone(), mira: pov.pos.clone().add(dir.multiplyScalar(5)) };
}
