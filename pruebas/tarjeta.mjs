// La tarjeta del asiento: minimizar/mostrar y "Verme sentado" (cámara alrededor de tu pasajero), en cada clase.
// Capturas en pruebas/capturas/tarjeta-*.png.   node pruebas/tarjeta.mjs [usuario …]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const DIR = fileURLToPath(new URL('./capturas/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const usuarios = process.argv.slice(2).length ? process.argv.slice(2) : ['prueba_0250', 'prueba_0800', 'prueba_0050', 'prueba_0500', 'donangeel'];
const nav = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errores = []; let bien = 0, total = 0;
const ok = (n, c, x = '') => { total++; if (c) bien++; console.log(`${c ? '✓' : '✗'} ${n}${x ? ` · ${x}` : ''}`); };
for (const u of usuarios) {
  const pag = await ctx.newPage(); pag.on('pageerror', (e) => errores.push(`${u}: ${e.message}`));
  await pag.goto(`${BASE}?u=${u}&calidad=media`);
  await pag.waitForFunction(() => document.body.classList.contains('en-asiento'), null, { timeout: 40000 });
  await pag.evaluate(() => { try { localStorage.removeItem('saturnoid-tarjeta-min'); } catch {} });
  await pag.waitForTimeout(1500);
  const alto = () => pag.evaluate(() => Math.round(document.querySelector('#a-tarjeta').getBoundingClientRect().height));
  const h0 = await alto();
  await pag.tap('#a-minimizar'); await pag.waitForTimeout(700);
  const h1 = await alto();
  ok(`${u}: minimizar achica la tarjeta`, h1 < h0 * 0.45, `${h0} → ${h1} px`);
  ok(`${u}: lo oculto no se alcanza con el teclado`, await pag.evaluate(() => document.querySelector('#a-detalle').inert && document.querySelector('#a-minimizar').getAttribute('aria-expanded') === 'false'));
  await pag.screenshot({ path: `${DIR}tarjeta-${u}-1-minimizada.png` });
  await pag.tap('#a-verme'); await pag.waitForTimeout(1600);
  ok(`${u}: "Verme sentado" queda encendido`, (await pag.getAttribute('#a-verme', 'aria-pressed')) === 'true');
  await pag.screenshot({ path: `${DIR}tarjeta-${u}-2-verme.png` });
  // girar alrededor con el dedo
  const cdp = await ctx.newCDPSession(pag);
  const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await t('touchStart', [[120, 400]]); for (let i = 1; i <= 15; i++) { await t('touchMove', [[120 + i * 12, 400]]); await pag.waitForTimeout(16); } await t('touchEnd', []);
  await pag.waitForTimeout(1200);
  await pag.screenshot({ path: `${DIR}tarjeta-${u}-3-girar.png` });
  await pag.tap('#a-minimizar'); await pag.waitForTimeout(700);
  ok(`${u}: mostrar la devuelve`, (await alto()) > h0 * 0.9);
  await pag.tap('#ver-pase'); await pag.waitForSelector('#pase:not([hidden])', { timeout: 15000 });
  ok(`${u}: el pase se arma estando "Verme sentado"`, true);
  await pag.close();
}
if (errores.length) console.log(errores.join('\n'));
console.log(`${bien}/${total} bien`);
await nav.close();
process.exit(bien === total && !errores.length ? 0 : 1);
