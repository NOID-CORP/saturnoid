// Arma la escena completa (cielo + plataforma + nave + interior opcional) y dibuja un cuadro para un tiempo dado.
// La web lo usa en tiempo real; un video lo puede usar cuadro por cuadro con mundo.cuadro(t, {...}).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { crearCielo, DIR_PLANETA } from './cielo.js';
import { crearPlataforma } from './plataforma.js';
import { crearNave } from './nave.js';
import { crearInterior } from './interiores.js';
import { temblor } from './util.js';

export const CALIDADES = {
  baja: { px: 1, bloom: false, luces: 2, sombras: false },
  media: { px: 1.5, bloom: true, luces: 4, sombras: false },
  alta: { px: 2, bloom: true, luces: 4, sombras: true },
};

export function crearMundo({ canvas, calidad = 'media', ancho, alto }) {
  const Q = CALIDADES[calidad] || CALIDADES.media;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: calidad !== 'baja', powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.px));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = Q.sombras;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camara = new THREE.PerspectiveCamera(60, 1, 0.05, 1500);
  const camCielo = new THREE.PerspectiveCamera(60, 1, 1, 4000);
  const cielo = crearCielo({ calidad });

  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2('#0b0a10', 0.0042);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.22;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight('#4a5b80', '#26190f', 0.55); escena.add(hemi);
  const reflectores = [];
  const luzPlaneta = new THREE.DirectionalLight('#c7d8ee', 1.1);
  luzPlaneta.position.copy(DIR_PLANETA).multiplyScalar(100); escena.add(luzPlaneta);

  const plataforma = crearPlataforma({ calidad });
  escena.add(plataforma.grupo);
  const nave = crearNave({ calidad });
  escena.add(nave.grupo);

  // Reflectores desde los mástiles hacia la nave.
  plataforma.mastiles.slice(0, Q.luces).forEach((p, i) => {
    const s = new THREE.SpotLight('#ffe3b8', 1300, 140, 0.5, 0.6, 1.7);
    s.position.copy(p); s.target.position.set(0, 26 + (i % 2) * 8, 0);
    escena.add(s, s.target); reflectores.push(s);
    if (Q.sombras && i < 2) { s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -0.0004; }
  });

  let composer = null, bloom = null;
  if (Q.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(cielo.escena, camCielo));
    const rp = new RenderPass(escena, camara); rp.clear = false; rp.clearDepth = true; composer.addPass(rp);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let interior = null;
  let desplazX = 0, desplazY = 0; // corre la imagen (la nave queda encima del panel en el celular, a la derecha en escritorio)
  let W = 1, H = 1;

  function redimensionar(w, h) {
    W = w; H = h;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    if (bloom) bloom.resolution.set(Math.max(128, w / 2), Math.max(128, h / 2));
    camara.aspect = camCielo.aspect = w / h;
  }
  if (ancho && alto) redimensionar(ancho, alto);

  const mira = new THREE.Vector3();
  function ponerCamara({ pos, mira: m, fov }, sacudida = 0, t = 0) {
    camara.position.copy(pos);
    if (sacudida) camara.position.add(new THREE.Vector3(temblor(t, 4) * sacudida, temblor(t, 5) * sacudida, temblor(t, 6) * sacudida));
    mira.copy(m); camara.lookAt(mira);
    if (fov && Math.abs(camara.fov - fov) > 0.01) camara.fov = fov;
    camara.updateProjectionMatrix();
    camCielo.fov = camara.fov; camCielo.aspect = camara.aspect; camCielo.updateProjectionMatrix();
    camara.projectionMatrix.elements[8] = desplazX; camCielo.projectionMatrix.elements[8] = desplazX;
    camara.projectionMatrix.elements[9] = desplazY; camCielo.projectionMatrix.elements[9] = desplazY;
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
    camCielo.projectionMatrixInverse.copy(camCielo.projectionMatrix).invert();
    camCielo.quaternion.copy(camara.quaternion);
  }

  function dibujar() {
    if (composer) { composer.render(); return; }
    renderer.autoClear = false; renderer.clear();
    renderer.render(cielo.escena, camCielo);
    renderer.clearDepth();
    renderer.render(escena, camara);
  }

  return {
    renderer, escena, camara, nave, plataforma, cielo,
    get interior() { return interior; },
    redimensionar,
    set desplazamiento(v) { desplazX = v.x || 0; desplazY = v.y || 0; },
    // Un cuadro: t en segundos, nivel continuo 0..3 y la cámara { pos, mira, fov } en coordenadas del mundo.
    // adentro (0..1): cuando la cámara está dentro de la nave se apagan los reflectores (no hay luz que los tape).
    cuadro(t, { nivel = 0, cam, sacudida = 0, adentro = 0 }) {
      for (const r of reflectores) r.intensity = 1300 * (1 - 0.94 * adentro);
      hemi.intensity = 0.55 * (1 - 0.5 * adentro);
      const px = renderer.getPixelRatio();
      cielo.actualizar(t, { pixelRatio: px });
      plataforma.actualizar(t);
      const escalaPuntos = (H * px * 0.5) / Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2);
      nave.actualizar(t, nivel, { escalaPuntos, adentro });
      interior?.actualizar(t);
      ponerCamara(cam, sacudida, t);
      dibujar();
    },
    prepararAsiento(clase, opciones) {
      this.quitarAsiento();
      interior = crearInterior(clase, opciones);
      nave.cuerpo.add(interior.grupo);
      return interior;
    },
    quitarAsiento() { interior?.liberar(); interior = null; },
    // Copia del último cuadro (para el pase de abordar). Llamar justo después de cuadro().
    // Foto para el pase: se dibuja con su propio encuadre y tamaño, se copia en ese mismo instante
    // (el lienzo no guarda el cuadro anterior) y se devuelve el tamaño de la pantalla.
    capturar(cam, { ancho = 1080, alto = 860 } = {}) {
      const [w0, h0, px0, dx, dy] = [W, H, renderer.getPixelRatio(), desplazX, desplazY];
      renderer.setPixelRatio(1); redimensionar(ancho, alto); desplazX = 0; desplazY = 0;
      if (cam) ponerCamara({ ...cam, fov: 62 });
      dibujar();
      const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
      c.getContext('2d').drawImage(renderer.domElement, 0, 0, ancho, alto);
      renderer.setPixelRatio(px0); redimensionar(w0, h0); desplazX = dx; desplazY = dy;
      return c;
    },
    liberar() { interior?.liberar(); renderer.dispose(); },
  };
}
