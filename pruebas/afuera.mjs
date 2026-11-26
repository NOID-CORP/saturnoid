// La nave por fuera (portada) y el vuelo a un asiento, en cuadros: pruebas/capturas/afuera-*.png
//   node pruebas/afuera.mjs [usuario]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const DIR = fileURLToPath(new URL('./capturas/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const u = process.argv[2] || 'prueba_0050';
const nav = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const pag = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
const errores = []; pag.on('pageerror', (e) => errores.push(e.message));
await pag.goto(`${BASE}?calidad=media`);
await pag.waitForFunction(() => window.__saturnoidListo === true, null, { timeout: 30000 });
await pag.waitForTimeout(3000);
await pag.screenshot({ path: `${DIR}afuera-0-portada.png` });
await pag.fill('#usuario', u); await pag.click('#buscador button');
for (let i = 1; i <= 6; i++) { await pag.waitForTimeout(900); await pag.screenshot({ path: `${DIR}afuera-${i}-vuelo-${u}.png` }); }
if (errores.length) console.log(errores.join('\n'));
await nav.close();
