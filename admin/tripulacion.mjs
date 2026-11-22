#!/usr/bin/env node
// Sube la tripulación fundadora a la cabina de mando (C-02 a C-10; C-01 es la investigadora, que es un personaje).
//   node admin/tripulacion.mjs usuario1 usuario2 ... usuario9
// Solo con su permiso. No se guardan los nombres en el repo: van directo a la base.
import { sql, lit, preguntar } from './lib.mjs';
import { normalizarUsuario, USUARIO_VALIDO, codigoAsiento } from '../js/asientos.js';

const usuarios = process.argv.slice(2).map(normalizarUsuario);
if (!usuarios.length || usuarios.length > 9 || usuarios.some((u) => !USUARIO_VALIDO.test(u))) {
  console.log('Uso: node admin/tripulacion.mjs usuario1 ... usuario9 (máximo 9, sin espacios)');
  process.exit(1);
}
const ya = await sql(`select usuario, asiento from public.saturnoid_pasajeros where es_tripulacion order by asiento`);
console.log('Tripulación actual:', ya.length ? ya.map((x) => `${x.asiento} @${x.usuario}`).join(', ') : '(nadie)');
const plan = usuarios.map((u, i) => ({ u, asiento: codigoAsiento('cabina', i + 1) }));
console.log('\nNueva tripulación:');
for (const p of plan) console.log(`  ${p.asiento}  @${p.u}`);
if (!(await preguntar('\n¿Reemplazar la tripulación con esta lista? (s/n) '))) process.exit(0);
await sql(`begin;
delete from public.saturnoid_pasajeros where es_tripulacion;
insert into public.saturnoid_pasajeros (usuario, clase, asiento, es_tripulacion, episodio)
values ${plan.map((p) => `(${lit(p.u)}, 'cabina', ${lit(p.asiento)}, true, 0)`).join(', ')};
commit;`);
console.log('Listo.');
