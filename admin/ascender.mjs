#!/usr/bin/env node
// Sube pasajeros de Turista a Clase Anillo (los 3 de cada episodio). Las suites de ascenso son aparte del cupo de 50.
//   node admin/ascender.mjs usuario1 usuario2 usuario3 [--episodio N]
//   node admin/ascender.mjs --sorteo [N] [--episodio N]   → escoge N al azar entre los de turista (por defecto, los del estado)
import { randomInt } from 'node:crypto';
import { sql, lit, preguntar, leerEstado, leerOcupacion, codigoAsiento } from './lib.mjs';
import { normalizarUsuario } from '../js/asientos.js';

const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const estado = await leerEstado();
const episodio = val('--episodio') ? parseInt(val('--episodio'), 10) : estado.episodio_actual;

let elegidos;
if (args.includes('--sorteo')) {
  const n = /^\d+$/.test(val('--sorteo') || '') ? parseInt(val('--sorteo'), 10) : estado.ascensos_por_episodio;
  const turista = await sql(`select usuario, asiento from public.saturnoid_pasajeros where clase = 'turista' and not oculto and not es_prueba order by numero`);
  if (turista.length < n) { console.log(`Solo hay ${turista.length} en turista.`); process.exit(0); }
  const bolsa = [...turista]; elegidos = [];
  for (let i = 0; i < n; i++) elegidos.push(bolsa.splice(randomInt(bolsa.length), 1)[0].usuario);
  console.log(`Sorteo entre ${turista.length} pasajeros de turista.`);
} else {
  const skip = new Set(['--episodio', val('--episodio')]);
  elegidos = args.filter((a) => !skip.has(a)).map(normalizarUsuario);
}
if (!elegidos.length) { console.log('Uso: node admin/ascender.mjs usuario1 usuario2 usuario3 | --sorteo [N]'); process.exit(1); }

const filas = await sql(`select usuario, clase, asiento from public.saturnoid_pasajeros where usuario in (${elegidos.map(lit).join(',')})`);
const ocup = await leerOcupacion();
let i = ocup.max.anillo;
const plan = [];
for (const u of elegidos) {
  const f = filas.find((x) => x.usuario === u);
  if (!f) { console.log(`@${u}: no tiene asiento, se salta.`); continue; }
  if (f.clase !== 'turista') { console.log(`@${u}: está en ${f.clase}, se salta.`); continue; }
  plan.push({ usuario: u, de: f.asiento, a: codigoAsiento('anillo', ++i) });
}
if (!plan.length) process.exit(0);
console.log(`\nAscensos del episodio ${episodio}:`);
for (const p of plan) console.log(`  @${p.usuario}: ${p.de} → ${p.a} (Clase Anillo)`);
if (!(await preguntar('\n¿Subirlos a Clase Anillo? (s/n) '))) process.exit(0);
for (const p of plan) {
  await sql(`update public.saturnoid_pasajeros set clase = 'anillo', asiento = ${lit(p.a)}, ascendido_en = ${lit(episodio)} where usuario = ${lit(p.usuario)} and clase = 'turista'`);
}
console.log('Listo: la portada de la web ya los muestra como los ascensos del episodio.');
