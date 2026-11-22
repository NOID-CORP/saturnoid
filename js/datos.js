// Lectura de Supabase con la clave pública (solo lectura: las reglas RLS no dejan escribir).
import { SUPABASE_URL, SUPABASE_LLAVE } from './config.js';
import { vecinos } from './asientos.js';

const CAMPOS = 'usuario,clase,asiento,numero,ciudad,comentado_en,episodio,es_tripulacion,ascendido_en,es_prueba';

// Solo GET y la clave (pública) en la URL, sin cabeceras propias: así el navegador no hace la consulta previa
// de CORS (OPTIONS) y cada lectura llega un viaje de ida y vuelta antes.
const urlLectura = (ruta) => `${SUPABASE_URL}/rest/v1/${ruta}${ruta.includes('?') ? '&' : '?'}apikey=${SUPABASE_LLAVE}`;

async function pedir(ruta) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(urlLectura(ruta), { signal: ctl.signal });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Contadores en vivo + estado de la serie (episodio, reel, metas, cupos, investigadora).
// La primera vez usa el pedido que index.html ya lanzó desde el <head> (llega antes que el JavaScript).
let previo = globalThis.__resumen || null;
export const resumen = () => {
  const p = previo; previo = null;
  const normal = () => pedir('rpc/saturnoid_resumen');
  return p ? p.catch(normal) : normal();
};

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
