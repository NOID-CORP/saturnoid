#!/usr/bin/env node
// Asigna asientos a los comentarios de un reel, por orden de llegada.
//   node admin/asignar.mjs comentarios.csv [--episodio N] [--fecha 2026-11-23] [--prueba]
// El CSV va en orden (el primero que comentó, arriba): usuario,ciudad,hora[,lleva[,objeto]]
//   lleva: el comentario tal cual. objeto: lo que tiene en las manos en el 3D (OBJETOS en js/asientos.js, p. ej.
//   gato, fuego o balon+fuego); si va vacío se adivina del comentario (🔥 = fuego). Revisarlo antes de responder s.
//   hora: "2026-11-23 10:15" o "2026-11-23T10:15:00-05:00", o solo "10:15" si se pasa --fecha.
//   Las horas sin zona se toman como hora de Colombia (-05:00).
// Salta a quien ya tiene asiento, muestra un resumen y pide confirmación antes de escribir.
import { readFileSync } from 'node:fs';
import { sql, lit, preguntar, leerEstado, leerOcupacion, planificar, insertarSQL, resumenNivel, CLASES } from './lib.mjs';
import { normalizarUsuario, USUARIO_VALIDO, adivinarObjeto, OBJETOS, OBJETO_VALIDO } from '../js/asientos.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const archivo = args.find((a, i) => !a.startsWith('--') && !['--episodio', '--fecha'].includes(args[i - 1]));
if (!archivo) {
  console.log('Uso: node admin/asignar.mjs comentarios.csv [--episodio N] [--fecha AAAA-MM-DD] [--prueba]');
  process.exit(1);
}
const esPrueba = args.includes('--prueba');

// CSV simple con comillas opcionales.
function celdas(linea) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (q) { if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function hora(texto, fecha) {
  let s = (texto || '').trim();
  if (!s) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    if (!fecha) throw new Error(`La hora "${s}" no trae fecha: usa --fecha AAAA-MM-DD`);
    s = `${fecha} ${s}`;
  }
  s = s.replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += '-05:00';
  const d = new Date(s);
  if (isNaN(d)) throw new Error(`No entiendo la hora "${texto}"`);
  return d.toISOString();
}

const textoLimpio = (c) => (c || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) || null;
function objetoDe(clave, lleva) {
  const k = (clave || '').trim().toLowerCase();
  if (k) {
    if (!OBJETO_VALIDO.test(k) || !OBJETOS[k.split('+')[0]]) throw new Error(`Objeto desconocido "${clave}" (ver OBJETOS en js/asientos.js)`);
    return k;
  }
  return lleva ? adivinarObjeto(lleva) : null;
}
const ciudadLimpia = (c) => (c || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;

const lineas = readFileSync(archivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
const estado = await leerEstado();
const episodio = opt('--episodio') ? parseInt(opt('--episodio'), 10) : estado.episodio_actual;
const ocup = await leerOcupacion();

const invalidos = []; const repetidos = []; const yaTenian = []; const nuevos = []; const vistos = new Set(); const equipajeViejos = [];
for (const [k, l] of lineas.entries()) {
  const [u, ciudad, h, llevaTxt, obj] = celdas(l);
  if (k === 0 && u.toLowerCase() === 'usuario') continue;
  const usuario = normalizarUsuario(u);
  if (!USUARIO_VALIDO.test(usuario)) { invalidos.push(u); continue; }
  if (vistos.has(usuario)) { repetidos.push(usuario); continue; }
  vistos.add(usuario);
  const lleva = textoLimpio(llevaTxt), objeto = objetoDe(obj, lleva);
  if (ocup.usados.has(usuario)) { yaTenian.push(usuario); if (lleva) equipajeViejos.push({ usuario, lleva, objeto }); continue; }
  nuevos.push({ usuario, ciudad: ciudadLimpia(ciudad), hora: hora(h, opt('--fecha')), lleva, objeto });
}

const { plan, cuenta, fuera } = planificar(nuevos, ocup, estado);
const por = (c) => plan.filter((p) => p.clase === c);

console.log(`\nSATURNOID · asignar asientos${esPrueba ? '  [DATOS DE PRUEBA]' : ''}`);
console.log(`Archivo: ${archivo} · episodio ${episodio}`);
console.log(`Líneas: ${lineas.length} · nuevos: ${plan.length} · ya tenían asiento: ${yaTenian.length} · repetidos en el archivo: ${repetidos.length} · inválidos: ${invalidos.length}`);
if (invalidos.length) console.log(`  Inválidos (se saltan): ${invalidos.slice(0, 10).join(', ')}${invalidos.length > 10 ? '…' : ''}`);
for (const c of ['anillo', 'orbita', 'luna', 'turista']) {
  const l = por(c);
  if (!l.length) continue;
  console.log(`\n${CLASES[c].nombre}: ${l.length} nuevos`);
  const mostrar = l.length > 8 ? [...l.slice(0, 5), null, ...l.slice(-2)] : l;
  for (const p of mostrar) console.log(p ? `  #${String(p.numero).padStart(4)}  ${p.asiento.padEnd(7)} @${p.usuario}${p.ciudad ? ' · ' + p.ciudad : ''}${p.objeto ? `  [${p.objeto}] «${p.lleva}»` : ''}` : '  …');
}
console.log(`\nDespués: ${cuenta.pasajeros} pasajeros · Anillo ${cuenta.anillo}/${estado.cupo_anillo} · Órbita ${cuenta.orbita}/${estado.cupo_orbita} · Luna ${cuenta.luna}/${estado.cupo_luna} · Turista ${cuenta.turista}/${estado.cupo_turista}`);
if (fuera.length) console.log(`\n¡NAVE LLENA! ${fuera.length} no caben y NO se suben: ${fuera.slice(0, 10).map((f) => '@' + f.usuario).join(', ')}${fuera.length > 10 ? '…' : ''}`);
console.log(`Nave: ${resumenNivel(ocup.cuenta.pasajeros, estado.metas)} → ${resumenNivel(cuenta.pasajeros, estado.metas)}\n`);

if (!plan.length) { console.log('No hay nada nuevo que subir.'); process.exit(0); }
if (!(await preguntar('¿Subir estos asientos a la web? (s/n) '))) { console.log('Cancelado: no se escribió nada.'); process.exit(0); }

for (let i = 0; i < plan.length; i += 400) await sql(insertarSQL(plan.slice(i, i + 400), episodio, esPrueba));
// quien ya tenía asiento (p. ej. la tripulación) y comentó: se le pone el equipaje si todavía no tenía
for (const e of equipajeViejos) await sql(`update public.saturnoid_pasajeros set lleva = ${lit(e.lleva)}, objeto = ${lit(e.objeto)} where usuario = ${lit(e.usuario)} and lleva is null`);
const [{ n }] = await sql('select count(*)::int as n from public.saturnoid_pasajeros where not es_tripulacion');
console.log(`Listo. Pasajeros en la base: ${n}. Revisa noidcorp.com/saturnoid`);
