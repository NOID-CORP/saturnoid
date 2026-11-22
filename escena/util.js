// Utilidades deterministas de la escena (las mismas para la web y para renderizar videos con HyperFrames).
// Regla: nada de Math.random sin semilla; el tiempo siempre entra como parámetro.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const suave = (k) => k * k * (3 - 2 * k);
export const io = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const out = (k) => 1 - Math.pow(1 - k, 3);
export const tramo = (t, a, b) => clamp((t - a) / (b - a));

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Semilla estable a partir de un texto (p. ej. el usuario: su pase y su asiento siempre salen iguales).
export function semilla(texto) {
  let h = 2166136261;
  for (const ch of String(texto)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function lienzo(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// Ruido suave en función del tiempo (para vibración y parpadeos): suma de senos con fases fijas.
export function temblor(t, semillaN = 0) {
  const s = semillaN * 1.618;
  return Math.sin(t * 37.1 + s) * 0.5 + Math.sin(t * 53.7 + s * 2.1) * 0.3 + Math.sin(t * 91.3 + s * 3.7) * 0.2;
}

export const C = {
  cafe: '#362011', cafeOsc: '#1e1209', tinto: '#4D0C10', tintoClaro: '#8a2a2e', azul: '#C7D8EE',
  mant: '#FAECB2', crema: '#EFE6D2', oro: '#F2C14E', plata: '#D9DEE6', blanco: '#F7F1E6',
};

// GLSL: ruido 3D por valor + fbm (lo comparten el planeta y las nubes).
export const GLSL_RUIDO = /* glsl */ `
float hash3(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float ruido(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x), mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x), mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*ruido(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float fbm3(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s+=a*ruido(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
`;
