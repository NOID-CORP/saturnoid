// Prueba la mirada desde el asiento en un celular simulado (390×844, táctil): arrastre con un dedo, segundo dedo sin
// salto, inercia al soltar, tope arriba/abajo sin zona muerta, doble toque al frente, giroscopio simulado y tiempo
// por cuadro mientras se arrastra. Guarda capturas en pruebas/capturas/mirada-*.png.
//   (con el servidor local corriendo en 127.0.0.1:8080)  node pruebas/mirada.mjs [usuario]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const DIR = fileURLToPath(new URL('./capturas/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const usuario = process.argv[2] || 'donangeel';
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

const nav = await chromium.launch({ executablePath: CHROME, headless: true,
  args: [...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pag = await ctx.newPage();
const errores = [];
pag.on('pageerror', (e) => errores.push(e.message));
pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
const cdp = await ctx.newCDPSession(pag);

await pag.goto(`${BASE}?u=${usuario}`);
await pag.waitForFunction(() => document.body.classList.contains('en-asiento'), null, { timeout: 40000 });
await pag.waitForTimeout(1200);

// mirada actual (yaw, pitch) leída de la cámara del mundo: se expone solo para esta prueba
const vista = () => pag.evaluate(() => window.__mirada?.());
const toque = (tipo, puntos) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map(([x, y], id) => ({ x, y, id })) });
const espera = (ms) => pag.waitForTimeout(ms);
const resultados = [];
const ok = (nombre, cond, extra = '') => { resultados.push(cond); console.log(`${cond ? '✓' : '✗'} ${nombre}${extra ? ` · ${extra}` : ''}`); };

// 1. el recorrido automático está corriendo; al tocar, se queda donde iba (sin salto)
// los toques de la prueba caen sobre el lienzo (no sobre la tarjeta ni los botones)
const zonas = await pag.evaluate(() => [[200, 300], [60, 420], [100, 400], [200, 470], [280, 400], [350, 300], [200, 170]].map(([x, y]) => document.elementFromPoint(x, y)?.id));
ok('Las zonas de toque son del lienzo', zonas.every((z) => z === 'lienzo'), zonas.join(','));
const r0 = await vista();
await toque('touchStart', [[200, 300]]); await espera(120);
const r1 = await vista();
ok('Tocar no hace saltar la vista', Math.abs(r1.yaw - r0.yaw) < 0.25, `Δ ${(r1.yaw - r0.yaw).toFixed(3)} rad`);

// 2. arrastre a la derecha → la vista gira a la izquierda, y medimos la fluidez mientras tanto
await pag.evaluate(() => { window.__cuadros = []; let u = performance.now(); const f = (a) => { window.__cuadros.push(a - u); u = a; if (window.__cuadros.length < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
for (let i = 1; i <= 30; i++) { await toque('touchMove', [[200 + i * 5, 300]]); await espera(16); }
await espera(200);
const r2 = await vista();
ok('Arrastrar a la derecha mira a la izquierda', r2.yaw < r1.yaw - 0.2, `yaw ${r1.yaw.toFixed(2)} → ${r2.yaw.toFixed(2)}`);

// 3. un segundo dedo no hace saltar la vista
await toque('touchMove', [[350, 300]]); await espera(60);
const r3 = await vista();
await toque('touchStart', [[350, 300], [60, 420]]); await espera(40);
await toque('touchMove', [[350, 300], [80, 410]]); await espera(40);
await toque('touchMove', [[350, 300], [100, 400]]); await espera(150);
const r4 = await vista();
ok('Un segundo dedo no mueve la vista', Math.abs(r4.yaw - r3.yaw) < 0.02 && Math.abs(r4.pitch - r3.pitch) < 0.02, `Δ ${(r4.yaw - r3.yaw).toFixed(3)}`);
// se levanta el primero: el segundo sigue sin salto
await toque('touchEnd', [[100, 400]]); await espera(100);
const r5 = await vista();
ok('Al levantar el primer dedo no hay salto', Math.abs(r5.yaw - r4.yaw) < 0.02, `Δ ${(r5.yaw - r4.yaw).toFixed(3)}`);
await toque('touchEnd', []); await espera(400);

// 4. inercia: un barrido rápido sigue girando después de soltar
await toque('touchStart', [[100, 400]]);
for (let i = 1; i <= 6; i++) { await toque('touchMove', [[100 + i * 30, 400]]); await espera(12); }
await toque('touchEnd', []);
await espera(50); const s0 = await vista();
await espera(500); const s1 = await vista();
await espera(900); const s2 = await vista();
ok('Al soltar rápido sigue girando (inercia)', s1.yaw < s0.yaw - 0.05, `+${(s0.yaw - s1.yaw).toFixed(2)} rad en 0,5 s`);
ok('…y se frena sola', Math.abs(s2.yaw - s1.yaw) < Math.abs(s1.yaw - s0.yaw) * 0.5, `+${(s1.yaw - s2.yaw).toFixed(3)} rad después`);

// 5. tope de mirar abajo: arrastrar de más y devolver responde de una (sin zona muerta)
await toque('touchStart', [[200, 470]]);
for (let i = 1; i <= 20; i++) { await toque('touchMove', [[200, 470 - i * 15]]); await espera(10); } // dedo hacia arriba = mirar abajo, de más
await espera(250); const p0 = await vista();
for (let i = 1; i <= 4; i++) { await toque('touchMove', [[200, 170 + i * 10]]); await espera(16); }
await espera(250); const p1 = await vista();
await toque('touchEnd', []);
ok('Desde el tope, devolver el dedo mueve la vista de una', p1.pitch > p0.pitch + 0.03, `pitch ${p0.pitch.toFixed(2)} → ${p1.pitch.toFixed(2)}`);
await pag.screenshot({ path: `${DIR}mirada-1-abajo.png` });

// 6. doble toque: vuelve al frente
await espera(300);
for (let k = 0; k < 2; k++) { await toque('touchStart', [[200, 300]]); await espera(40); await toque('touchEnd', []); await espera(90); }
await espera(900); const c = await vista();
ok('Doble toque vuelve al frente', Math.abs(c.yaw % (2 * Math.PI)) < 0.05 && Math.abs(c.pitch) < 0.05, `yaw ${c.yaw.toFixed(3)} pitch ${c.pitch.toFixed(3)}`);

// 7. giroscopio simulado (Android: sin permiso): girar el celular 40° a la derecha y luego subirlo 20°
const girar = (alpha, beta, gamma = 0) => pag.evaluate(([a, b, g]) => dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g })), [alpha, beta, gamma]);
await girar(0, 80); await espera(150);
const boton = await pag.evaluate(() => ({ visible: !document.querySelector('#a-sensor').hidden, activo: document.querySelector('#a-sensor').getAttribute('aria-pressed') }));
ok('Con sensor, aparece "Mirar con el celular" encendido', boton.visible && boton.activo === 'true', JSON.stringify(boton));
await girar(0, 80); await espera(300);
const g0 = await vista();
for (let i = 1; i <= 20; i++) { await girar(-i * 2, 80); await espera(16); } // alpha baja = girar a la derecha
await espera(300); const g1 = await vista();
ok('Girar el celular a la derecha mira a la derecha', g1.yaw > g0.yaw + 0.6, `+${((g1.yaw - g0.yaw) * 180 / Math.PI).toFixed(0)}° (esperado ~40°)`);
for (let i = 1; i <= 10; i++) { await girar(-40, 80 + i * 2); await espera(16); }
await espera(300); const g2 = await vista();
ok('Subir el celular mira hacia arriba', g2.pitch > g1.pitch + 0.25, `+${((g2.pitch - g1.pitch) * 180 / Math.PI).toFixed(0)}° (esperado ~20°)`);
// celular casi acostado: el yaw no se vuelve loco
for (let i = 1; i <= 15; i++) { await girar(-40, 80 - i * 5); await espera(16); }
await espera(300); const g3 = await vista();
ok('Con el celular casi acostado, no gira de lado', Math.abs(g3.yaw - g2.yaw) < 0.08, `Δyaw ${(g3.yaw - g2.yaw).toFixed(3)}`);
await pag.screenshot({ path: `${DIR}mirada-2-sensor.png` });
// apagarlo: la vista se queda donde estaba
const a0 = await vista();
await pag.click('#a-sensor'); await espera(300);
const a1 = await vista();
ok('Apagar el sensor no hace saltar la vista', Math.abs(a1.yaw - a0.yaw) < 0.02, `aria-pressed=${await pag.getAttribute('#a-sensor', 'aria-pressed')}`);

// 8. fluidez (de los cuadros medidos durante el arrastre)
const cuadros = await pag.evaluate(() => window.__cuadros.slice(5));
const orden = [...cuadros].sort((a, b) => a - b);
const p95 = orden[Math.floor(orden.length * 0.95)];
console.log(`Cuadros: ${cuadros.length} · mediana ${orden[orden.length >> 1].toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · >50 ms: ${cuadros.filter((d) => d > 50).length}`);

if (errores.length) console.log('Errores:\n' + errores.join('\n'));
console.log(`${resultados.filter(Boolean).length}/${resultados.length} bien`);
await nav.close();
process.exit(resultados.every(Boolean) && !errores.length ? 0 : 1);
