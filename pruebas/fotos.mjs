// Genera las imágenes de portada desde la escena 3D (modo ?foto, nave en espera) → assets/img/.
//   (con el servidor local en 127.0.0.1:8080)  node pruebas/fotos.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const IMG = fileURLToPath(new URL('../assets/img/', import.meta.url));
const nav = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const [nombre, w, h, dpr] of [['portada-movil', 390, 844, 2], ['portada-1600', 1600, 900, 1], ['portada-1200', 1200, 630, 1]]) {
  const pag = await nav.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await pag.goto(`${BASE}?foto&nivel=0`);
  await pag.waitForFunction(() => window.__saturnoidListo === true, null, { timeout: 30000 });
  await pag.waitForTimeout(2500);
  await pag.screenshot({ path: `${IMG}${nombre}.jpg`, type: 'jpeg', quality: nombre === 'portada-movil' ? 72 : 80 });
  await pag.close();
  console.log('listo', nombre);
}
await nav.close();
