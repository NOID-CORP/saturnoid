// La nave de Saturnoid. De abajo arriba: motores, Turista (sin ventanas, junto a los motores), Órbita (ventanas),
// Clase Anillo (cúpulas de cristal sobre un anillo, como el del planeta) y la Cabina de mando (ventanal) bajo la punta.
// actualizar(t, nivel): nivel es continuo 0..3 (0 en espera, 1 motor 1, 2 motor 2, 3 despegue) para poder mezclar.
import * as THREE from 'three';
import { mulberry32, lienzo, temblor, clamp, C } from './util.js';

// Alturas de cada sección (metros, en coordenadas de la nave). El piso de cada interior va en .piso.
export const SECCIONES = {
  turista: { piso: 7.0, techo: 9.6, desde: 6, hasta: 14 },
  orbita: { piso: 15.0, techo: 18.4, desde: 14, hasta: 26 },
  anillo: { piso: 27.6, techo: 32.4, desde: 26, hasta: 34 },
  cabina: { piso: 35.0, techo: 39.6, desde: 34, hasta: 42 },
};
export const RADIO_CASCO = 5;
const Y0 = 3.6, Y1 = 58;

export function radioEn(y) {
  if (y < 6) { const s = (y - Y0) / (6 - Y0); return 5.75 - 0.75 * (s * s * (3 - 2 * s)); }
  if (y <= 42) return RADIO_CASCO;
  const s = Math.min(1, (y - 42) / (Y1 - 42));
  return Math.max(0.02, RADIO_CASCO * Math.pow(1 - Math.pow(s, 1.9), 0.62));
}

function texturasCasco() {
  const W = 1024, H = 2048;
  const cv = lienzo(W, H), x = cv.getContext('2d');
  const em = lienzo(W / 2, H / 2), e = em.getContext('2d');
  const yPx = (y) => H - ((y - Y0) / (Y1 - Y0)) * H; // y del casco → píxel
  const uPx = (u) => u * W;
  x.fillStyle = C.crema; x.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W / 2, H / 2);
  const r = mulberry32(99);
  for (let i = 0; i < 3500; i++) { x.fillStyle = `rgba(80,60,40,${r() * 0.04})`; x.fillRect(r() * W, r() * H, 2 + r() * 30, 2 + r() * 30); }
  // hollín hacia abajo
  const g = x.createLinearGradient(0, yPx(14), 0, yPx(Y0));
  g.addColorStop(0, 'rgba(40,28,20,0)'); g.addColorStop(1, 'rgba(40,28,20,.75)');
  x.fillStyle = g; x.fillRect(0, yPx(14), W, yPx(Y0) - yPx(14));
  // paneles
  x.strokeStyle = 'rgba(54,32,17,.28)'; x.lineWidth = 2;
  for (let y = 6; y < 42; y += 2) { x.beginPath(); x.moveTo(0, yPx(y)); x.lineTo(W, yPx(y)); x.stroke(); }
  for (let k = 0; k < 24; k++) { x.beginPath(); x.moveTo(uPx(k / 24), yPx(6)); x.lineTo(uPx(k / 24), yPx(42)); x.stroke(); }
  // franjas tinto
  x.fillStyle = C.tinto;
  x.fillRect(0, yPx(7.4), W, yPx(6.2) - yPx(7.4));
  x.fillRect(0, yPx(43.2), W, yPx(42.2) - yPx(43.2));
  x.fillRect(0, yPx(Y1), W, yPx(53.5) - yPx(Y1));
  x.fillStyle = C.cafe; x.fillRect(0, yPx(26.2), W, yPx(25.6) - yPx(26.2));
  // SATURNOID vertical en el frente (+z = u 0.25)
  x.save(); x.translate(uPx(0.25), yPx(23)); x.rotate(-Math.PI / 2);
  x.fillStyle = C.tinto; x.font = '800 92px "Panchang", "Switzer", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('SATURNOID', 0, 0); x.restore();
  x.fillStyle = C.cafe; x.font = '600 30px "DM Mono", monospace'; x.textAlign = 'center';
  x.fillText('NOID', uPx(0.25), yPx(44.6));
  // rótulos de cada sección (frente, a la izquierda del nombre)
  x.font = '500 20px "DM Mono", monospace'; x.fillStyle = 'rgba(54,32,17,.85)';
  const rot = [['CABINA DE MANDO', 40.6], ['CLASE ANILLO', 33.2], ['CLASE ÓRBITA', 25.2], ['TURISTA', 13.2]];
  for (const [t, y] of rot) x.fillText(t, uPx(0.135), yPx(y));
  x.font = '500 15px "DM Mono", monospace'; x.fillText('(SIN VENTANAS)', uPx(0.135), yPx(12.6));
  // rejillas de Turista
  x.fillStyle = 'rgba(40,28,20,.55)';
  for (let k = 0; k < 12; k++) for (let j = 0; j < 7; j++) x.fillRect(uPx(k / 12 + 0.02), yPx(10.6 - j * 0.32), 28, 4);
  // ventanas de Órbita: dos filas de ojos de buey alrededor
  const ventana = (u, y, rx, ry, color, glow) => {
    x.fillStyle = '#20140c'; x.beginPath(); x.ellipse(uPx(u), yPx(y), rx + 5, ry + 5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = color; x.beginPath(); x.ellipse(uPx(u), yPx(y), rx, ry, 0, 0, Math.PI * 2); x.fill();
    e.fillStyle = glow; e.beginPath(); e.ellipse(uPx(u) / 2, yPx(y) / 2, rx / 2, ry / 2, 0, 0, Math.PI * 2); e.fill();
  };
  for (let k = 0; k < 28; k++) {
    const u = (k + 0.5) / 28; if (Math.abs(u - 0.25) < 0.045) continue;
    ventana(u, 17.0, 11, 13, '#f3c886', '#ffbf66'); ventana(u, 22.6, 11, 13, '#f3c886', '#b97a38');
  }
  // ventanal de la cabina (vuelta completa, vidrio oscuro con brillo azul)
  x.fillStyle = '#20140c'; x.fillRect(0, yPx(38.9), W, yPx(36.1) - yPx(38.9));
  x.fillStyle = '#1b2a3d'; x.fillRect(0, yPx(38.6), W, yPx(36.4) - yPx(38.6));
  e.fillStyle = '#5f86b8'; e.fillRect(0, yPx(38.6) / 2, W / 2, (yPx(36.4) - yPx(38.6)) / 2);
  for (let k = 0; k < 36; k++) { x.fillStyle = '#20140c'; x.fillRect(uPx(k / 36) - 3, yPx(38.9), 6, yPx(36.1) - yPx(38.9)); }
  const t1 = new THREE.CanvasTexture(cv); t1.colorSpace = THREE.SRGBColorSpace; t1.anisotropy = 8;
  const t2 = new THREE.CanvasTexture(em); t2.colorSpace = THREE.SRGBColorSpace;
  return { map: t1, emissiveMap: t2 };
}

// Partículas de vapor/humo: todo se calcula en el shader a partir del tiempo (determinista y barato).
function crearVapor({ calidad }) {
  const N = calidad === 'baja' ? 700 : 1500;
  const r = mulberry32(2024);
  const semilla = new Float32Array(N * 4), tipo = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    semilla.set([r(), r(), r(), r()], i * 4);
    tipo[i] = i < N * 0.28 ? 0 : 1; // 0: venteo lateral (siempre), 1: nubes al pie (crecen con el nivel)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aSemilla', new THREE.BufferAttribute(semilla, 4));
  g.setAttribute('aTipo', new THREE.BufferAttribute(tipo, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 20, 0), 80);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uNivel: { value: 0 }, uEscala: { value: 800 } },
    vertexShader: `attribute vec4 aSemilla; attribute float aTipo; uniform float uT; uniform float uNivel; uniform float uEscala;
      varying float vA; varying float vCalor; varying vec2 vS;
      void main(){
        vec3 p; float tam; float a;
        if (aTipo < 0.5) {
          float vel = 0.10 + aSemilla.y*0.05;
          float f = fract(aSemilla.x + uT*vel);
          float ang = floor(aSemilla.z*6.0)/6.0*6.2832 + 0.3;
          float y0 = aSemilla.w < 0.5 ? 21.0 : 44.0;
          vec3 o = vec3(sin(ang)*5.1, y0, cos(ang)*5.1);
          vec3 dir = normalize(vec3(sin(ang), -0.9 - aSemilla.y, cos(ang)));
          p = o + dir*(f*9.0) + vec3(0.0, -f*f*4.0, 0.0);
          tam = 0.6 + f*2.6; a = sin(f*3.1416)*0.2;
          vCalor = 0.0;
        } else {
          float umbral = aSemilla.w*3.0;
          float on = smoothstep(umbral-0.6, umbral+0.2, uNivel + 0.35);
          float vel = 0.05 + aSemilla.y*0.06 + uNivel*0.02;
          float f = fract(aSemilla.x + uT*vel);
          float ang = aSemilla.z*6.2832;
          float alcance = 10.0 + uNivel*9.0 + aSemilla.y*8.0;
          float rr = 3.0 + f*alcance;
          p = vec3(cos(ang)*rr, 1.6 + f*(2.5 + aSemilla.y*6.0 + uNivel*2.5), sin(ang)*rr);
          tam = 2.6 + f*(6.5 + uNivel*3.0);
          a = sin(f*3.1416)*0.26*on*(0.5 + 0.5*aSemilla.w);
          vCalor = (1.0 - f) * clamp(uNivel*0.6, 0.0, 1.0);
        }
        vA = a; vS = aSemilla.xy;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = tam*uEscala/max(-mv.z, 0.5);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying float vA; varying float vCalor; varying vec2 vS;
      void main(){
        vec2 q = gl_PointCoord - 0.5; float d = length(q);
        float n = sin(q.x*9.0+vS.x*30.0)*sin(q.y*8.0+vS.y*30.0)*0.12;
        float a = smoothstep(0.5, 0.05, d + n) * vA;
        vec3 frio = vec3(0.70,0.74,0.80), calor = vec3(1.0,0.55,0.25);
        gl_FragColor = vec4(mix(frio, calor, vCalor), a);
      }`,
  });
  const puntos = new THREE.Points(g, mat);
  puntos.frustumCulled = false;
  return puntos;
}

function crearLlama() {
  const g = new THREE.CylinderGeometry(0.95, 0.35, 1, 24, 12, true); g.translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uI: { value: 0 }, uFase: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uT; uniform float uI; uniform float uFase; varying vec2 vUv;
      void main(){
        float y = 1.0 - vUv.y; // 0 en la tobera, 1 en la punta
        float onda = sin(y*28.0 - uT*60.0 + uFase)*0.5+0.5;
        float diam = smoothstep(0.0, 0.15, fract(y*5.0 - uT*0.0))*0.25;
        vec3 nucleo = vec3(1.0,0.95,0.80), medio = vec3(1.0,0.58,0.20), punta = vec3(0.55,0.12,0.10);
        vec3 c = mix(nucleo, medio, smoothstep(0.0, 0.35, y));
        c = mix(c, punta, smoothstep(0.45, 1.0, y));
        float a = (1.0 - smoothstep(0.2, 1.0, y)) * (0.65 + 0.35*onda) * uI;
        float lado = 1.0 - abs(vUv.x - 0.5)*0.0;
        gl_FragColor = vec4(c*(1.2 + diam), a*0.9*lado);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

export function crearNave({ calidad = 'media' } = {}) {
  const grupo = new THREE.Group();     // se mueve con la vibración
  const cuerpo = new THREE.Group(); grupo.add(cuerpo);

  // Casco (torno). Solo caras de afuera: desde adentro no se ve, así la cámara puede entrar por una ventana.
  const perfil = [];
  for (let i = 0; i <= 240; i++) { const y = Y0 + (Y1 - Y0) * (i / 240); perfil.push(new THREE.Vector2(radioEn(y), y)); }
  const gCasco = new THREE.LatheGeometry(perfil, calidad === 'baja' ? 64 : 96, -Math.PI / 2);
  const tex = texturasCasco();
  const matCasco = new THREE.MeshStandardMaterial({
    map: tex.map, emissiveMap: tex.emissiveMap, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1,
    roughness: 0.5, metalness: 0.25, side: THREE.FrontSide,
  });
  const casco = new THREE.Mesh(gCasco, matCasco);
  casco.castShadow = true; casco.receiveShadow = true;
  cuerpo.add(casco);
  const fondo = new THREE.Mesh(new THREE.CircleGeometry(5.75, 48), new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 0.9 }));
  fondo.rotation.x = Math.PI / 2; fondo.position.y = Y0; cuerpo.add(fondo);

  // Aletas / patas.
  const matTinto = new THREE.MeshStandardMaterial({ color: C.tinto, roughness: 0.55, metalness: 0.2 });
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const forma = new THREE.Shape();
    forma.moveTo(0, 6); forma.lineTo(0.45, 6); forma.lineTo(3.0, -2.2); forma.lineTo(3.0, -3.0); forma.lineTo(2.1, -3.0); forma.lineTo(0, -0.6); forma.lineTo(0, 6);
    const aleta = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.35, bevelEnabled: false }), matTinto);
    aleta.position.set(Math.sin(a) * 5.2, 4.25, Math.cos(a) * 5.2); aleta.rotation.y = a - Math.PI / 2;
    aleta.translateZ(-0.17); aleta.castShadow = true;
    cuerpo.add(aleta);
  }

  // Anillo de la clase Anillo (como el del planeta) y sus cúpulas de cristal con luz cálida.
  const cvA = lienzo(512, 8), xa = cvA.getContext('2d');
  const bandas = [C.cafe, C.tintoClaro, C.mant, C.mant, C.azul, C.tinto, C.mant, C.azul];
  bandas.forEach((c, i) => { xa.fillStyle = c; xa.fillRect(i * 64, 0, 64, 8); });
  const tA = new THREE.CanvasTexture(cvA); tA.colorSpace = THREE.SRGBColorSpace;
  const gAn = new THREE.RingGeometry(5.0, 9.2, 96, 1);
  { const uv = gAn.attributes.uv, pp = gAn.attributes.position; for (let i = 0; i < pp.count; i++) { const rr = Math.hypot(pp.getX(i), pp.getY(i)); uv.setXY(i, (rr - 5) / 4.2, 0.5); } }
  const anillo = new THREE.Mesh(gAn, new THREE.MeshStandardMaterial({ map: tA, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.2 }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.y = 27.3; anillo.castShadow = true;
  cuerpo.add(anillo);
  const canto = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.12, 8, 96), matTinto);
  canto.rotation.x = Math.PI / 2; canto.position.y = 27.3; cuerpo.add(canto);
  const matCupula = new THREE.MeshStandardMaterial({ color: '#d8e6f5', transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.1, emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0.16, depthWrite: false });
  const matMarco = new THREE.MeshStandardMaterial({ color: C.oro, roughness: 0.35, metalness: 0.7 });
  const cupulas = [];
  const NC = 12;
  for (let k = 0; k < NC; k++) {
    const a = Math.PI + (k / NC) * Math.PI * 2; // la primera queda hacia -z (la del pasajero que busca)
    const cup = new THREE.Mesh(new THREE.SphereGeometry(1.9, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), matCupula);
    cup.position.set(Math.sin(a) * 6.5, 27.35, Math.cos(a) * 6.5);
    cuerpo.add(cup); cupulas.push(cup);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 6, 40), matMarco);
    aro.rotation.x = Math.PI / 2; aro.position.copy(cup.position); cuerpo.add(aro);
  }

  // Motores: 4 toberas. Motor 1 enciende el par diagonal; motor 2, las cuatro.
  const matTobera = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide });
  const toberas = [];
  const bell = []; for (let i = 0; i <= 12; i++) { const s = i / 12; bell.push(new THREE.Vector2(0.6 + 0.85 * Math.pow(s, 1.6), -s * 2.0)); }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const pos = new THREE.Vector3(Math.sin(a) * 2.4, Y0, Math.cos(a) * 2.4);
    const tob = new THREE.Mesh(new THREE.LatheGeometry(bell, 24), matTobera);
    tob.position.copy(pos); cuerpo.add(tob);
    const brasa = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: '#000000' }));
    brasa.rotation.x = Math.PI / 2; brasa.position.copy(pos).add(new THREE.Vector3(0, -1.9, 0)); cuerpo.add(brasa);
    const llama = crearLlama(); llama.position.copy(pos).add(new THREE.Vector3(0, -2.0, 0)); llama.material.uniforms.uFase.value = k * 1.7;
    cuerpo.add(llama);
    toberas.push({ brasa, llama, grupoMotor: k % 2 === 0 ? 1 : 2 });
  }

  const vapor = crearVapor({ calidad }); grupo.add(vapor);
  const luzMotor = new THREE.PointLight('#ff8a3d', 0, 70, 1.6); luzMotor.position.set(0, 1.0, 0); grupo.add(luzMotor);

  return {
    grupo, cuerpo, casco, cupulas, vapor,
    actualizar(t, nivel = 0, { escalaPuntos = 800, adentro = 0 } = {}) {
      const n = clamp(nivel, 0, 3);
      const amp = n < 1 ? 0 : n < 2 ? 0.006 * (n - 0.6) : 0.012 + 0.03 * (n - 2);
      cuerpo.position.set(temblor(t, 1) * amp, temblor(t, 2) * amp * 0.5, temblor(t, 3) * amp);
      for (const tb of toberas) {
        const i = clamp(n - (tb.grupoMotor - 1)) * (tb.grupoMotor === 1 ? 1 : 1) * (0.55 + 0.45 * clamp(n - 2));
        const brillo = clamp(i * 1.2);
        tb.brasa.material.color.setRGB(1.0 * brillo, 0.45 * brillo, 0.15 * brillo);
        tb.llama.material.uniforms.uT.value = t;
        tb.llama.material.uniforms.uI.value = i;
        tb.llama.scale.set(0.8 + 0.4 * i, 0.5 + 7.5 * i * i + 0.3 * Math.sin(t * 31 + tb.grupoMotor), 0.8 + 0.4 * i);
        tb.llama.visible = i > 0.01;
      }
      luzMotor.intensity = (900 * clamp(n / 3) + 120 * clamp(n)) * (1 - 0.88 * adentro);
      vapor.material.uniforms.uT.value = t;
      vapor.material.uniforms.uNivel.value = n;
      vapor.material.uniforms.uEscala.value = escalaPuntos;
    },
  };
}
