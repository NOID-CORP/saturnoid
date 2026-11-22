#!/usr/bin/env node
// Ver o cambiar el estado de la serie (lo que la web usa para episodio, enlace del reel, metas y cupos).
//   node admin/estado.mjs                                   → muestra el estado y los contadores reales
//   node admin/estado.mjs episodio=2 reel=https://www.instagram.com/reel/XXXX/
//   node admin/estado.mjs metas=50,200,1000 anillo=100 orbita=300 turista=600 investigadora="Mery Orión"
import { sql, lit, preguntar, leerEstado } from './lib.mjs';

const CAMPOS = {
  episodio: ['episodio_actual', (v) => parseInt(v, 10)],
  reel: ['reel_url', (v) => (v === '-' ? null : v)],
  metas: ['metas', (v) => v.split(',').map((x) => parseInt(x, 10))],
  anillo: ['cupo_anillo', (v) => parseInt(v, 10)],
  orbita: ['cupo_orbita', (v) => parseInt(v, 10)],
  turista: ['cupo_turista', (v) => parseInt(v, 10)],
  ascensos: ['ascensos_por_episodio', (v) => parseInt(v, 10)],
  investigadora: ['investigadora', (v) => v],
};

const cambios = {};
for (const a of process.argv.slice(2)) {
  const i = a.indexOf('=');
  const k = a.slice(0, i); const v = a.slice(i + 1);
  if (!CAMPOS[k]) { console.log(`No conozco "${k}". Campos: ${Object.keys(CAMPOS).join(', ')}`); process.exit(1); }
  const [col, conv] = CAMPOS[k];
  cambios[col] = conv(v);
}

const e = await leerEstado();
const [{ r }] = await sql('select public.saturnoid_resumen() as r');
console.log('Estado actual:', { ...e, actualizado_en: undefined });
console.log(`Contadores reales: ${r.pasajeros} pasajeros (anillo ${r.anillo} + ${r.ascendidos} ascendidos, órbita ${r.orbita}, turista ${r.turista}), tripulación ${r.tripulacion}, de prueba ${r.prueba}`);
if (!Object.keys(cambios).length) process.exit(0);

console.log('Cambios:', cambios);
if (cambios.reel_url && !/^https:\/\/(www\.)?instagram\.com\//.test(cambios.reel_url)) { console.log('El reel debe ser un enlace de instagram.com'); process.exit(1); }
if (!(await preguntar('¿Guardar? (s/n) '))) process.exit(0);
const set = Object.entries(cambios).map(([c, v]) =>
  `${c} = ${Array.isArray(v) ? `'{${v.join(',')}}'::int[]` : lit(v)}`).join(', ');
await sql(`update public.saturnoid_estado set ${set}, actualizado_en = now() where id = 1`);
console.log('Guardado.');
