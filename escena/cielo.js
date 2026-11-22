// El cielo: estrellas, una bruma de fondo y el planeta Saturnoid (océanos, bosques, nubes, atmósfera y su anillo).
// Va en una escena aparte que se dibuja con la rotación de la cámara pero sin su posición: queda "en el infinito"
// y se ve igual desde la plataforma, por las ventanas o desde la cúpula de una suite.
import * as THREE from 'three';
import { GLSL_RUIDO, mulberry32 } from './util.js';

// Dirección del planeta vista desde la plataforma (hacia -z, que es hacia donde miran las ventanas de la nave).
export const DIR_PLANETA = new THREE.Vector3(-0.3, 0.34, -1).normalize();
// El sol queda a la derecha y un poco detrás: el planeta se ve iluminado en tres cuartos.
export const DIR_SOL = new THREE.Vector3(0.85, 0.25, 0.35).normalize();

const DIST = 800, RADIO = 165;

export function crearCielo({ calidad = 'media' } = {}) {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color('#05060c');
  const uT = { value: 0 };
  const centro = DIR_PLANETA.clone().multiplyScalar(DIST);

  // Bruma de fondo (un domo con un degradado muy suave en tinto y azul).
  const domo = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uP: { value: DIR_PLANETA } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `${GLSL_RUIDO}
        varying vec3 vD; uniform vec3 uP;
        void main(){
          float h = clamp(vD.y*0.5+0.5, 0.0, 1.0);
          vec3 c = mix(vec3(0.045,0.035,0.05), vec3(0.012,0.016,0.035), smoothstep(0.35,0.9,h));
          float banda = exp(-pow(dot(vD, normalize(vec3(0.6,0.3,-0.75))),2.0)*9.0);
          float n = fbm3(vD*3.0);
          c += vec3(0.10,0.03,0.04) * banda * n * 0.9;
          c += vec3(0.07,0.09,0.13) * pow(max(dot(vD,uP),0.0), 6.0) * 0.8;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  escena.add(domo);

  // Estrellas (posiciones con semilla; titilan con el tiempo).
  const N = calidad === 'baja' ? 1400 : 2600;
  const rnd = mulberry32(7);
  const pos = new Float32Array(N * 3), tam = new Float32Array(N), fase = new Float32Array(N), tono = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * r * 1200, u * 1200, Math.sin(a) * r * 1200], i * 3);
    tam[i] = Math.pow(rnd(), 6) * 3.2 + 0.7; fase[i] = rnd() * 6.28; tono[i] = rnd();
  }
  const gEst = new THREE.BufferGeometry();
  gEst.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  gEst.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  gEst.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
  gEst.setAttribute('tono', new THREE.BufferAttribute(tono, 1));
  const estrellas = new THREE.Points(gEst, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT, uPx: { value: 1 } },
    vertexShader: `attribute float tam; attribute float fase; attribute float tono; uniform float uT; uniform float uPx;
      varying float vA; varying float vTono;
      void main(){ vA = 0.55 + 0.45*sin(uT*(1.3+fase*0.4)+fase*9.0); vTono = tono;
        gl_PointSize = tam*uPx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying float vA; varying float vTono;
      void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d);
        vec3 c = mix(vec3(0.78,0.85,0.93), vec3(0.98,0.93,0.70), vTono);
        gl_FragColor = vec4(c, a*vA); }`,
  }));
  escena.add(estrellas);

  // Planeta: tipo Tierra (océano, costas, bosques, tierras café, nieve en los polos), luz del sol con terminador suave.
  const planeta = new THREE.Group();
  planeta.position.copy(centro);
  planeta.rotation.set(0.35, 0.8, -0.22);
  escena.add(planeta);
  const seg = calidad === 'baja' ? 64 : 96;
  const superficie = new THREE.Mesh(new THREE.SphereGeometry(RADIO, seg, seg / 2), new THREE.ShaderMaterial({
    uniforms: { uSol: { value: DIR_SOL }, uT },
    vertexShader: `varying vec3 vN; varying vec3 vNW; varying vec3 vV;
      void main(){ vN = normalize(position); vNW = normalize(mat3(modelMatrix)*normal);
        vec4 w = modelMatrix*vec4(position,1.0); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_RUIDO}
      uniform vec3 uSol; varying vec3 vN; varying vec3 vNW; varying vec3 vV;
      void main(){
        vec3 p = vN*2.1 + vec3(3.7,1.2,5.4);
        float h = fbm(p) + 0.12*fbm(p*4.0) - 0.06;
        float lat = abs(vN.y);
        float tierra = smoothstep(0.515, 0.53, h);
        float costa = smoothstep(0.47, 0.515, h) * (1.0 - tierra);
        vec3 hondo = vec3(0.02,0.08,0.20), medio = vec3(0.05,0.21,0.40), bajo = vec3(0.16,0.45,0.58);
        vec3 agua = mix(hondo, medio, smoothstep(0.30,0.47,h));
        agua = mix(agua, bajo, costa);
        float seco = smoothstep(0.45, 0.65, fbm(vN*3.3+11.0)) * (1.0 - smoothstep(0.55,0.8,lat));
        vec3 bosque = mix(vec3(0.07,0.20,0.08), vec3(0.16,0.31,0.12), fbm(vN*9.0));
        vec3 cafe = mix(vec3(0.33,0.22,0.12), vec3(0.55,0.42,0.26), fbm(vN*7.0+3.0));
        vec3 suelo = mix(bosque, cafe, seco);
        suelo = mix(suelo, vec3(0.42,0.36,0.30), smoothstep(0.62,0.72,h));
        vec3 col = mix(agua, suelo, tierra);
        float nieve = smoothstep(0.80, 0.88, lat + 0.08*fbm(vN*6.0));
        col = mix(col, vec3(0.92,0.94,0.97), nieve);
        float luz = dot(normalize(vNW), uSol);
        float dia = smoothstep(-0.12, 0.35, luz);
        vec3 r = reflect(-uSol, normalize(vNW));
        float brillo = pow(max(dot(r, vV), 0.0), 40.0) * (1.0 - tierra) * dia * 0.8;
        vec3 c = col * (0.035 + 1.15*dia) + vec3(1.0,0.92,0.78)*brillo;
        float borde = pow(1.0 - max(dot(normalize(vNW), vV), 0.0), 2.5);
        c += vec3(0.42,0.62,0.95) * borde * (0.15 + 0.85*dia) * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  planeta.add(superficie);

  // Nubes (giran despacio con el tiempo).
  const nubes = new THREE.Mesh(new THREE.SphereGeometry(RADIO * 1.012, seg, seg / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSol: { value: DIR_SOL }, uT },
    vertexShader: `varying vec3 vN; varying vec3 vNW; varying vec3 vV;
      void main(){ vN = normalize(position); vNW = normalize(mat3(modelMatrix)*normal);
        vec4 w = modelMatrix*vec4(position,1.0); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_RUIDO}
      uniform vec3 uSol; uniform float uT; varying vec3 vN; varying vec3 vNW; varying vec3 vV;
      void main(){
        float a = uT*0.004; mat2 m = mat2(cos(a),-sin(a),sin(a),cos(a));
        vec3 p = vN; p.xz = m*p.xz;
        float n = fbm(p*3.2 + vec3(0.0, 0.0, uT*0.003));
        float d = smoothstep(0.50, 0.75, n) * 0.85;
        float luz = smoothstep(-0.1, 0.4, dot(normalize(vNW), uSol));
        gl_FragColor = vec4(vec3(1.0,0.98,0.95)*(0.05+0.95*luz), d*(0.25+0.75*luz));
      }`,
  }));
  planeta.add(nubes);

  // Atmósfera: halo azul por fuera.
  const atm = new THREE.Mesh(new THREE.SphereGeometry(RADIO * 1.08, 64, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uSol: { value: DIR_SOL } },
    vertexShader: `varying vec3 vNW; varying vec3 vV;
      void main(){ vNW = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0);
        vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSol; varying vec3 vNW; varying vec3 vV;
      void main(){ float f = -dot(normalize(vNW), vV);
        float halo = pow(smoothstep(0.0, 0.38, f), 2.2);
        float luz = smoothstep(-0.35, 0.45, dot(normalize(vNW), uSol));
        gl_FragColor = vec4(vec3(0.45,0.65,1.0)*halo*(0.12+0.9*luz), 1.0); }`,
  }));
  planeta.add(atm);

  // Anillo en colores NOID (mantequilla, azul, tinto y café), con la sombra del planeta encima.
  const RI = RADIO * 1.42, RE = RADIO * 2.45;
  const anillo = new THREE.Mesh(new THREE.RingGeometry(RI, RE, 256, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uSol: { value: DIR_SOL }, uCentro: { value: centro }, uR: { value: RADIO }, uRI: { value: RI }, uRE: { value: RE } },
    vertexShader: `varying vec3 vW; varying vec2 vP;
      void main(){ vP = position.xy; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSol; uniform vec3 uCentro; uniform float uR; uniform float uRI; uniform float uRE;
      varying vec3 vW; varying vec2 vP;
      float h1(float x){ return fract(sin(x*127.1)*43758.5453); }
      float bandas(float x){ float i = floor(x); float f = fract(x); return mix(h1(i), h1(i+1.0), f*f*(3.0-2.0*f)); }
      void main(){
        float r = (length(vP) - uRI) / (uRE - uRI);
        float d = 0.6*bandas(r*38.0) + 0.3*bandas(r*90.0) + 0.1*bandas(r*160.0);
        d *= smoothstep(0.0, 0.06, r) * (1.0 - smoothstep(0.9, 1.0, r));
        d *= 1.0 - 0.92*smoothstep(0.585, 0.6, r)*(1.0 - smoothstep(0.64, 0.655, r)); // la división
        vec3 mant = vec3(0.98,0.92,0.70), azul = vec3(0.78,0.85,0.93), tinto = vec3(0.55,0.16,0.18), cafe = vec3(0.55,0.38,0.24);
        vec3 c = mix(cafe, tinto, smoothstep(0.08, 0.3, r));
        c = mix(c, mant, smoothstep(0.32, 0.5, r));
        c = mix(c, azul, smoothstep(0.66, 0.85, r));
        c *= 0.75 + 0.5*bandas(r*70.0);
        vec3 q = vW - uCentro; float pr = dot(q, uSol);
        float sombra = (pr < 0.0 && length(q - pr*uSol) < uR) ? 0.12 : 1.0;
        gl_FragColor = vec4(c * sombra * 1.1, d * 0.92);
      }`,
  }));
  anillo.rotation.x = -Math.PI / 2;
  planeta.add(anillo);
  anillo.renderOrder = 2;

  return {
    escena,
    actualizar(t, { pixelRatio = 1 } = {}) {
      uT.value = t;
      estrellas.material.uniforms.uPx.value = pixelRatio;
      planeta.rotation.y = 0.8 + t * 0.002;
    },
  };
}
