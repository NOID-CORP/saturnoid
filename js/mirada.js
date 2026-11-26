// Mirar alrededor desde el asiento: con el dedo (con inercia), moviendo el celular (giroscopio) y con las flechas.
// Todo termina en dos números, yaw y pitch (radianes, relativos a la mirada al frente del asiento), que se suavizan
// cada cuadro con una curva que no depende de los cuadros por segundo: igual de fluido a 30, 60 o 120 Hz.
//
// Las trabas que quita (frente a la versión anterior):
// - Un solo dedo manda. Antes, al apoyar un segundo dedo la vista saltaba; ahora se ignora y, si el primero se
//   levanta, el segundo sigue desde donde está, sin brinco.
// - Se suman movimientos (no se mide desde el punto de inicio): si se llega al tope de mirar arriba/abajo, al
//   devolver el dedo la vista responde de una (no hay "zona muerta" escondida).
// - Al soltar, la vista sigue con la velocidad del dedo y se frena sola (como el scroll del celular).
// - "Agarrar el mundo": la escena se queda pegada al dedo, como en Street View o una foto 360.
// - El giroscopio solo gira a los lados y arriba/abajo, nunca inclina el horizonte (marea menos).
// - Con "reducir movimiento" del sistema: sin recorrido automático, sin inercia y el giroscopio no se enciende solo.

const TAU_SUAVE = 0.045;    // s: cuánto tarda la vista en alcanzar el dedo/celular (más alto = más flotante)
const TAU_INERCIA = 0.32;   // s: cuánto tarda en frenarse después de soltar
const VEL_MAX = 7;          // rad/s: tope del impulso al soltar
const UMBRAL_SENSOR = 0.05; // rad: lo que hay que mover el celular para que cuente como "la persona está mirando"
const TOQUE_PX = 10, TOQUE_MS = 280, DOBLE_MS = 320;

const envolver = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const acotar = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * @param {object} o
 * @param {HTMLElement} o.elemento      dónde se arrastra (el lienzo)
 * @param {() => boolean} o.habilitada  si ahora se puede mirar (solo en el asiento)
 * @param {(como: string) => void} [o.alMirar]  la persona tomó el control (dedo, sensor, teclado o centrar)
 */
export function crearMirada({ elemento, habilitada, alMirar = () => {} }) {
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  // manual = dedo + teclado + inercia; sensor = celular; vista = lo que se dibuja (suavizado)
  const manual = { yaw: 0, pitch: 0 };
  const sensor = { yaw: 0, pitch: 0 };
  const vista = { yaw: 0, pitch: 0 };
  const vel = { yaw: 0, pitch: 0 };
  let base = { yaw: 0, pitch: 0 }; // mirada del recorrido automático en el último cuadro
  let limites = [-1, 1];   // pitch permitido (relativo al frente), lo fija el asiento
  let tomada = false;      // la persona ya tomó el control (se acabó el recorrido automático)

  // El recorrido se congela donde iba y pasa a ser parte de lo manual: el control cambia de manos sin salto.
  function tomar(como) {
    if (tomada) return;
    tomada = true;
    manual.yaw += base.yaw; manual.pitch += base.pitch;
    alMirar(como);
  }

  function respetarLimites() {
    // el tope se aplica sobre la suma (dedo + celular) y lo que sobra se le quita a lo manual: así nunca queda
    // movimiento "guardado" que haya que deshacer antes de que la vista responda
    const b = tomada ? 0 : base.pitch;
    const total = b + manual.pitch + sensor.pitch;
    if (total > limites[1]) { manual.pitch -= total - limites[1]; if (vel.pitch > 0) vel.pitch = 0; }
    else if (total < limites[0]) { manual.pitch += limites[0] - total; if (vel.pitch < 0) vel.pitch = 0; }
  }

  // ---------- dedo / ratón ----------
  let dedo = null;          // pointerId que manda
  const otros = new Map();  // otros dedos apoyados (por si el primero se levanta)
  let ux = 0, uy = 0;       // última posición del dedo que manda
  let muestras = [];        // [t, yaw, pitch] de los últimos ms, para la velocidad al soltar
  let ini = null;           // [t, x, y] del apoyo, para reconocer un toque (y el doble toque)
  let ultimoToque = -1e9;

  // radianes por píxel: en el celular, un barrido de lado a lado gira unos 100°
  const sensibilidad = () => 1.75 / Math.max(320, Math.min(innerWidth, innerHeight));

  elemento.addEventListener('pointerdown', (e) => {
    if (!habilitada()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dedo !== null) { otros.set(e.pointerId, [e.clientX, e.clientY]); ini = null; return; }
    dedo = e.pointerId; ux = e.clientX; uy = e.clientY;
    ini = [e.timeStamp, e.clientX, e.clientY];
    vel.yaw = vel.pitch = 0; // agarrar la vista la detiene en seco, como el scroll del celular
    muestras = [[e.timeStamp, manual.yaw, manual.pitch]];
    try { elemento.setPointerCapture(e.pointerId); } catch { /* el dedo ya se fue */ }
    elemento.classList.add('arrastrando');
  });

  elemento.addEventListener('pointermove', (e) => {
    if (otros.has(e.pointerId)) { otros.set(e.pointerId, [e.clientX, e.clientY]); return; }
    if (e.pointerId !== dedo) return;
    const dx = e.clientX - ux, dy = e.clientY - uy;
    if (!dx && !dy) return;
    if (ini && Math.hypot(e.clientX - ini[1], e.clientY - ini[2]) > TOQUE_PX) ini = null; // ya no es un toque
    tomar('dedo');
    // el dedo va a la derecha → la escena va con él → la vista gira a la izquierda
    const k = sensibilidad();
    manual.yaw -= dx * k;
    manual.pitch += dy * k;
    ux = e.clientX; uy = e.clientY;
    respetarLimites();
    muestras.push([e.timeStamp, manual.yaw, manual.pitch]);
    while (muestras.length > 2 && e.timeStamp - muestras[0][0] > 120) muestras.shift();
  });

  function soltar(e) {
    otros.delete(e.pointerId);
    if (e.pointerId !== dedo) return;
    // ¿queda otro dedo apoyado? sigue ese, desde donde está (sin salto)
    const sig = otros.entries().next().value;
    if (sig) {
      otros.delete(sig[0]);
      dedo = sig[0]; [ux, uy] = sig[1];
      muestras = [[e.timeStamp, manual.yaw, manual.pitch]];
      try { elemento.setPointerCapture(dedo); } catch { /* ya no está */ }
      return;
    }
    dedo = null;
    elemento.classList.remove('arrastrando');
    if (e.type !== 'pointerup') return;
    // toque corto sin moverse: dos seguidos = volver a mirar al frente
    if (ini && e.timeStamp - ini[0] < TOQUE_MS) {
      if (e.timeStamp - ultimoToque < DOBLE_MS) { centrar(); ultimoToque = -1e9; } else ultimoToque = e.timeStamp;
      return;
    }
    if (reducir.matches) return;
    // impulso: velocidad media de los últimos ~80 ms; si el dedo ya estaba quieto al soltar, no hay impulso
    const ultima = muestras[muestras.length - 1];
    const primera = muestras.find((m) => ultima[0] - m[0] <= 80) || ultima;
    const dt = (ultima[0] - primera[0]) / 1000;
    if (dt > 0.008 && e.timeStamp - ultima[0] < 60) {
      vel.yaw = acotar((ultima[1] - primera[1]) / dt, -VEL_MAX, VEL_MAX);
      vel.pitch = acotar((ultima[2] - primera[2]) / dt, -VEL_MAX, VEL_MAX);
    }
  }
  elemento.addEventListener('pointerup', soltar);
  elemento.addEventListener('pointercancel', soltar);
  elemento.addEventListener('lostpointercapture', (e) => { if (e.pointerId === dedo) soltar(e); });
  elemento.addEventListener('contextmenu', (e) => { if (habilitada()) e.preventDefault(); });

  // ---------- teclado (flechas; con Mayúscula, pasos más largos) ----------
  addEventListener('keydown', (e) => {
    if (!habilitada() || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('input, textarea, select, [role="dialog"]')) return;
    const paso = e.shiftKey ? 0.4 : 0.16;
    const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] }[e.key];
    if (!d) return;
    e.preventDefault();
    tomar('teclado');
    vel.yaw = vel.pitch = 0;
    manual.yaw += d[0]; manual.pitch += d[1];
    respetarLimites();
  });

  // ---------- giroscopio ----------
  // Se lee hacia dónde mira la parte de atrás del celular (yaw y pitch del mundo) y se usa solo cuánto cambió desde
  // que se encendió: da igual cómo lo esté sosteniendo la persona (derecho, inclinado o casi acostado).
  const hayApi = typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  // iPhone (y Chrome reciente) traen requestPermission; en iPhone no llega ninguna lectura hasta dar permiso con un
  // toque, en Chrome/Android las lecturas llegan solas. Por eso se decide con la primera lectura real, no con la API.
  const pidePermiso = hayApi && typeof DeviceOrientationEvent.requestPermission === 'function';
  let conversor = null;     // escena/camara.js → miradaSensor (usa Three.js, llega con la escena)
  let sensorOn = false, disponible = pidePermiso, negado = false, apagadoAMano = false;
  let lectura = null, rebase = true, ultimoYaw = 0, pitchRef = 0;
  const oyentes = new Set();
  const estadoSensor = () => ({ disponible, activo: sensorOn, negado });
  const avisar = () => { for (const f of oyentes) f(estadoSensor()); };

  const anguloPantalla = () => (Number(screen.orientation?.angle ?? window.orientation ?? 0) || 0) * Math.PI / 180;
  function alOrientar(e) {
    if (e.beta == null || e.gamma == null) return;
    lectura = e;
    if (!disponible) { disponible = true; avisar(); }
  }
  // al girar la pantalla cambia el sistema de referencia: se retoma desde ahí, sin salto
  const reorientar = () => { rebase = true; };
  screen.orientation?.addEventListener?.('change', reorientar);
  addEventListener('orientationchange', reorientar);
  // si la persona sale de la pestaña y vuelve, el celular pudo moverse mucho: se retoma sin salto
  document.addEventListener('visibilitychange', reorientar);

  function leerSensor() {
    if (!sensorOn || !lectura || !conversor) return;
    const g = conversor(lectura.alpha || 0, lectura.beta, lectura.gamma, anguloPantalla());
    if (rebase) { ultimoYaw = g.yaw; pitchRef = g.pitch - sensor.pitch; rebase = false; return; }
    sensor.yaw += envolver(g.yaw - ultimoYaw); ultimoYaw = g.yaw; // acumulado: puede dar vueltas completas sin saltar
    sensor.pitch = g.pitch - pitchRef;
    if (!tomada && Math.hypot(sensor.yaw, sensor.pitch) > UMBRAL_SENSOR) tomar('sensor');
  }

  function encenderSensor() {
    if (sensorOn) return;
    sensorOn = true; rebase = true; lectura = null;
    addEventListener('deviceorientation', alOrientar);
    avisar();
  }
  function apagarSensor() {
    if (!sensorOn) return;
    sensorOn = false;
    removeEventListener('deviceorientation', alOrientar);
    // lo que había girado el celular se queda en la vista (no salta al apagar)
    manual.yaw += sensor.yaw; manual.pitch += sensor.pitch; sensor.yaw = sensor.pitch = 0;
    lectura = null;
    avisar();
  }

  // En iPhone hay que pedir permiso y solo se puede dentro de un toque: se llama directo desde el clic del botón.
  async function alternarSensor() {
    if (sensorOn) { apagadoAMano = true; apagarSensor(); return false; }
    if (pidePermiso) {
      let r = 'denied';
      try { r = await DeviceOrientationEvent.requestPermission(); } catch { /* sin permiso */ }
      if (r !== 'granted') { negado = true; avisar(); return false; }
    }
    apagadoAMano = false; negado = false;
    encenderSensor();
    return true;
  }

  // Se escucha para saber si hay sensor de verdad sin pedir nada (Android; algunos computadores táctiles dicen que sí
  // y no mandan nada). Con la primera lectura real se enciende solo, salvo con "reducir movimiento" o si lo apagaron.
  if (hayApi) {
    const probar = (e) => {
      if (e.beta == null) return;
      removeEventListener('deviceorientation', probar);
      if (sensorOn) return;
      disponible = true;
      if (!reducir.matches && !apagadoAMano) encenderSensor(); else avisar();
    };
    addEventListener('deviceorientation', probar);
  }

  // ---------- cada cuadro ----------
  /** Avanza dt segundos. recorrido = la mirada automática de este instante (se usa mientras nadie tome el control). */
  function actualizar(dt, recorrido = { yaw: 0, pitch: 0 }) {
    dt = acotar(dt, 0, 0.1);
    base = recorrido;
    leerSensor();
    if (dedo === null && (vel.yaw || vel.pitch)) {
      manual.yaw += vel.yaw * dt; manual.pitch += vel.pitch * dt;
      const f = Math.exp(-dt / TAU_INERCIA);
      vel.yaw *= f; vel.pitch *= f;
      if (Math.abs(vel.yaw) < 0.005 && Math.abs(vel.pitch) < 0.005) vel.yaw = vel.pitch = 0;
    }
    respetarLimites();
    const b = tomada ? { yaw: 0, pitch: 0 } : base;
    const a = 1 - Math.exp(-dt / TAU_SUAVE);
    vista.yaw += (b.yaw + manual.yaw + sensor.yaw - vista.yaw) * a;
    vista.pitch += (b.pitch + manual.pitch + sensor.pitch - vista.pitch) * a;
    return vista;
  }

  /** Nuevo asiento: todo al frente, recorrido automático de nuevo y el sensor toma su referencia otra vez. */
  function reiniciar(lim) {
    limites = lim;
    for (const o of [manual, sensor, vista, vel]) o.yaw = o.pitch = 0;
    base = { yaw: 0, pitch: 0 };
    tomada = reducir.matches; // con movimiento reducido no hay recorrido automático
    rebase = true; dedo = null; ini = null; otros.clear();
    elemento.classList.remove('arrastrando');
  }

  /** Volver a mirar al frente (doble toque), por el camino más corto. */
  function centrar() {
    tomar('centrar');
    vel.yaw = vel.pitch = 0;
    manual.pitch = -sensor.pitch;
    manual.yaw = -sensor.yaw + Math.round(vista.yaw / (2 * Math.PI)) * 2 * Math.PI;
  }

  return {
    actualizar, reiniciar, centrar, alternarSensor,
    get tomada() { return tomada; },
    get arrastrando() { return dedo !== null; },
    get sensor() { return estadoSensor(); },
    usarConversor(f) { conversor = f; },
    alCambiarSensor(f) { oyentes.add(f); f(estadoSensor()); },
  };
}
