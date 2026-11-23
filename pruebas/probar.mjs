// Prueba la web en un navegador de celular (390×844) con el Chrome instalado: portada, búsqueda de cada clase,
// pase de abordar, usuario sin asiento y variantes del usuario (@, mayúsculas). Guarda capturas en pruebas/capturas/.
//   (con el servidor local corriendo en 127.0.0.1:8080)  node pruebas/probar.mjs [usuarios…]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const DIR = fileURLToPath(new URL('./capturas/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const args = process.argv.slice(2);
const ESCRITORIO = args.includes('--escritorio');
const SIN3D = args.includes('--sin3d');
const usuarios = args.filter((a) => !a.startsWith('--'));
// con `node admin/prueba.mjs crear 700`: 0007 Anillo, 0120 Órbita, 0450 Luna, 0650 Turista
const casos = usuarios.length ? usuarios : ['prueba_0007', '@PRUEBA_0120', 'prueba_0450', 'prueba_0650', 'donangeel', 'noexiste_xyz'];
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

const nav = await chromium.launch({
  executablePath: CHROME,
  headless: true, args: SIN3D ? ['--disable-3d-apis', '--disable-webgl'] : [...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--ignore-gpu-blocklist', '--enable-gpu'],
});
const ctx = await nav.newContext(ESCRITORIO
  ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0' });
const pag = await ctx.newPage();
const errores = [];
pag.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(`[${m.type()}] ${m.text()}`); });
pag.on('pageerror', (e) => errores.push(`[pageerror] ${e.message}`));
const pre = ESCRITORIO ? 'esc-' : SIN3D ? 'sin3d-' : '';

const t0 = Date.now();
await pag.goto(BASE, { waitUntil: 'domcontentloaded' });
const tDom = Date.now() - t0;
if (SIN3D) await pag.waitForFunction(() => document.body.classList.contains('sin3d'), null, { timeout: 15000 });
else await pag.waitForFunction(() => window.__saturnoidListo === true, null, { timeout: 30000 }).catch(() => errores.push('El 3D no terminó de cargar en 30 s'));
console.log(`DOM ${tDom} ms · 3D listo ${Date.now() - t0} ms · plan B: ${await pag.evaluate(() => document.body.classList.contains('sin3d'))}`);
await pag.waitForTimeout(3500);
await pag.screenshot({ path: `${DIR}${pre}01-portada.png` });
await pag.evaluate(() => document.querySelector('#clases').scrollIntoView());
await pag.waitForTimeout(600);
await pag.screenshot({ path: `${DIR}${pre}02-clases.png` });
await pag.evaluate(() => scrollTo(0, 0));

let k = 3;
for (const u of casos) {
  await pag.fill('#usuario', u);
  await pag.click('#buscador button');
  const sinAsiento = await pag.waitForSelector('#sin-asiento:not([hidden]), #asiento:not([hidden]), body.volando', { timeout: 10000 }).then(() => pag.evaluate(() => !document.querySelector('#sin-asiento').hidden));
  const nombre = u.replace(/[^a-z0-9_]/gi, '').toLowerCase();
  if (sinAsiento) {
    await pag.waitForTimeout(500);
    await pag.screenshot({ path: `${DIR}${pre}${String(k++).padStart(2, '0')}-${nombre}-sin-asiento.png` });
    console.log(`${u}: sin asiento → ${await pag.textContent('#sa-titulo')}`);
    await pag.click('#sa-cerrar');
    continue;
  }
  if (!SIN3D) {
    await pag.waitForTimeout(3000);
    await pag.screenshot({ path: `${DIR}${pre}${String(k++).padStart(2, '0')}-${nombre}-vuelo.png` });
  }
  await pag.waitForSelector('#asiento:not([hidden])', { timeout: 15000 });
  await pag.waitForTimeout(800);
  await pag.screenshot({ path: `${DIR}${pre}${String(k++).padStart(2, '0')}-${nombre}-asiento.png` });
  await pag.waitForTimeout(2400);
  await pag.screenshot({ path: `${DIR}${pre}${String(k++).padStart(2, '0')}-${nombre}-vecinos.png` });
  console.log(`${u}: ${await pag.textContent('#a-clase')} · ${await pag.textContent('#a-asiento')} · ${await pag.textContent('#a-vecinos')}`);
  await pag.click('#ver-pase');
  await pag.waitForSelector('#pase:not([hidden]) img', { timeout: 10000 });
  await pag.waitForTimeout(500);
  await pag.screenshot({ path: `${DIR}${pre}${String(k++).padStart(2, '0')}-${nombre}-pase.png` });
  const png = await pag.evaluate(async () => { const img = document.querySelector('#pase img'); return [img.naturalWidth, img.naturalHeight]; });
  console.log(`  pase ${png.join('×')}`);
  // guardar el pase tal cual
  const b64 = await pag.evaluate(async () => { const r = await fetch(document.querySelector('#pase img').src); const b = await r.blob(); return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.readAsDataURL(b); }); });
  (await import('node:fs')).writeFileSync(`${DIR}${pre}pase-${nombre}.png`, Buffer.from(b64, 'base64'));
  await pag.click('#pase-cerrar');
  await pag.click('#volver');
  await pag.waitForTimeout(1200);
}

console.log(errores.length ? `\nErrores/avisos (${errores.length}):\n${[...new Set(errores)].slice(0, 25).join('\n')}` : '\nSin errores en la consola.');
await nav.close();
