// Lectura de Supabase con la clave pública (solo lectura: las reglas RLS no dejan escribir).
import { SUPABASE_URL, SUPABASE_LLAVE } from './config.js';
import { vecinos } from './asientos.js';

const CAMPOS = 'usuario,clase,asiento,numero,ciudad,comentado_en,episodio,es_tripulacion,ascendido_en,es_prueba';

async function pedir(ruta, opciones = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      ...opciones, signal: ctl.signal,
      headers: { apikey: SUPABASE_LLAVE, 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Contadores en vivo + estado de la serie (episodio, reel, metas, cupos, investigadora).
export const resumen = () => pedir('rpc/saturnoid_resumen', { method: 'POST', body: '{}' });

export async function buscarPasajero(usuario) {
  const filas = await pedir(`saturnoid_pasajeros?usuario=eq.${encodeURIComponent(usuario)}&select=${CAMPOS}&limit=1`);
  return filas[0] || null;
}

export async function tripulacion() {
  return pedir(`saturnoid_pasajeros?es_tripulacion=eq.true&select=usuario,asiento&order=asiento`);
}

// Ocupantes de los asientos de alrededor → Map(asiento → { usuario }).
export async function ocupantesCerca(asiento) {
  const cods = vecinos(asiento, 2);
  const m = new Map();
  if (!cods.length) return m;
  const filas = await pedir(`saturnoid_pasajeros?asiento=in.(${cods.join(',')})&select=usuario,asiento`);
  for (const f of filas) m.set(f.asiento, { usuario: f.usuario });
  return m;
}
