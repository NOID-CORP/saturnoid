// Utilidades de los scripts de administración. El token NUNCA se imprime ni se sube: vive en ~/.config/noid/supabase-token.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { codigoAsiento, leerAsiento, nivelDe, NIVELES, CLASES } from '../js/asientos.js';

export const PROYECTO = 'czycgwhcdexmfvvywzsv';

function token() {
  try {
    return readFileSync(join(homedir(), '.config/noid/supabase-token'), 'utf8').trim();
  } catch {
    console.error('No encontré ~/.config/noid/supabase-token (ver 03 NOID/CLAUDE.md).');
    process.exit(1);
  }
}

// Ejecuta SQL con la API de administración de Supabase y devuelve las filas.
export async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase respondió ${r.status}: ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : [];
}

// Literal SQL seguro (comillas dobladas; los usuarios además se validan con una expresión regular).
export function lit(v) {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
}

export async function preguntar(texto) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(texto)).trim().toLowerCase();
  rl.close();
  return r === 's' || r === 'si' || r === 'sí';
}

export async function leerEstado() {
  const [e] = await sql('select * from public.saturnoid_estado where id = 1');
  return e;
}

export async function leerOcupacion() {
  const filas = await sql('select usuario, clase, asiento, numero, ascendido_en from public.saturnoid_pasajeros');
  const usados = new Set(filas.map((f) => f.usuario));
  const max = { cabina: -1, anillo: -1, orbita: -1, luna: -1, turista: -1 };
  const cuenta = { anillo: 0, orbita: 0, luna: 0, turista: 0, pasajeros: 0 };
  let numero = 0;
  for (const f of filas) {
    const a = leerAsiento(f.asiento);
    if (a) max[a.clase] = Math.max(max[a.clase], a.i);
    if (f.clase === 'anillo' && f.ascendido_en == null) cuenta.anillo++;
    if (f.clase === 'orbita') cuenta.orbita++;
    if (f.clase === 'luna') cuenta.luna++;
    if (f.clase === 'turista') cuenta.turista++;
    if (f.clase !== 'cabina') cuenta.pasajeros++;
    if (f.numero) numero = Math.max(numero, f.numero);
  }
  return { filas, usados, max, cuenta, numero };
}

// Reparte asientos por orden de llegada respetando los cupos. No toca la base: devuelve el plan.
export function planificar(nuevos, ocup, estado) {
  if (estado.cupo_luna == null) {
    console.error('La base todavía no tiene la Clase Luna: corre antes admin/sql/clase-luna.sql (ver LEEME.md).');
    process.exit(1);
  }
  const max = { ...ocup.max };
  const cuenta = { ...ocup.cuenta };
  let numero = ocup.numero;
  const plan = [], fuera = [];
  for (const n of nuevos) {
    let clase = null;
    if (cuenta.anillo < estado.cupo_anillo) clase = 'anillo';
    else if (cuenta.orbita < estado.cupo_orbita) clase = 'orbita';
    else if (cuenta.luna < estado.cupo_luna) clase = 'luna';
    else if (cuenta.turista < estado.cupo_turista) clase = 'turista';
    if (!clase) { fuera.push(n); continue; } // nave llena
    cuenta[clase]++;
    cuenta.pasajeros++;
    max[clase]++;
    numero++;
    plan.push({ ...n, clase, asiento: codigoAsiento(clase, max[clase]), numero });
  }
  return { plan, cuenta, fuera };
}

export function insertarSQL(plan, episodio, esPrueba = false) {
  const filas = plan.map((p) =>
    `(${lit(p.usuario)}, ${lit(p.clase)}, ${lit(p.asiento)}, ${lit(p.numero)}, ${lit(p.ciudad)}, ` +
    `${p.hora ? lit(p.hora) + '::timestamptz' : 'null'}, ${lit(episodio)}, false, ${lit(esPrueba)})`
  );
  return `insert into public.saturnoid_pasajeros (usuario, clase, asiento, numero, ciudad, comentado_en, episodio, es_tripulacion, es_prueba)
values ${filas.join(',\n')}
on conflict (usuario) do nothing;`;
}

export function resumenNivel(pasajeros, metas) {
  const n = nivelDe(pasajeros, metas);
  const sig = metas[n];
  return `${NIVELES[n].nombre}${sig ? ` (siguiente meta: ${sig})` : ''}`;
}

export { CLASES, codigoAsiento };
