// Mide la carga con red de celular simulada (sin caché). Ojo: el servidor local no comprime;
// GitHub Pages sí (gzip), así que en línea es más rápido que esto.
//   node pruebas/carga.mjs
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const REDES = { '4G': { latency: 85, downloadThroughput: (9e6) / 8, uploadThroughput: (1.5e6) / 8 }, '4G lento': { latency: 150, downloadThroughput: (1.6e6) / 8, uploadThroughput: (0.75e6) / 8 } };
const nav = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const [nombre, red] of Object.entries(REDES)) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pag = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pag);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...red });
  let bytes = 0; pag.on('response', async (r) => { try { bytes += (await r.body()).length; } catch {} });
  const t0 = Date.now();
  await pag.goto(BASE, { waitUntil: 'commit' });
  await pag.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 60000 });
  const fcp = await pag.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime));
  await pag.waitForFunction(() => /\d/.test(document.querySelector('#pasajeros').textContent), null, { timeout: 60000 });
  const tDatos = Date.now() - t0;
  await pag.waitForFunction(() => window.__saturnoidListo === true, null, { timeout: 90000 });
  const t3d = Date.now() - t0;
  console.log(`${nombre}: primera pintura ${fcp} ms · contador real ${tDatos} ms · 3D andando ${t3d} ms · ${(bytes / 1024).toFixed(0)} KB sin comprimir`);
  await ctx.close();
}
await nav.close();
