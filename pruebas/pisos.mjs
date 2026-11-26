// Mira desde un asiento de cada clase en 4 direcciones (frente, izquierda, derecha, atrás) y guarda capturas en
// pruebas/capturas/pisos/. Sirve para revisar que cada piso se vea lleno y con sentido.
//   (con el servidor local corriendo)  node pruebas/pisos.mjs [usuario …]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const DIR = fileURLToPath(new URL('./capturas/pisos/', import.meta.url)); mkdirSync(DIR, { recursive: true });
const args = process.argv.slice(2);
const usuarios = args.length ? args : ['prueba_0050', 'prueba_0250', 'prueba_0500', 'prueba_0800'];
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const nav = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errores = [];
for (const u of usuarios) {
  const pag = await ctx.newPage();
  pag.on('pageerror', (e) => errores.push(`${u}: ${e.message}`));
  await pag.goto(`${BASE}?u=${u}&calidad=media`);
  await pag.waitForFunction(() => document.body.classList.contains('en-asiento'), null, { timeout: 40000 });
  await pag.waitForTimeout(9500); // que termine el recorrido automático
  const info = await pag.evaluate(() => document.querySelector('#a-asiento').textContent);
  await pag.evaluate(() => { document.querySelector('#asiento .tarjeta').style.visibility = 'hidden'; });
  // girar con las flechas (Mayúscula = 0,4 rad por toque)
  const girar = async (n, tecla = 'ArrowRight') => { for (let i = 0; i < n; i++) { await pag.keyboard.press(`Shift+${tecla}`); await pag.waitForTimeout(30); } await pag.waitForTimeout(900); };
  await pag.mouse.click(200, 300); // foco en la página
  const vistas = [['1-frente', 0], ['2-derecha', 4], ['3-atras', 4], ['4-izquierda', 4]];
  for (const [nombre, n] of vistas) { await girar(n); await pag.screenshot({ path: `${DIR}${u}-${nombre}.png` }); }
  console.log(`${u} → ${info}`);
  await pag.close();
}
// una hoja por usuario con las 4 vistas lado a lado (más fácil de revisar)
import { readFileSync } from 'node:fs';
const hoja = await ctx.newPage();
await hoja.setViewportSize({ width: 4 * 390 + 50, height: 844 + 40 });
for (const u of usuarios) {
  const imgs = ['1-frente', '2-derecha', '3-atras', '4-izquierda'].map((n) => `<figure><img src="data:image/png;base64,${readFileSync(`${DIR}${u}-${n}.png`).toString('base64')}"><figcaption>${u} · ${n}</figcaption></figure>`).join('');
  await hoja.setContent(`<body style="margin:0;background:#111;color:#fff;font:14px monospace;display:flex;gap:10px;padding:10px">${imgs.replaceAll('<figure>', '<figure style="margin:0">')}</body>`);
  await hoja.screenshot({ path: `${DIR}hoja-${u}.png` });
}
if (errores.length) console.log(errores.join('\n'));
await nav.close();
