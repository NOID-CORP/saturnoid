// Mide cuánto tarda la página en responder al tocar "Buscar" (procesador de celular simulado, 4× más lento):
// toque → empieza el vuelo, y el cuadro más lento en los 2 s siguientes (si se congela).
//   node pruebas/respuesta.mjs [usuario]   (BASE=https://noidcorp.com/saturnoid/ para medir la publicada)
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const usuario = process.argv[2] || 'donangeel';
const nav = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pag = await ctx.newPage();
const cdp = await ctx.newCDPSession(pag);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 85, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
await pag.goto(BASE);
await pag.waitForFunction(() => window.__saturnoidListo === true, null, { timeout: 60000 });
await pag.waitForTimeout(4000); // como una persona que lee antes de escribir
await pag.evaluate(() => {
  window.__cuadros = []; let u = performance.now();
  const f = (t) => { window.__cuadros.push([t, t - u]); u = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
});
await pag.type('#usuario', usuario, { delay: 120 });
await pag.waitForTimeout(700); // de escribir a tocar el botón
const t0 = await pag.evaluate(() => { const t = performance.now(); document.querySelector('#buscador button').click(); return t; });
await pag.waitForFunction(() => document.body.classList.contains('volando') || document.body.classList.contains('abordando'), null, { timeout: 20000 });
const t1 = await pag.evaluate(() => performance.now());
await pag.waitForFunction(() => document.body.classList.contains('volando'), null, { timeout: 20000 });
const t2 = await pag.evaluate(() => performance.now());
await pag.waitForTimeout(2000);
const peor = await pag.evaluate((t) => Math.max(...window.__cuadros.filter(([x]) => x > t).map(([, d]) => d)), t0);
console.log(`toque → primera reacción ${Math.round(t1 - t0)} ms · toque → vuelo ${Math.round(t2 - t0)} ms · cuadro más lento ${Math.round(peor)} ms`);
await nav.close();
