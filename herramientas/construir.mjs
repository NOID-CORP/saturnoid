// Arma la versión publicada de la web (lo que sirve GitHub Pages). Correr después de tocar js/, escena/ o estilos.css:
//   npm run construir
// - js/app.js + escena/ + Three.js → dist/ en un solo paquete minificado y sin el código de Three.js que no se usa
//   (en vez de ~15 módulos que el navegador pedía uno tras otro). La escena 3D va en un trozo aparte que se
//   descarga en paralelo con la página.
// - estilos.css minificado va dentro de index.html (un pedido menos antes de la primera pintura).
// - El contador de pasajeros se pide a Supabase desde el <head>, sin esperar al JavaScript.
// Los archivos fuente (js/, escena/, estilos.css, lib/three) no cambian: los videos siguen usando escena/ tal cual.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, SUPABASE_LLAVE } from '../js/config.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const de = (...p) => path.join(raiz, ...p);
const DIST = de('dist');

fs.rmSync(DIST, { recursive: true, force: true });
const r = await esbuild.build({
  absWorkingDir: raiz,
  entryPoints: ['js/app.js'],
  bundle: true, splitting: true, format: 'esm', minify: true,
  outdir: 'dist', entryNames: '[name]', chunkNames: '[name]-[hash]',
  sourcemap: 'linked', legalComments: 'eof', metafile: true, logLevel: 'warning',
});

// Trozos que app.js necesita (estáticos y el de la escena 3D): se piden desde el <head> en paralelo.
// (incluye lo que importan esos trozos, p. ej. Three.js, que comparten la escena y las cámaras).
const trozos = [];
(function recorrer(f) {
  for (const i of r.metafile.outputs[f].imports) if (!i.external && !trozos.includes(i.path)) { trozos.push(i.path); recorrer(i.path); }
})('dist/app.js');

const css = (await esbuild.transform(fs.readFileSync(de('estilos.css'), 'utf8'), { loader: 'css', minify: true })).code.trim();
// Misma consulta que js/datos.js (GET sin cabeceras: sin consulta previa de CORS).
const pedirResumen = `window.__resumen=fetch(${JSON.stringify(`${SUPABASE_URL}/rest/v1/rpc/saturnoid_resumen?apikey=${SUPABASE_LLAVE}`)}).then(function(r){if(!r.ok)throw r.status;return r.json()});window.__resumen.catch(function(){})`;

const bloque = [
  '<!-- construir:inicio · lo genera `npm run construir` (desde estilos.css, js/ y escena/): no editar a mano -->',
  `  <script>${pedirResumen}</script>`,
  ...['dist/app.js', ...trozos].map((t) => `  <link rel="modulepreload" href="${t}">`),
  `  <style>${css}</style>`,
  '  <!-- construir:fin -->',
].join('\n');

const archivoHtml = de('index.html');
const html = fs.readFileSync(archivoHtml, 'utf8');
const marcas = /<!-- construir:inicio[\s\S]*?<!-- construir:fin -->/;
if (!marcas.test(html)) throw new Error('index.html no tiene las marcas construir:inicio / construir:fin');
fs.writeFileSync(archivoHtml, html.replace(marcas, () => bloque));

const kb = (f) => (fs.statSync(de(f)).size / 1024).toFixed(0);
for (const f of ['dist/app.js', ...trozos]) console.log(`${f.padEnd(28)} ${kb(f).padStart(5)} KB`);
console.log(`index.html                   ${kb('index.html').padStart(5)} KB (con los estilos dentro)`);
