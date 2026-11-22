#!/usr/bin/env node
// Quita a alguien de la web (pidió salir por mensaje directo). Su asiento queda ocupado pero sin nombre.
//   node admin/ocultar.mjs usuario            → lo oculta
//   node admin/ocultar.mjs usuario --mostrar  → lo vuelve a mostrar
import { sql, lit, preguntar } from './lib.mjs';
import { normalizarUsuario, USUARIO_VALIDO } from '../js/asientos.js';

const usuario = normalizarUsuario(process.argv[2]);
const mostrar = process.argv.includes('--mostrar');
if (!USUARIO_VALIDO.test(usuario)) { console.log('Uso: node admin/ocultar.mjs usuario [--mostrar]'); process.exit(1); }

const [p] = await sql(`select usuario, clase, asiento, oculto from public.saturnoid_pasajeros where usuario = ${lit(usuario)}`);
if (!p) { console.log(`@${usuario} no tiene asiento.`); process.exit(0); }
console.log(`@${p.usuario} · ${p.clase} · ${p.asiento} · ahora ${p.oculto ? 'OCULTO' : 'visible'}`);
if (p.oculto === !mostrar) { console.log('No hay nada que cambiar.'); process.exit(0); }
if (!(await preguntar(`¿${mostrar ? 'Mostrarlo de nuevo' : 'Ocultarlo de la web'}? (s/n) `))) process.exit(0);
await sql(`update public.saturnoid_pasajeros set oculto = ${!mostrar} where usuario = ${lit(usuario)}`);
console.log(mostrar ? 'Visible otra vez.' : 'Oculto: ya no aparece en la web ni en los vecinos.');
